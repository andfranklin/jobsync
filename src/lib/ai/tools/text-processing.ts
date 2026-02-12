/**
 * Shared Text Processing Utilities
 * Used by both resume and job preprocessing modules
 * Extracted from preprocessing.ts to enable code reuse
 */

import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";

// HTML AND WHITESPACE NORMALIZATION

export const removeHtmlTags = (description: string | undefined): string => {
  if (!description) return "";

  return description
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<\/(li|p|div|br)[^>]*>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\n\s*\n/g, "\n")
    .trim();
};

export const normalizeWhitespace = (text: string): string => {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

export const normalizeBullets = (text: string): string => {
  return text
    .replace(/[•●○◦▪▸►◆★✦✓✔→‣⁃]/g, "•")
    .replace(/^[-–—]\s/gm, "• ")
    .replace(/^\*\s/gm, "• ");
};

export const normalizeHeadings = (text: string): string => {
  return text
    .replace(/^([A-Z][A-Z\s&]+):?\s*$/gm, (_match, heading) => {
      const normalized = heading.trim().replace(/:$/, "");
      return `\n${normalized}\n`;
    })
    .replace(/\n{3,}/g, "\n\n");
};

// METADATA EXTRACTION

export interface TextMetadata {
  characterCount: number;
  wordCount: number;
  lineCount: number;
  hasContactInfo: boolean;
}

export const extractMetadata = (text: string): TextMetadata => {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  const lines = text.split("\n");

  return {
    characterCount: text.length,
    wordCount: words.length,
    lineCount: lines.length,
    hasContactInfo: hasContactPatterns(text),
  };
};

const hasContactPatterns = (text: string): boolean => {
  const emailPattern = /[\w.-]+@[\w.-]+\.\w+/;
  const phonePattern = /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/;
  return emailPattern.test(text) || phonePattern.test(text);
};

// FULL-PAGE HTML TEXT EXTRACTION

/**
 * Extracts readable text from a full HTML page.
 * Preserves JSON-LD structured data (used by many job sites for SEO),
 * then removes script/style blocks and strips remaining HTML tags.
 * Designed for scraping web pages before sending to AI for analysis.
 */
export const extractTextFromHtml = (html: string): string => {
  if (!html) return "";
  let text = html;

  // Extract JSON-LD structured data before stripping scripts.
  // Many job sites (Meta, LinkedIn, etc.) embed all job content in
  // <script type="application/ld+json"> tags following the Schema.org
  // JobPosting format. This data is stripped when we remove <script> tags,
  // so we extract it first and prepend it to the output.
  const jsonLdBlocks: string[] = [];
  const jsonLdRegex =
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = jsonLdRegex.exec(text)) !== null) {
    jsonLdBlocks.push(match[1].trim());
  }
  const jsonLdText = jsonLdBlocks.join("\n");

  // Remove all script and style blocks
  text = text.replace(/<script[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<style[\s\S]*?<\/style>/gi, "");

  // Strip remaining HTML tags
  const htmlText = removeHtmlTags(text);

  // Combine: JSON-LD first (structured data), then page text
  return jsonLdText ? `${jsonLdText}\n${htmlText}`.trim() : htmlText;
};

// SALARY EXTRACTION FROM JSON-LD

export interface JsonLdSalary {
  min?: number;
  max?: number;
}

/**
 * Parses JSON-LD structured data from HTML to extract salary information.
 * Handles Schema.org JobPosting format with baseSalary or estimatedSalary fields.
 */
export const extractSalaryFromJsonLd = (html: string): JsonLdSalary => {
  const jsonLdRegex =
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = jsonLdRegex.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1].trim());
      const result = parseSalaryFromJsonLdObject(data);
      if (result.min != null || result.max != null) return result;
    } catch {
      // Invalid JSON — skip this block
    }
  }
  return {};
};

const parseSalaryFromJsonLdObject = (data: any): JsonLdSalary => {
  // Handle @graph arrays (some sites wrap JobPosting in a graph)
  if (data?.["@graph"] && Array.isArray(data["@graph"])) {
    for (const item of data["@graph"]) {
      const result = parseSalaryFromJsonLdObject(item);
      if (result.min != null || result.max != null) return result;
    }
  }

  // Only process JobPosting types (handle both string and array formats)
  const rawType = data?.["@type"];
  const type = Array.isArray(rawType) ? rawType[0] : rawType;
  if (type !== "JobPosting" && type !== "jobPosting") return {};

  // Try baseSalary first, then estimatedSalary
  const salary = data.baseSalary || data.estimatedSalary;
  if (!salary) return {};

  // Handle array format (estimatedSalary can be an array)
  const salaryObj = Array.isArray(salary) ? salary[0] : salary;
  if (!salaryObj) return {};

  // Extract from nested value object or direct properties
  const value = salaryObj.value || salaryObj;
  const min = value?.minValue ?? value?.value;
  const max = value?.maxValue ?? value?.value;

  return {
    min: typeof min === "number" ? min : undefined,
    max: typeof max === "number" ? max : undefined,
  };
};

/**
 * Regex-based salary extraction from raw HTML.
 * Strips HTML tags and decodes entities first, then searches for salary
 * range patterns like "$128,000 - $240,000" in the cleaned text.
 * Used as a second fallback when JSON-LD doesn't contain salary data.
 */
