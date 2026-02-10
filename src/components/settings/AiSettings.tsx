"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import {
  AiModel,
  AiProvider,
  defaultModel,
  OpenaiModel,
  DeepseekModel,
} from "@/models/ai.model";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Label } from "../ui/label";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Progress } from "../ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../ui/alert-dialog";
import {
  getFromLocalStorage,
  saveToLocalStorage,
} from "@/utils/localstorage.utils";
import { toast } from "../ui/use-toast";
import {
  XCircle,
  CheckCircle,
  Loader2,
  Trash2,
  Download,
  Square,
  Power,
  PowerOff,
} from "lucide-react";
import { PullProgress } from "@/utils/ai.utils";
import {
  defaultPipelineSettings,
  type CleaningMethod,
  type FetchMethod,
} from "@/models/pipeline.model";

interface DeepseekModelResponse {
  object: string;
  data: {
    id: string;
    object: string;
    owned_by: string;
  }[];
}

type ServerStatus = "unknown" | "running" | "stopped" | "starting" | "stopping";

function AiSettings() {
  const [selectedModel, setSelectedModel] = useState<AiModel>(defaultModel);
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [deepseekModels, setDeepseekModels] = useState<string[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [runningModelError, setRunningModelError] = useState("");
  const [runningModelName, setRunningModelName] = useState("");

  // Server status
  const [serverStatus, setServerStatus] = useState<ServerStatus>("unknown");
  const [serverPort, setServerPort] = useState<number>(11435);

  // Model loading
  const [isLoadingModel, setIsLoadingModel] = useState(false);

  // Pull model
  const [pullModelName, setPullModelName] = useState("");
  const [isPulling, setIsPulling] = useState(false);
  const [pullProgress, setPullProgress] = useState(0);
  const [pullStatus, setPullStatusText] = useState("");
  const pullAbortRef = useRef<AbortController | null>(null);

  // Context length
  const CONTEXT_LENGTH_OPTIONS = [4096, 8192, 16384, 32768];
  const [numCtx, setNumCtx] = useState(8192);

  // Pipeline settings
  const [cleaningMethod, setCleaningMethod] = useState<CleaningMethod>("readability");
  const [fetchMethod, setFetchMethod] = useState<FetchMethod>("standard-with-fallback");

  // --- Server Management ---

  const checkServerStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/ollama/status");
      const data = await res.json();
      setServerStatus(data.running ? "running" : "stopped");
      setServerPort(data.port);
    } catch {
      setServerStatus("unknown");
    }
  }, []);

  const handleStartServer = async () => {
    setServerStatus("starting");
    try {
      const res = await fetch("/api/ollama/start", { method: "POST" });
      if (res.ok) {
        setServerStatus("running");
        fetchOllamaModels();
      } else {
        const data = await res.json();
        toast({
          variant: "destructive",
          title: "Failed to start Ollama",
          description: data.error,
        });
        setServerStatus("stopped");
      }
    } catch {
      toast({
        variant: "destructive",
        title: "Failed to start Ollama",
        description: "Network error.",
      });
      setServerStatus("stopped");
    }
  };

  const handleStopServer = async () => {
    setServerStatus("stopping");
    try {
      await fetch("/api/ollama/stop", { method: "POST" });
      setServerStatus("stopped");
      setRunningModelName("");
    } catch {
      setServerStatus("unknown");
    }
  };

  // --- Model Management ---

  const fetchOllamaModels = async () => {
    setIsLoadingModels(true);
    setFetchError("");
    try {
      const { fetchInstalledModels } = await import("@/utils/ai.utils");
      const result = await fetchInstalledModels();
      if (result.error) {
        setFetchError(result.error);
      } else {
        setOllamaModels(result.models);
      }
      // Check for running model
      await fetchRunningModel();
    } catch (error) {
      console.error("Error fetching Ollama models:", error);
      setFetchError("Failed to fetch Ollama models.");
    } finally {
      setIsLoadingModels(false);
    }
  };

  const fetchRunningModel = async () => {
    setRunningModelError("");
    setRunningModelName("");
    try {
      const { fetchRunningModels } = await import("@/utils/ai.utils");
      const result = await fetchRunningModels();
      if (result.models.length > 0) {
        const name = result.models[0];
        setRunningModelName(name);
        setSelectedModel((prev) => ({
          ...prev,
          provider: AiProvider.OLLAMA,
          model: name,
        }));
      }
    } catch (error) {
      console.error("Error fetching running model:", error);
    }
  };

  const handleLoadModel = async (modelName: string) => {
    setIsLoadingModel(true);
    setRunningModelError("");
    setRunningModelName("");
    try {
      const { loadOllamaModel } = await import("@/utils/ai.utils");
      const result = await loadOllamaModel(modelName);
      if (result.success) {
        setRunningModelName(modelName);
      } else {
        setRunningModelError(result.error || "Failed to load model");
      }
    } catch {
      setRunningModelError("Failed to load model");
    } finally {
      setIsLoadingModel(false);
    }
  };

  const handleUnloadModel = async () => {
    if (!runningModelName) return;
    try {
      const { unloadOllamaModel } = await import("@/utils/ai.utils");
      await unloadOllamaModel(runningModelName);
      setRunningModelName("");
    } catch {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to unload model.",
      });
    }
  };

  const handleDeleteModel = async (modelName: string) => {
    try {
      // Unload first if running
      if (runningModelName === modelName) {
        const { unloadOllamaModel } = await import("@/utils/ai.utils");
        await unloadOllamaModel(modelName);
        setRunningModelName("");
      }
      const { deleteOllamaModel } = await import("@/utils/ai.utils");
      const result = await deleteOllamaModel(modelName);
      if (result.success) {
        setOllamaModels((prev) => prev.filter((m) => m !== modelName));
        if (selectedModel.model === modelName) {
          setSelectedModel((prev) => ({ ...prev, model: undefined }));
        }
        toast({
          variant: "success",
          description: `${modelName} deleted.`,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Delete failed",
          description: result.error,
        });
      }
    } catch {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete model.",
      });
    }
  };

  // --- Pull Model ---

  const handlePullModel = async () => {
    if (!pullModelName.trim()) return;
    setIsPulling(true);
    setPullProgress(0);
    setPullStatusText("Starting download...");
    pullAbortRef.current = new AbortController();

    try {
      const { pullOllamaModel } = await import("@/utils/ai.utils");
      const result = await pullOllamaModel(
        pullModelName.trim(),
        (progress: PullProgress) => {
          setPullStatusText(progress.status);
          if (progress.total && progress.completed) {
            setPullProgress(
              Math.round((progress.completed / progress.total) * 100),
            );
          }
        },
        pullAbortRef.current.signal,
      );

      if (result.success) {
        toast({
          variant: "success",
          description: `${pullModelName.trim()} downloaded successfully.`,
        });
        setPullModelName("");
        // Refresh models list
        await fetchOllamaModels();
        // Auto-select and load the new model
        const name = pullModelName.trim();
        setSelectedModel((prev) => ({ ...prev, model: name }));
        await handleLoadModel(name);
      } else {
        toast({
          variant: "destructive",
          title: "Pull failed",
          description: result.error,
        });
      }
    } catch {
      toast({
        variant: "destructive",
        title: "Pull failed",
        description: "Network error.",
      });
    } finally {
      setIsPulling(false);
      setPullProgress(0);
      setPullStatusText("");
      pullAbortRef.current = null;
    }
  };

  const handleCancelPull = () => {
    pullAbortRef.current?.abort();
  };

  // --- Model Selection ---

  const setSelectedProvider = (provider: AiProvider) => {
    setSelectedModel((prev) => ({ ...prev, provider, model: undefined }));
    setFetchError("");
    setRunningModelError("");
    setRunningModelName("");
  };

  const setSelectedProviderModel = async (model: string) => {
    setSelectedModel((prev) => ({ ...prev, model }));
    setRunningModelName("");
    setRunningModelError("");

    if (selectedModel.provider === AiProvider.OLLAMA) {
      await handleLoadModel(model);
    }
  };

  // --- Lifecycle ---

  useEffect(() => {
    const savedSettings = getFromLocalStorage("aiSettings", selectedModel);
    setSelectedModel(savedSettings);
    if (savedSettings.numCtx) {
      setNumCtx(savedSettings.numCtx);
    }
    const savedPipeline = getFromLocalStorage("pipelineSettings", defaultPipelineSettings);
    setCleaningMethod(savedPipeline.cleaningMethod);
    setFetchMethod(savedPipeline.fetchMethod);
    setIsInitialized(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isInitialized && selectedModel.provider === AiProvider.OLLAMA) {
      checkServerStatus();
      fetchOllamaModels();
    }
    if (isInitialized && selectedModel.provider === AiProvider.DEEPSEEK) {
      fetchDeepseekModels();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedModel.provider, isInitialized]);

  const fetchDeepseekModels = async () => {
    setIsLoadingModels(true);
    setFetchError("");
    try {
      const response = await fetch("/api/ai/deepseek/models");
      if (!response.ok) {
        setDeepseekModels(Object.values(DeepseekModel));
        return;
      }
      const data: DeepseekModelResponse = await response.json();
      const modelNames = data.data.map((model) => model.id);
      setDeepseekModels(
        modelNames.length > 0 ? modelNames : Object.values(DeepseekModel),
      );
    } catch (error) {
      console.error("Error fetching DeepSeek models:", error);
      setDeepseekModels(Object.values(DeepseekModel));
    } finally {
      setIsLoadingModels(false);
    }
  };

  const getModelsList = (provider: AiProvider) => {
    switch (provider) {
      case AiProvider.OLLAMA:
        return ollamaModels.map((model) => [model, model]);
      case AiProvider.OPENAI:
        return Object.entries(OpenaiModel);
      case AiProvider.DEEPSEEK:
        return deepseekModels.map((model) => [model, model]);
      default:
        return [];
    }
  };

  const saveModelSettings = () => {
    if (!selectedModel.model) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select a model to save.",
      });
      return;
    }
    const settingsToSave: AiModel = {
      ...selectedModel,
      numCtx:
        selectedModel.provider === AiProvider.OLLAMA ? numCtx : undefined,
    };
    saveToLocalStorage("aiSettings", settingsToSave);
    saveToLocalStorage("pipelineSettings", { cleaningMethod, fetchMethod });
    toast({
      variant: "success",
      title: "Saved!",
      description: "AI Settings saved successfully.",
    });
  };

  const isOllama = selectedModel.provider === AiProvider.OLLAMA;

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Settings</CardTitle>
      </CardHeader>
      <CardContent className="ml-4 space-y-6">
        {/* Provider Selection */}
        <div>
          <Label className="my-4" htmlFor="ai-provider">
            AI Service Provider
          </Label>
          <Select
            value={selectedModel.provider}
            onValueChange={setSelectedProvider}
          >
            <SelectTrigger
              id="ai-provider"
              aria-label="Select AI provider"
              className="w-[180px]"
            >
              <SelectValue placeholder="Select AI Service Provider" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {Object.entries(AiProvider).map(([key, value]) => (
                  <SelectItem key={key} value={value} className="capitalize">
                    {value}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        {/* Ollama Server Status */}
        {isOllama && (
          <div className="rounded-md border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className={`h-2.5 w-2.5 rounded-full ${
                    serverStatus === "running"
                      ? "bg-green-500"
                      : serverStatus === "starting" ||
                          serverStatus === "stopping"
                        ? "bg-yellow-500 animate-pulse"
                        : "bg-red-500"
                  }`}
                />
                <span className="text-sm font-medium">
                  {serverStatus === "running"
                    ? `Ollama running on port ${serverPort}`
                    : serverStatus === "starting"
                      ? "Starting..."
                      : serverStatus === "stopping"
                        ? "Stopping..."
                        : "Ollama not running"}
                </span>
              </div>
              <div className="flex gap-1">
                {serverStatus !== "running" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleStartServer}
                    disabled={
                      serverStatus === "starting" ||
                      serverStatus === "stopping"
                    }
                  >
                    <Power className="h-3.5 w-3.5 mr-1" />
                    Start
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleStopServer}
                    disabled={serverStatus === "stopping"}
                  >
                    <PowerOff className="h-3.5 w-3.5 mr-1" />
                    Stop
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Model Selection */}
        <div>
          <Label className="my-4" htmlFor="ai-model">
            Model
          </Label>
          <div className="flex items-start gap-2">
            <Select
              value={selectedModel.model}
              onValueChange={setSelectedProviderModel}
              disabled={isLoadingModels || (isOllama && serverStatus !== "running")}
            >
              <SelectTrigger
                id="ai-model"
                aria-label="Select Model"
                className="w-[220px]"
              >
                <SelectValue
                  placeholder={
                    isLoadingModels ? "Loading models..." : "Select AI Model"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {getModelsList(selectedModel.provider).map(([key, value]) => (
                    <SelectItem key={key} value={value} className="capitalize">
                      {value}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>

            {/* Delete model button (Ollama only) */}
            {isOllama && selectedModel.model && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete model?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently remove{" "}
                      <strong>{selectedModel.model}</strong> from disk. You can
                      re-download it later.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => handleDeleteModel(selectedModel.model!)}
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>

          {fetchError && (
            <div className="flex items-center gap-1 text-red-600 text-sm mt-2">
              <XCircle className="h-4 w-4 flex-shrink-0" />
              <span>{fetchError}</span>
            </div>
          )}

          {/* Model status indicators */}
          {isLoadingModel && (
            <div className="flex items-center gap-1 text-yellow-600 text-sm mt-2">
              <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
              <span>Loading {selectedModel.model}...</span>
            </div>
          )}
          {!isLoadingModel && runningModelName && (
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-1 text-green-600 text-sm">
                <CheckCircle className="h-4 w-4 flex-shrink-0" />
                <span>{runningModelName} is loaded</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs text-muted-foreground"
                onClick={handleUnloadModel}
              >
                <Square className="h-3 w-3 mr-1" />
                Unload
              </Button>
            </div>
          )}
          {!isLoadingModel && runningModelError && (
            <div className="flex items-center gap-1 text-red-600 text-sm mt-2">
              <XCircle className="h-4 w-4 flex-shrink-0" />
              <span>{runningModelError}</span>
            </div>
          )}
        </div>

        {/* Context Length (Ollama only) */}
        {isOllama && (
          <div>
            <Label className="my-4" htmlFor="context-length">
              Context Length
            </Label>
            <Select
              value={String(numCtx)}
              onValueChange={(v) => setNumCtx(Number(v))}
            >
              <SelectTrigger
                id="context-length"
                aria-label="Select context length"
                className="w-[180px]"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {CONTEXT_LENGTH_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={String(opt)}>
                      {opt.toLocaleString()} tokens
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Higher values allow longer inputs but use more memory.
            </p>
          </div>
        )}

        {/* Pull New Model (Ollama only) */}
        {isOllama && serverStatus === "running" && (
          <div className="rounded-md border p-3 space-y-2">
            <Label className="text-sm font-medium">Download New Model</Label>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Model name (e.g. mistral, llama3.1:8b)"
                value={pullModelName}
                onChange={(e) => setPullModelName(e.target.value)}
                disabled={isPulling}
                className="flex-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && pullModelName.trim()) {
                    handlePullModel();
                  }
                }}
              />
              {!isPulling ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePullModel}
                  disabled={!pullModelName.trim()}
                >
                  <Download className="h-3.5 w-3.5 mr-1" />
                  Pull
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancelPull}
                >
                  Cancel
                </Button>
              )}
            </div>
            {isPulling && (
              <div className="space-y-1">
                <Progress value={pullProgress} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  {pullStatus}
                  {pullProgress > 0 && ` (${pullProgress}%)`}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Pipeline Settings */}
        <div className="rounded-md border p-3 space-y-4">
          <Label className="text-sm font-medium">Pipeline Settings</Label>

          <div>
            <Label className="text-xs text-muted-foreground" htmlFor="cleaning-method">
              Content Cleaning
            </Label>
            <Select
              value={cleaningMethod}
              onValueChange={(v) => setCleaningMethod(v as CleaningMethod)}
            >
              <SelectTrigger
                id="cleaning-method"
                aria-label="Select cleaning method"
                className="w-[280px]"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="readability">
                    Readability (recommended)
                  </SelectItem>
                  <SelectItem value="html-strip">
                    Basic HTML strip
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Readability extracts the main article content, removing navigation and ads.
            </p>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground" htmlFor="fetch-method">
              Page Fetching
            </Label>
            <Select
              value={fetchMethod}
              onValueChange={(v) => setFetchMethod(v as FetchMethod)}
            >
              <SelectTrigger
                id="fetch-method"
                aria-label="Select fetch method"
                className="w-[280px]"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="standard">
                    Standard fetch only
                  </SelectItem>
                  <SelectItem value="standard-with-fallback">
                    Standard + browser fallback (recommended)
                  </SelectItem>
                  <SelectItem value="always-playwright">
                    Always use browser
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Browser fallback handles JavaScript-rendered pages. Requires Chromium installed.
            </p>
          </div>
        </div>

        {/* Save Button */}
        <Button
          onClick={saveModelSettings}
          disabled={
            !selectedModel.model ||
            (isOllama && !runningModelName) ||
            isLoadingModels ||
            isLoadingModel
          }
        >
          Save
        </Button>
      </CardContent>
    </Card>
  );
}

export default AiSettings;
