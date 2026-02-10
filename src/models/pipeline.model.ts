import type { AiProvider } from "./ai.model";

export interface PipelineConfig {
  cleaner: "readability" | "html-strip";
  model: string;
  provider: AiProvider;
  numCtx: number;
  temperature: number;
  maxInputChars: number;
}

export type PipelineStatus = "pending" | "cleaned" | "extracted" | "failed";

export type CleaningMethod = "readability" | "html-strip";
export type FetchMethod = "standard" | "standard-with-fallback" | "always-playwright";

export interface PipelineSettings {
  cleaningMethod: CleaningMethod;
  fetchMethod: FetchMethod;
}

export const defaultPipelineSettings: PipelineSettings = {
  cleaningMethod: "readability",
  fetchMethod: "standard-with-fallback",
};
