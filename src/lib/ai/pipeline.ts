import "server-only";

import { createHash } from "crypto";
import prisma from "@/lib/db";
import type { PipelineConfig, PipelineStatus } from "@/models/pipeline.model";

export function hashPipelineConfig(config: PipelineConfig): string {
  const canonical = JSON.stringify(config, Object.keys(config).sort());
  return createHash("sha256").update(canonical).digest("hex");
}

interface CreatePipelineRunParams {
  jobId?: string;
  resumeId?: string;
  sourceUrl?: string;
  rawContent: string;
  config: PipelineConfig;
}

export async function createPipelineRun({
  jobId,
  resumeId,
  sourceUrl,
  rawContent,
  config,
}: CreatePipelineRunParams) {
  return prisma.pipelineRun.create({
    data: {
      jobId,
      resumeId,
      sourceUrl,
      rawContent,
      cleanedContent: "",
      configHash: hashPipelineConfig(config),
      pipelineConfig: JSON.stringify(config),
      status: "pending" satisfies PipelineStatus,
    },
  });
}

export async function updatePipelineRunCleaned(
  id: string,
  cleanedContent: string,
) {
  return prisma.pipelineRun.update({
    where: { id },
    data: {
      cleanedContent,
      status: "cleaned" satisfies PipelineStatus,
    },
  });
}

export async function updatePipelineRunExtracted(
  id: string,
  extractedData: object,
) {
  return prisma.pipelineRun.update({
    where: { id },
    data: {
      extractedData: JSON.stringify(extractedData),
      status: "extracted" satisfies PipelineStatus,
    },
  });
}

export async function updatePipelineRunFailed(id: string, error: string) {
  return prisma.pipelineRun.update({
    where: { id },
    data: {
      error,
      status: "failed" satisfies PipelineStatus,
    },
  });
}
