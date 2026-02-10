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
import { fetchWithPlaywright } from "@/lib/scraping/playwright-fetcher";

const FETCH_TIMEOUT_MS = 15000;
const EXTRACTION_TEMPERATURE = 0.1;
const MIN_MEANINGFUL_CONTENT_LENGTH = 500;

/**
 * Job Extraction Endpoint
 * Fetches a job posting URL (or accepts pasted content), extracts text,
 * and uses AI to parse structured job data.
 */
export const POST = async (req: NextRequest) => {
  const authResult = await authenticateAndRateLimit();
  if (!authResult.success) return authResult.response;

  const { url, htmlContent, selectedModel, pipelineSettings: rawPipelineSettings } = (await req.json()) as {
    url?: string;
    htmlContent?: string;
    selectedModel: AiModel;
    pipelineSettings?: PipelineSettings;
  };
  const pipelineSettings = rawPipelineSettings ?? defaultPipelineSettings;

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

  const modelName = selectedModel.model || "llama3.2";
  const numCtx = selectedModel.numCtx ?? 8192;
  const maxTextLength = getTextLimit(selectedModel.provider, numCtx);
  const pipelineConfig: PipelineConfig = {
    cleaner: htmlContent ? "html-strip" : pipelineSettings.cleaningMethod,
    model: modelName,
    provider: selectedModel.provider,
    numCtx,
    temperature: EXTRACTION_TEMPERATURE,
    maxInputChars: maxTextLength,
  };

  let pipelineRunId: string | undefined;

  try {
    let rawContent: string;
    let pageText: string;

    const cleanHtml = (html: string) =>
      pipelineConfig.cleaner === "readability"
        ? extractMainContent(html)
        : extractTextFromHtml(html);

    if (htmlContent) {
      // User pasted content directly — skip URL fetch
      rawContent = htmlContent;
      pageText = extractTextFromHtml(htmlContent);
    } else if (pipelineSettings.fetchMethod === "always-playwright") {
      // Skip standard fetch entirely
      try {
        rawContent = await fetchWithPlaywright(url!);
        pageText = cleanHtml(rawContent);
      } catch (playwrightError) {
        console.error("Playwright fetch failed:", playwrightError);
        return NextResponse.json(
          {
            error: "Browser fetch failed. Try pasting the job description manually.",
          },
          { status: 422 },
        );
      }
    } else {
      // Standard fetch, with optional Playwright fallback
      let needsPlaywrightFallback = false;
      let fetchErrorForFallback: string | undefined;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      try {
        const response = await fetch(url!, {
          signal: controller.signal,
          headers: {
            "User-Agent":
              "Mozilla/5.0 (compatible; JobSync/1.0; +https://github.com/jobsync)",
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          },
        });

        if (response.status === 403 || response.status === 429) {
          needsPlaywrightFallback = true;
          fetchErrorForFallback = `Site returned ${response.status}`;
        } else if (!response.ok) {
          return NextResponse.json(
            { error: `Failed to fetch the page (HTTP ${response.status}).` },
            { status: 422 },
          );
        } else {
          rawContent = await response.text();
          pageText = cleanHtml(rawContent);

          // If extracted content is suspiciously short, the page likely needs JS rendering
          if (pageText.length < MIN_MEANINGFUL_CONTENT_LENGTH) {
            needsPlaywrightFallback = true;
            fetchErrorForFallback = "Standard fetch returned minimal content";
          }
        }
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

      // Playwright fallback (only if configured)
      if (needsPlaywrightFallback && pipelineSettings.fetchMethod === "standard-with-fallback") {
        try {
          rawContent = await fetchWithPlaywright(url!);
          pageText = cleanHtml(rawContent);
        } catch (playwrightError) {
          const detail = fetchErrorForFallback
            ? ` (${fetchErrorForFallback})`
            : "";
          console.error("Playwright fallback failed:", playwrightError);
          return NextResponse.json(
            {
              error: `This site blocked the request and the browser fallback failed${detail}. Try pasting the job description manually.`,
            },
            { status: 422 },
          );
        }
      } else if (needsPlaywrightFallback && pipelineSettings.fetchMethod === "standard") {
        // Standard-only mode — return the error directly
        return NextResponse.json(
          {
            error: fetchErrorForFallback?.includes("returned")
              ? "This site blocked the request. Try pasting the job description manually."
              : "Could not extract enough text from this page. The site may require JavaScript or login.",
          },
          { status: 422 },
        );
      }
    }

    // Create pipeline run once we have raw content
    try {
      const run = await createPipelineRun({
        sourceUrl: url,
        rawContent,
        config: pipelineConfig,
      });
      pipelineRunId = run.id;
    } catch {
      // Pipeline tracking is best-effort — don't block extraction
    }

    if (pageText.length < 100) {
      if (pipelineRunId) {
        updatePipelineRunFailed(pipelineRunId, "Extracted text too short").catch(() => {});
      }
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
    if (pageText.length > maxTextLength) {
      pageText = pageText.substring(0, maxTextLength);
    }

    // Update pipeline with cleaned content
    if (pipelineRunId) {
      updatePipelineRunCleaned(pipelineRunId, pageText).catch(() => {});
    }

    // Call AI for extraction
    const model = getModel(
      selectedModel.provider,
      modelName,
      selectedModel.numCtx,
    );

    const result = await generateObject({
      model,
      schema: JobExtractionSchema,
      system: JOB_EXTRACT_SYSTEM_PROMPT,
      prompt: buildJobExtractPrompt(pageText),
      temperature: EXTRACTION_TEMPERATURE,
    });

    // Update pipeline with extracted data
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
