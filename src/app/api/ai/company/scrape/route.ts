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
import { extractFaviconUrl, downloadFavicon } from "@/lib/scraping/favicon-extractor";

const FETCH_TIMEOUT_MS = 15000;
const DESCRIPTION_TEMPERATURE = 0.3;

const CompanyDescriptionSchema = z.object({
  description: z.string().describe("HTML summary of the company"),
});

/**
 * Company Auto-fill Endpoint
 * Fetches a career page URL, extracts company name + favicon,
 * and generates an AI company description — all in one call.
 */
export const POST = async (req: NextRequest) => {
  const authResult = await authenticateAndRateLimit();
  if (!authResult.success) return authResult.response;

  const { url, selectedModel } = (await req.json()) as {
    url: string;
    selectedModel: AiModel;
  };

  if (!url) {
    return NextResponse.json(
      { error: "Career page URL is required." },
      { status: 400 },
    );
  }

  if (!selectedModel) {
    return NextResponse.json(
      { error: "Model selection is required." },
      { status: 400 },
    );
  }

  try {
    new URL(url);
  } catch {
    return NextResponse.json(
      { error: "Invalid URL format." },
      { status: 400 },
    );
  }

  try {
    // 1. Fetch the page
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let html: string;
    try {
      const response = await fetch(url, {
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
          { error: `Failed to fetch the page (HTTP ${response.status}).` },
          { status: 422 },
        );
      }

      html = await response.text();
    } finally {
      clearTimeout(timeout);
    }

    // 2. Extract company name — prefer og:site_name meta tag over <title>
    const ogSiteNameMatch =
      html.match(/<meta\s+[^>]*property=["']og:site_name["'][^>]*content=["']([^"']+)["']/i) ||
      html.match(/<meta\s+[^>]*content=["']([^"']+)["'][^>]*property=["']og:site_name["']/i);
    const appNameMatch =
      html.match(/<meta\s+[^>]*name=["']application-name["'][^>]*content=["']([^"']+)["']/i) ||
      html.match(/<meta\s+[^>]*content=["']([^"']+)["'][^>]*name=["']application-name["']/i);

    let name: string;
    if (ogSiteNameMatch?.[1]) {
      name = ogSiteNameMatch[1].trim();
    } else if (appNameMatch?.[1]) {
      name = appNameMatch[1].trim();
    } else {
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const rawTitle = titleMatch?.[1]?.trim() || "";
      name = rawTitle
        // Strip common career-page prefixes
        .replace(/^(find\s+your\s+next\s+career\s*[@at]*|careers?\s*(at|@)|jobs?\s*(at|@)|join\s+us?\s*(at|@)?|work\s+at)\s*/i, "")
        // Strip common suffixes
        .replace(/\s*[-|–—·•]\s*(careers?|jobs?|hiring|open\s+positions|work\s+with\s+us|join\s+us|about|home).*$/i, "")
        .replace(/\s*[-|–—]\s*$/, "")
        .trim();
    }

    // 3. Extract and download favicon
    const faviconUrl = extractFaviconUrl(html, url);
    const companyValue = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const logoUrl = await downloadFavicon(faviconUrl, companyValue || "unknown");

    // 4. Clean content and generate AI description
    let description: string | null = null;
    const pageText = extractMainContent(html);

    if (pageText.length >= 100) {
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

      description = result.object.description;
    }

    return NextResponse.json({
      name: name || null,
      logoUrl,
      description,
    });
  } catch (error) {
    return handleAiError(error, selectedModel.provider);
  }
};
