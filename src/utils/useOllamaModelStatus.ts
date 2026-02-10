"use client";

import { useCallback, useState } from "react";
import { AiModel, AiProvider } from "@/models/ai.model";

interface OllamaModelStatus {
  runningModelName: string;
  runningModelError: string;
  isLoadingModel: boolean;
  ensureModelLoaded: () => Promise<void>;
  resetStatus: () => void;
}

export function useOllamaModelStatus(selectedModel: AiModel): OllamaModelStatus {
  const [runningModelName, setRunningModelName] = useState("");
  const [runningModelError, setRunningModelError] = useState("");
  const [isLoadingModel, setIsLoadingModel] = useState(false);

  const resetStatus = useCallback(() => {
    setRunningModelName("");
    setRunningModelError("");
    setIsLoadingModel(false);
  }, []);

  const ensureModelLoaded = useCallback(async () => {
    if (selectedModel.provider !== AiProvider.OLLAMA) return;
    if (!selectedModel.model) {
      setRunningModelError("No model selected. Configure a model in Settings.");
      return;
    }

    setRunningModelError("");
    setRunningModelName("");

    // Check if already running
    const { checkIfModelIsRunning } = await import("@/utils/ai.utils");
    const status = await checkIfModelIsRunning(
      selectedModel.model,
      selectedModel.provider,
    );

    if (status.isRunning && status.runningModelName) {
      setRunningModelName(status.runningModelName);
      return;
    }

    // Not running — auto-load it
    setIsLoadingModel(true);
    try {
      const { loadOllamaModel } = await import("@/utils/ai.utils");
      const result = await loadOllamaModel(selectedModel.model);
      if (result.success) {
        setRunningModelName(selectedModel.model);
      } else {
        setRunningModelError(result.error || "Failed to load model");
      }
    } catch {
      setRunningModelError("Failed to load model");
    } finally {
      setIsLoadingModel(false);
    }
  }, [selectedModel.model, selectedModel.provider]);

  return {
    runningModelName,
    runningModelError,
    isLoadingModel,
    ensureModelLoaded,
    resetStatus,
  };
}
