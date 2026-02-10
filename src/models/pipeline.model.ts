import { createHash } from "crypto";
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

export function hashPipelineConfig(config: PipelineConfig): string {
  const canonical = JSON.stringify(config, Object.keys(config).sort());
  return createHash("sha256").update(canonical).digest("hex");
}
