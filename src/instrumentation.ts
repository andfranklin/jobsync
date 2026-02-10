export async function register() {
  // Only run on the server (not during build or in Edge runtime)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startInstance, stopInstance } = await import(
      "@/lib/ollama/instance-manager"
    );

    console.log("[JobSync] Starting dedicated Ollama instance...");
    const result = await startInstance();

    if (result.success) {
      console.log("[JobSync] Ollama instance ready.");
    } else {
      console.warn(
        `[JobSync] Could not start Ollama: ${result.error}. You can start it manually from Settings.`,
      );
    }

    // Graceful shutdown handlers
    const shutdown = async () => {
      console.log("[JobSync] Shutting down Ollama instance...");
      await stopInstance();
    };

    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
  }
}
