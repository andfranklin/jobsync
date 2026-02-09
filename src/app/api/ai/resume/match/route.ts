import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { streamText, Output } from "ai";
import { getModel } from "@/lib/ai/providers";
import {
  JobMatchSchema,
  JOB_MATCH_SYSTEM_PROMPT,
  buildJobMatchPrompt,
  preprocessResume,
  preprocessJob,
} from "@/lib/ai";
import { authenticateAndRateLimit, handleAiError } from "@/lib/ai/route-helpers";
import { getResumeById } from "@/actions/profile.actions";
import { getJobDetails } from "@/actions/job.actions";
import { AiModel } from "@/models/ai.model";

/**
 * Job Match Endpoint
 * Single comprehensive LLM call for resume-job matching
 */
export const POST = async (req: NextRequest) => {
  const authResult = await authenticateAndRateLimit();
  if (!authResult.success) return authResult.response;

  const { resumeId, jobId, selectedModel } = (await req.json()) as {
    resumeId: string;
    jobId: string;
    selectedModel: AiModel;
  };

  if (!resumeId || !jobId || !selectedModel) {
    return NextResponse.json(
      { error: "Resume ID, Job ID, and model selection required" },
      { status: 400 },
    );
  }

  try {
    const [{ data: resume }, { job }] = await Promise.all([
      getResumeById(resumeId),
      getJobDetails(jobId),
    ]);

    // Preprocess both resume and job description
    const [resumePreprocessResult, jobPreprocessResult] = await Promise.all([
      preprocessResume(resume),
      preprocessJob(job),
    ]);

    if (!resumePreprocessResult.success) {
      return NextResponse.json(
        {
          error: resumePreprocessResult.error.message,
          code: resumePreprocessResult.error.code,
        },
        { status: 400 },
      );
    }

    if (!jobPreprocessResult.success) {
      return NextResponse.json(
        {
          error: jobPreprocessResult.error.message,
          code: jobPreprocessResult.error.code,
        },
        { status: 400 },
      );
    }

    const { normalizedText: resumeText } = resumePreprocessResult.data;
    const { normalizedText: jobText } = jobPreprocessResult.data;

    const model = getModel(
      selectedModel.provider,
      selectedModel.model || "llama3.2",
    );

    // Single comprehensive LLM call
    const result = streamText({
      model,
      output: Output.object({
        schema: JobMatchSchema,
      }),
      system: JOB_MATCH_SYSTEM_PROMPT,
      prompt: buildJobMatchPrompt(resumeText, jobText),
      temperature: 0.3,
    });

    return result.toTextStreamResponse();
  } catch (error) {
    return handleAiError(error, selectedModel.provider);
  }
};
