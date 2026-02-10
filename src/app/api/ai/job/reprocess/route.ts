import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { generateObject } from "ai";
import { getModel } from "@/lib/ai/providers";
import {
  JOB_EXTRACT_SYSTEM_PROMPT,
  buildJobExtractPrompt,
  extractMainContent,
  extractTextFromHtml,
} from "@/lib/ai";
import { authenticateAndRateLimit, handleAiError } from "@/lib/ai/route-helpers";
import {
  createPipelineRun,
  updatePipelineRunCleaned,
  updatePipelineRunExtracted,
  updatePipelineRunFailed,
} from "@/lib/ai/pipeline";
import { JobExtractionSchema } from "@/models/jobExtraction.schema";
import { AiModel } from "@/models/ai.model";
import type { PipelineConfig, PipelineSettings } from "@/models/pipeline.model";
import { defaultPipelineSettings } from "@/models/pipeline.model";
import { getTextLimit } from "@/lib/ai/config";
import prisma from "@/lib/db";

const EXTRACTION_TEMPERATURE = 0.1;

/**
 * Re-process a job's raw content with the current pipeline configuration.
 * Retrieves the latest PipelineRun's rawContent and re-runs cleaning + extraction.
 */
export const POST = async (req: NextRequest) => {
  const authResult = await authenticateAndRateLimit();
  if (!authResult.success) return authResult.response;

  const { jobId, selectedModel, pipelineSettings: rawSettings } = (await req.json()) as {
    jobId: string;
    selectedModel: AiModel;
    pipelineSettings?: PipelineSettings;
  };
  const pipelineSettings = rawSettings ?? defaultPipelineSettings;

  if (!jobId || !selectedModel) {
    return NextResponse.json(
      { error: "Job ID and model selection are required." },
      { status: 400 },
    );
  }

  // Find the most recent pipeline run for this job
  const latestRun = await prisma.pipelineRun.findFirst({
    where: { jobId },
    orderBy: { createdAt: "desc" },
  });

  if (!latestRun || !latestRun.rawContent) {
    return NextResponse.json(
      { error: "No previous pipeline data found for this job. Cannot re-process." },
      { status: 404 },
    );
  }

  const modelName = selectedModel.model || "llama3.2";
  const numCtx = selectedModel.numCtx ?? 8192;
  const maxTextLength = getTextLimit(selectedModel.provider, numCtx);

  const pipelineConfig: PipelineConfig = {
    cleaner: pipelineSettings.cleaningMethod,
    model: modelName,
    provider: selectedModel.provider,
    numCtx,
    temperature: EXTRACTION_TEMPERATURE,
    maxInputChars: maxTextLength,
  };

  let pipelineRunId: string | undefined;

  try {
    // Clean with the configured method
    let pageText =
      pipelineSettings.cleaningMethod === "readability"
        ? extractMainContent(latestRun.rawContent)
        : extractTextFromHtml(latestRun.rawContent);

    // Create new pipeline run (preserves history)
    try {
      const run = await createPipelineRun({
        jobId,
        sourceUrl: latestRun.sourceUrl ?? undefined,
        rawContent: latestRun.rawContent,
        config: pipelineConfig,
      });
      pipelineRunId = run.id;
    } catch {
      // Best-effort
    }

    if (pageText.length < 100) {
      if (pipelineRunId) {
        updatePipelineRunFailed(pipelineRunId, "Cleaned text too short").catch(() => {});
      }
      return NextResponse.json(
        { error: "Re-processing produced insufficient text content." },
        { status: 422 },
      );
    }

    if (pageText.length > maxTextLength) {
      pageText = pageText.substring(0, maxTextLength);
    }

    if (pipelineRunId) {
      updatePipelineRunCleaned(pipelineRunId, pageText).catch(() => {});
    }

    const model = getModel(selectedModel.provider, modelName, selectedModel.numCtx);

    const result = await generateObject({
      model,
      schema: JobExtractionSchema,
      system: JOB_EXTRACT_SYSTEM_PROMPT,
      prompt: buildJobExtractPrompt(pageText),
      temperature: EXTRACTION_TEMPERATURE,
    });

    if (pipelineRunId) {
      updatePipelineRunExtracted(pipelineRunId, result.object).catch(() => {});
    }

    return NextResponse.json(result.object);
  } catch (error) {
    if (pipelineRunId) {
      const message = error instanceof Error ? error.message : "Unknown error";
      updatePipelineRunFailed(pipelineRunId, message).catch(() => {});
    }
    return handleAiError(error, selectedModel.provider);
  }
};