export const extractSalaryFromHtml = (html: string): JsonLdSalary => {
  if (!html) return {};

  // Strip HTML tags and decode entities so regex sees clean text
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");

  // Try range pattern first (most precise)
  const rangePattern =
    /\$(\d{1,3}(?:,\d{3})+)(?:\.\d{2})?\s*[-–—]\s*\$(\d{1,3}(?:,\d{3})+)(?:\.\d{2})?/i;
  const rangeMatch = rangePattern.exec(text);
  if (rangeMatch) {
    const min = parseInt(rangeMatch[1].replace(/,/g, ""), 10);
    const max = parseInt(rangeMatch[2].replace(/,/g, ""), 10);
    if (min >= 30000 && max >= min) return { min, max };
  }

  // Fallback: collect all salary-like dollar amounts
  const amountPattern = /\$(\d{1,3}(?:,\d{3})+)/g;
  const amounts: number[] = [];
  let match;
  while ((match = amountPattern.exec(text)) !== null) {
    const val = parseInt(match[1].replace(/,/g, ""), 10);
    if (val >= 30000 && val <= 999000) amounts.push(val);
  }
  if (amounts.length >= 2) {
    return { min: Math.min(...amounts), max: Math.max(...amounts) };
  }

  return {};
};

// SALARY PRESERVATION

/**
 * Scans the original HTML for dollar amounts that Readability stripped
 * (typically from footers, legal disclosures, or sidebars) and prepends
 * them to the cleaned text so the AI model can find salary information.
 */
const preserveSalaryInfo = (html: string, cleanedText: string): string => {
  const salaryPattern = /\$\d{1,3}(?:,\d{3})+(?:\.\d{2})?/g;
  const amounts = [...new Set(html.match(salaryPattern) || [])];

  if (amounts.length === 0) return cleanedText;

  const missingAmounts = amounts.filter((a) => !cleanedText.includes(a));
  if (missingAmounts.length === 0) return cleanedText;

  return `Compensation: ${missingAmounts.join(" – ")}\n\n${cleanedText}`;
};

// READABILITY-BASED CONTENT EXTRACTION

/**
 * Extracts the main content from HTML using Mozilla Readability.
 * Removes navigation, footers, ads, and other non-content elements.
 * Falls back to extractTextFromHtml() if Readability can't find main content.
 *
 * Also preserves JSON-LD structured data (Schema.org JobPosting, etc.)
 * since Readability strips <script> tags.
 */
export const extractMainContent = (html: string): string => {
  if (!html) return "";

  // Extract JSON-LD before Readability strips scripts
  const jsonLdBlocks: string[] = [];
  const jsonLdRegex =
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = jsonLdRegex.exec(html)) !== null) {
    jsonLdBlocks.push(match[1].trim());
  }
  const jsonLdText = jsonLdBlocks.join("\n");

  try {
    const dom = new JSDOM(html, { url: "https://example.com" });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    if (article && article.textContent && article.textContent.trim().length > 100) {
      const cleaned = normalizeWhitespace(article.textContent);
      const withSalary = preserveSalaryInfo(html, cleaned);
      return jsonLdText ? `${jsonLdText}\n${withSalary}`.trim() : withSalary;
    }
  } catch {
    // Readability failed — fall through to basic extraction
  }

  return extractTextFromHtml(html);
};

// VALIDATION HELPERS

export interface ValidationError {
  code: string;
  message: string;
  details?: object;
}

export interface ValidationResult {
  isValid: boolean;
  error?: ValidationError;
}

/**
 * Generic text validation - checks for empty content and basic corruption
 * @param text - Text to validate
 * @param minCharCount - Minimum character count required
 * @param maxCharCount - Maximum character count allowed
 * @param contextLabel - Label for error messages (e.g., "Resume", "Job description")
 */
export const validateText = (
  text: string,
  minCharCount: number = 200,
  maxCharCount: number = 50000,
  contextLabel: string = "Content",
): ValidationResult => {
  // Check for empty content
  if (!text || text.trim().length === 0) {
    return {
      isValid: false,
      error: {
        code: "NO_CONTENT",
        message: `${contextLabel} appears to be empty or contains only whitespace`,
      },
    };
  }

  // Check minimum length
  if (text.length < minCharCount) {
    return {
      isValid: false,
      error: {
        code: "TOO_SHORT",
        message: `${contextLabel} is too short. Found ${text.length} characters, minimum required: ${minCharCount} characters.`,
        details: {
          characterCount: text.length,
          minCharCount,
        },
      },
    };
  }

  // Check maximum length
  if (text.length > maxCharCount) {
    return {
      isValid: false,
      error: {
        code: "TOO_LONG",
        message: `${contextLabel} is too long. Found ${text.length} characters, maximum allowed: ${maxCharCount} characters.`,
        details: {
          characterCount: text.length,
          maxCharCount,
        },
      },
    };
  }

  // Check for corruption - consecutive special characters
  const MAX_CONSECUTIVE_SPECIAL_CHARS = 20;
  const specialCharPattern = new RegExp(
    `[^a-zA-Z0-9\\s]{${MAX_CONSECUTIVE_SPECIAL_CHARS + 1},}`,
  );
  if (specialCharPattern.test(text)) {
    return {
      isValid: false,
      error: {
        code: "CORRUPTED",
        message: `${contextLabel} appears to be corrupted. Found excessive consecutive special characters.`,
        details: {
          maxConsecutiveSpecialChars: MAX_CONSECUTIVE_SPECIAL_CHARS,
        },
      },
    };
  }

  return { isValid: true };
};
