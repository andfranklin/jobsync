import { AiProvider } from "@/models/ai.model";

// --- Base URL ---

export function getOllamaBaseUrl(): string {
  // In browser context, we proxy through our API routes — this is for server-side utilities
  return `http://127.0.0.1:${process.env.JOBSYNC_OLLAMA_PORT || "11435"}`;
}

// --- Model Status ---

export interface ModelCheckResult {
  isRunning: boolean;
  error?: string;
  runningModelName?: string;
}

export const checkIfModelIsRunning = async (
  modelName: string | undefined,
  provider: AiProvider,
): Promise<ModelCheckResult> => {
  if (provider !== AiProvider.OLLAMA) {
    return { isRunning: true };
  }

  if (!modelName) {
    return {
      isRunning: false,
      error: "No model selected. Please select an AI model in settings first.",
    };
  }

  try {
    const baseUrl = getOllamaBaseUrl();
    const response = await fetch(`${baseUrl}/api/ps`, {
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return {
        isRunning: false,
        error: "Ollama service is not responding. Start it from Settings.",
      };
    }

    const data = await response.json();

    if (!data.models || data.models.length === 0) {
      return {
        isRunning: false,
        error: `${modelName} is not loaded. It will be loaded automatically when needed.`,
      };
    }

    const isRunning = data.models.some((m: { name: string }) => m.name === modelName);

    if (!isRunning) {
      return {
        isRunning: false,
        error: `${modelName} is not currently loaded. It will be loaded automatically when needed.`,
      };
    }

    return { isRunning: true, runningModelName: modelName };
  } catch (error) {
    console.error("Error checking if model is running:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return {
      isRunning: false,
      error: `Cannot connect to Ollama service. Error: ${errorMessage}`,
    };
  }
};

export const fetchRunningModels = async (): Promise<{
  models: string[];
  error?: string;
}> => {
  try {
    const baseUrl = getOllamaBaseUrl();
    const response = await fetch(`${baseUrl}/api/ps`, {
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return {
        models: [],
        error: "Failed to fetch running models. Make sure Ollama is running.",
      };
    }

    const data = await response.json();
    const models = data.models?.map((m: { name: string }) => m.name) || [];
    return { models };
  } catch (error) {
    console.error("Error fetching running models:", error);
    return {
      models: [],
      error: "Cannot connect to Ollama service.",
    };
  }
};

// --- Model Management ---

export const fetchInstalledModels = async (): Promise<{
  models: string[];
  error?: string;
}> => {
  try {
    const baseUrl = getOllamaBaseUrl();
    const response = await fetch(`${baseUrl}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return { models: [], error: "Failed to fetch installed models." };
    }

    const data = await response.json();
    const models =
      data.models?.map((m: { name: string }) => m.name) || [];
    return { models };
  } catch (error) {
    console.error("Error fetching installed models:", error);
    return { models: [], error: "Cannot connect to Ollama service." };
  }
};

export const loadOllamaModel = async (
  modelName: string,
): Promise<{ success: boolean; error?: string }> => {
  try {
    const baseUrl = getOllamaBaseUrl();
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modelName,
        prompt: "",
        keep_alive: "1h",
      }),
      signal: AbortSignal.timeout(120000), // 2 min — model loading can be slow
    });

    if (!response.ok) {
      const err = await response.text();
      return { success: false, error: `Failed to load model: ${err}` };
    }

    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: `Failed to load model: ${msg}` };
  }
};

export const unloadOllamaModel = async (
  modelName: string,
): Promise<{ success: boolean; error?: string }> => {
  try {
    const baseUrl = getOllamaBaseUrl();
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modelName,
        prompt: "",
        keep_alive: 0,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const err = await response.text();
      return { success: false, error: `Failed to unload model: ${err}` };
    }

    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: `Failed to unload model: ${msg}` };
  }
};

export interface PullProgress {
  status: string;
  total?: number;
  completed?: number;
}

export const pullOllamaModel = async (
  modelName: string,
  onProgress: (progress: PullProgress) => void,
  signal?: AbortSignal,
): Promise<{ success: boolean; error?: string }> => {
  try {
    const baseUrl = getOllamaBaseUrl();
    const response = await fetch(`${baseUrl}/api/pull`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: modelName, stream: true }),
      signal,
    });

    if (!response.ok) {
      const err = await response.text();
      return { success: false, error: `Failed to pull model: ${err}` };
    }

    const reader = response.body?.getReader();
    if (!reader) {
      return { success: false, error: "No response body" };
    }

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const data = JSON.parse(line);
          onProgress({
            status: data.status || "",
            total: data.total,
            completed: data.completed,
          });
        } catch {
          // Skip malformed JSON lines
        }
      }
    }

    return { success: true };
  } catch (error) {
    if (signal?.aborted) {
      return { success: false, error: "Pull cancelled" };
    }
    const msg = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: `Failed to pull model: ${msg}` };
  }
};

export const deleteOllamaModel = async (
  modelName: string,
): Promise<{ success: boolean; error?: string }> => {
  try {
    const baseUrl = getOllamaBaseUrl();
    const response = await fetch(`${baseUrl}/api/delete`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: modelName }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const err = await response.text();
      return { success: false, error: `Failed to delete model: ${err}` };
    }

    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: `Failed to delete model: ${msg}` };
  }
};
