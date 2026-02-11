import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { generateObject } from "ai";
import { z } from "zod";
import { getModel } from "@/lib/ai/providers";
import {
  COMPANY_DESCRIBE_SYSTEM_PROMPT,
  buildCompanyDescribePrompt,
  extractMainContent,
} from "@/lib/ai";
import { authenticateAndRateLimit, handleAiError } from "@/lib/ai/route-helpers";
import { getTextLimit } from "@/lib/ai/config";
import { AiModel } from "@/models/ai.model";
import { getCompanyById, updateCompanyDescription } from "@/actions/company.actions";

const FETCH_TIMEOUT_MS = 15000;
const DESCRIPTION_TEMPERATURE = 0.3;

const CompanyDescriptionSchema = z.object({
  description: z.string().describe("HTML summary of the company"),
});

/**
 * Regenerate Company Description Endpoint
 * Re-fetches the career page and generates a new AI description.
 */
export const POST = async (req: NextRequest) => {
  const authResult = await authenticateAndRateLimit();
  if (!authResult.success) return authResult.response;

  const { companyId, selectedModel } = (await req.json()) as {
    companyId: string;
    selectedModel: AiModel;
  };

  if (!companyId || !selectedModel) {
    return NextResponse.json(
      { error: "Company ID and model selection are required." },
      { status: 400 },
    );
  }

  try {
    const company = await getCompanyById(companyId);
    if (!company?.careerPageUrl) {
      return NextResponse.json(
        { error: "Company has no career page URL configured." },
        { status: 400 },
      );
    }

    // Fetch the career page
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let html: string;
    try {
      const response = await fetch(company.careerPageUrl, {
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; JobSync/1.0; +https://github.com/jobsync)",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      });

      if (!response.ok) {
        return NextResponse.json(
          { error: `Failed to fetch career page (HTTP ${response.status}).` },
          { status: 422 },
        );
      }

      html = await response.text();
    } finally {
      clearTimeout(timeout);
    }

    const pageText = extractMainContent(html);

    if (pageText.length < 100) {
      return NextResponse.json(
        { error: "Not enough content found on the career page to generate a description." },
        { status: 422 },
      );
    }

    const modelName = selectedModel.model || "llama3.2";
    const numCtx = selectedModel.numCtx ?? 8192;
    const maxTextLength = getTextLimit(selectedModel.provider, numCtx);

    const truncatedText =
      pageText.length > maxTextLength
        ? pageText.substring(0, maxTextLength)
        : pageText;

    const model = getModel(
      selectedModel.provider,
      modelName,
      selectedModel.numCtx,
    );

    const result = await generateObject({
      model,
      schema: CompanyDescriptionSchema,
      system: COMPANY_DESCRIBE_SYSTEM_PROMPT,
      prompt: buildCompanyDescribePrompt(truncatedText),
      temperature: DESCRIPTION_TEMPERATURE,
    });

    // Save to database
    await updateCompanyDescription(companyId, result.object.description);

    return NextResponse.json({ description: result.object.description });
  } catch (error) {
    return handleAiError(error, selectedModel.provider);
  }
};
