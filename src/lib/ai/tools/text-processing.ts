/**
 * Shared Text Processing Utilities
 * Used by both resume and job preprocessing modules
 * Extracted from preprocessing.ts to enable code reuse
 */

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
