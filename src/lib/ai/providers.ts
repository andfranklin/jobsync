import { createOpenAI } from "@ai-sdk/openai";
import { createOllama } from "ollama-ai-provider-v2";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { getOllamaBaseUrl } from "@/utils/ai.utils";

export type ProviderType = "openai" | "ollama" | "deepseek";

/**
 * Get a language model instance for the specified provider and model.
 * For Ollama, numCtx sets the context window size (passed as num_ctx option).
 */
export function getModel(
  provider: ProviderType,
  modelName: string,
  numCtx?: number,
) {
  if (provider === "openai") {
    const openai = createOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    return openai(modelName);
  }

  if (provider === "deepseek") {
    const deepseek = createDeepSeek({
      apiKey: process.env.DEEPSEEK_API_KEY,
    });
    return deepseek(modelName);
  }

  const ollama = createOllama({
    baseURL: getOllamaBaseUrl() + "/api",
  });

  if (numCtx) {
    return ollama.chat(modelName, { options: { num_ctx: numCtx } });
  }

  return ollama(modelName);
}
