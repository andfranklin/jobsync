import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { streamText, Output } from "ai";
import { getModel } from "@/lib/ai/providers";
import {
  ResumeReviewSchema,
  RESUME_REVIEW_SYSTEM_PROMPT,
  buildResumeReviewPrompt,
  preprocessResume,
} from "@/lib/ai";
import { authenticateAndRateLimit, handleAiError } from "@/lib/ai/route-helpers";
import { createPipelineRun, updatePipelineRunCleaned, updatePipelineRunFailed } from "@/lib/ai/pipeline";
import { Resume } from "@/models/profile.model";
import { AiModel } from "@/models/ai.model";
import type { PipelineConfig } from "@/models/pipeline.model";

/**
 * Resume Review Endpoint
 * Single comprehensive LLM call for complete resume analysis
 */
export const POST = async (req: NextRequest) => {
  const authResult = await authenticateAndRateLimit();
  if (!authResult.success) return authResult.response;

  const { selectedModel, resume } = (await req.json()) as {
    selectedModel: AiModel;
    resume: Resume;
  };

  if (!resume || !selectedModel) {
    return NextResponse.json(
      { error: "Resume and model selection required" },
      { status: 400 },
    );
  }

  const modelName = selectedModel.model || "llama3.2";
  let pipelineRunId: string | undefined;

  try {
    const preprocessResult = await preprocessResume(resume);
    if (!preprocessResult.success) {
      return NextResponse.json(
        {
          error: preprocessResult.error.message,
          code: preprocessResult.error.code,
        },
        { status: 400 },
      );
    }
    const { normalizedText } = preprocessResult.data;

    const pipelineConfig: PipelineConfig = {
      cleaner: "html-strip",
      model: modelName,
      provider: selectedModel.provider,
      numCtx: selectedModel.numCtx ?? 8192,
      temperature: 0.3,
      maxInputChars: normalizedText.length,
    };

    try {
      const run = await createPipelineRun({
        resumeId: resume.id,
        rawContent: JSON.stringify(resume),
        config: pipelineConfig,
      });
      pipelineRunId = run.id;
      updatePipelineRunCleaned(run.id, normalizedText).catch(() => {});
    } catch {
      // Pipeline tracking is best-effort
    }

    const model = getModel(
      selectedModel.provider,
      modelName,
      selectedModel.numCtx,
    );

    // Single comprehensive LLM call
    const result = streamText({
      model,
      output: Output.object({
        schema: ResumeReviewSchema,
      }),
      system: RESUME_REVIEW_SYSTEM_PROMPT,
      prompt: buildResumeReviewPrompt(normalizedText),
      temperature: 0.3,
    });

    return result.toTextStreamResponse();
  } catch (error) {
    if (pipelineRunId) {
      const message = error instanceof Error ? error.message : "Unknown error";
      updatePipelineRunFailed(pipelineRunId, message).catch(() => {});
    }
    return handleAiError(error, selectedModel.provider);
  }
};
