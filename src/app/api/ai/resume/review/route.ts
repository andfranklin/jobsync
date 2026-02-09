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
import { Resume } from "@/models/profile.model";
import { AiModel } from "@/models/ai.model";

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

    const model = getModel(
      selectedModel.provider,
      selectedModel.model || "llama3.2",
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
    return handleAiError(error, selectedModel.provider);
  }
};
