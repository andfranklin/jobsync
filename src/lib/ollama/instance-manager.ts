import { ChildProcess, spawn } from "child_process";

export type OllamaInstanceStatus = "stopped" | "starting" | "running" | "stopping";

interface OllamaInstanceState {
  status: OllamaInstanceStatus;
  process: ChildProcess | null;
  port: number;
  modelsDir: string | null;
}

const state: OllamaInstanceState = {
  status: "stopped",
  process: null,
  port: getConfiguredPort(),
  modelsDir: getConfiguredModelsDir(),
};

export function getConfiguredPort(): number {
  return parseInt(process.env.JOBSYNC_OLLAMA_PORT || "11435", 10);
}

export function getConfiguredModelsDir(): string | null {
  return process.env.JOBSYNC_OLLAMA_MODELS_DIR || null;
}

export function getOllamaBaseUrl(): string {
  return `http://127.0.0.1:${state.port}`;
}

export function getInstanceStatus(): {
  status: OllamaInstanceStatus;
  port: number;
  modelsDir: string | null;
} {
  return {
    status: state.status,
    port: state.port,
    modelsDir: state.modelsDir,
  };
}

async function healthCheck(port: number, timeoutMs = 3000): Promise<boolean> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/tags`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function waitForHealthy(port: number, maxWaitMs = 15000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    if (await healthCheck(port)) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

export async function startInstance(): Promise<{ success: boolean; error?: string }> {
  if (state.status === "running") {
    // Already running — verify with health check
    if (await healthCheck(state.port)) {
      return { success: true };
    }
    // Process died without us noticing — reset state
    state.status = "stopped";
    state.process = null;
  }

  if (state.status === "starting") {
    return { success: false, error: "Instance is already starting" };
  }

  // Check if something is already listening on our port (e.g. from a previous run)
  if (await healthCheck(state.port)) {
    state.status = "running";
    return { success: true };
  }

  state.status = "starting";
  state.port = getConfiguredPort();
  state.modelsDir = getConfiguredModelsDir();

  const env: Record<string, string> = {
    ...process.env as Record<string, string>,
    OLLAMA_HOST: `127.0.0.1:${state.port}`,
  };

  if (state.modelsDir) {
    env.OLLAMA_MODELS = state.modelsDir;
  }

  try {
    const child = spawn("ollama", ["serve"], {
      env,
      stdio: "pipe",
      detached: false,
    });

    state.process = child;

    child.on("error", (err) => {
      console.error("[JobSync Ollama] Process error:", err.message);
      state.status = "stopped";
      state.process = null;
    });

    child.on("exit", (code) => {
      if (state.status !== "stopping") {
        console.warn(`[JobSync Ollama] Process exited unexpectedly (code: ${code})`);
      }
      state.status = "stopped";
      state.process = null;
    });

    // Wait for the instance to become healthy
    const healthy = await waitForHealthy(state.port);
    if (!healthy) {
      // Kill the process if it didn't become healthy
      child.kill("SIGTERM");
      state.status = "stopped";
      state.process = null;
      return {
        success: false,
        error: `Ollama failed to start on port ${state.port}. Is 'ollama' installed and in your PATH?`,
      };
    }

    state.status = "running";
    console.log(`[JobSync Ollama] Running on port ${state.port}`);
    return { success: true };
  } catch (err) {
    state.status = "stopped";
    state.process = null;
    const message = err instanceof Error ? err.message : "Unknown error";
    return {
      success: false,
      error: `Failed to start Ollama: ${message}`,
    };
  }
}

export async function stopInstance(): Promise<{ success: boolean; error?: string }> {
  if (state.status === "stopped" || !state.process) {
    state.status = "stopped";
    return { success: true };
  }

  state.status = "stopping";
  const child = state.process;

  return new Promise((resolve) => {
    const forceKillTimeout = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {
        // Process may already be dead
      }
      state.status = "stopped";
      state.process = null;
      resolve({ success: true });
    }, 5000);

    child.once("exit", () => {
      clearTimeout(forceKillTimeout);
      state.status = "stopped";
      state.process = null;
      resolve({ success: true });
    });

    try {
      child.kill("SIGTERM");
    } catch {
      clearTimeout(forceKillTimeout);
      state.status = "stopped";
      state.process = null;
      resolve({ success: true });
    }
  });
}
