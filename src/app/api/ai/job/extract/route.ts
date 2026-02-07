import "server-only";

import { getCurrentUser } from "@/utils/user.utils";
import { NextRequest, NextResponse } from "next/server";
import { generateObject } from "ai";
import { getModel } from "@/lib/ai/providers";
import { checkRateLimit } from "@/lib/ai/rate-limiter";
import {
  JOB_EXTRACT_SYSTEM_PROMPT,
  buildJobExtractPrompt,
  extractTextFromHtml,
  AIUnavailableError,
} from "@/lib/ai";
import { JobExtractionSchema } from "@/models/jobExtraction.schema";
import { AiModel } from "@/models/ai.model";

const MAX_TEXT_LENGTH = 15000;
const FETCH_TIMEOUT_MS = 15000;

/**
 * Job Extraction Endpoint
 * Fetches a job posting URL (or accepts pasted content), extracts text,
 * and uses AI to parse structured job data.
 */
export const POST = async (req: NextRequest) => {
  const user = await getCurrentUser();
  const userId = user?.id;

  if (!userId) {
    return NextResponse.json(
      { error: "No user found. Run the seed script." },
      { status: 500 },
    );
  }

  // Rate limiting
  const rateLimit = checkRateLimit(userId);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: `Rate limit exceeded. Try again in ${Math.ceil(
          rateLimit.resetIn / 1000,
        )} seconds.`,
      },
      { status: 429 },
    );
  }

  const { url, htmlContent, selectedModel } = (await req.json()) as {
    url?: string;
    htmlContent?: string;
    selectedModel: AiModel;
  };

  if (!selectedModel) {
    return NextResponse.json(
      { error: "Model selection is required." },
      { status: 400 },
    );
  }

  if (!url && !htmlContent) {
    return NextResponse.json(
      { error: "URL or pasted content is required." },
      { status: 400 },
    );
  }

  // Validate URL format (only when url is provided)
  if (url) {
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: "Invalid URL format." },
        { status: 400 },
      );
    }
  }

  try {
    let pageText: string;

    if (htmlContent) {
      // User pasted content directly — skip URL fetch
      pageText = extractTextFromHtml(htmlContent);
    } else {
      // Fetch the webpage
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      let response: Response;
      try {
        response = await fetch(url!, {
          signal: controller.signal,
          headers: {
            "User-Agent":
              "Mozilla/5.0 (compatible; JobSync/1.0; +https://github.com/jobsync)",
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          },
        });
      } catch (fetchError) {
        if (fetchError instanceof DOMException && fetchError.name === "AbortError") {
          return NextResponse.json(
            { error: "Request timed out. The site took too long to respond." },
            { status: 504 },
          );
        }
        return NextResponse.json(
          { error: "Could not reach the URL. Check the link and try again." },
          { status: 502 },
        );
      } finally {
        clearTimeout(timeout);
      }

      if (response.status === 403 || response.status === 429) {
        return NextResponse.json(
          {
            error:
              "This site blocked the request. Try pasting the job description manually.",
          },
          { status: 422 },
        );
      }

      if (!response.ok) {
        return NextResponse.json(
          { error: `Failed to fetch the page (HTTP ${response.status}).` },
          { status: 422 },
        );
      }

      const html = await response.text();
      pageText = extractTextFromHtml(html);
    }

    if (pageText.length < 100) {
      return NextResponse.json(
        {
          error: htmlContent
            ? "Not enough text to extract job details. Please paste more of the job posting."
            : "Could not extract enough text from this page. The site may require JavaScript or login.",
        },
        { status: 422 },
      );
    }

    // Truncate to fit context window
    if (pageText.length > MAX_TEXT_LENGTH) {
      pageText = pageText.substring(0, MAX_TEXT_LENGTH);
    }

    // Call AI for extraction
    const model = getModel(
      selectedModel.provider,
      selectedModel.model || "llama3.2",
    );

    const result = await generateObject({
      model,
      schema: JobExtractionSchema,
      system: JOB_EXTRACT_SYSTEM_PROMPT,
      prompt: buildJobExtractPrompt(pageText),
      temperature: 0.1,
    });

    return NextResponse.json(result.object);
  } catch (error) {
    console.error("Job extraction error:", error);

    if (error instanceof AIUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    const message =
      error instanceof Error ? error.message : "AI extraction failed";

    if (
      message.includes("fetch failed") ||
      message.includes("ECONNREFUSED")
    ) {
      return NextResponse.json(
        {
          error: `Cannot connect to ${selectedModel.provider} service. Please ensure the service is running.`,
        },
        { status: 503 },
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
};
