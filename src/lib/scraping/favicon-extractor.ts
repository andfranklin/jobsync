import "server-only";

import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const FAVICON_CACHE_DIR = path.join(process.cwd(), "public", "images", "favicons");
const FETCH_TIMEOUT_MS = 10000;

/**
 * Extract the favicon URL from an HTML document.
 * Searches for <link rel="icon">, <link rel="shortcut icon">,
 * and <link rel="apple-touch-icon"> tags.
 * Falls back to {origin}/favicon.ico if none found.
 */
export function extractFaviconUrl(html: string, baseUrl: string): string {
  const origin = new URL(baseUrl).origin;

  // Match <link> tags with rel containing "icon"
  const linkRegex = /<link[^>]*rel=["'](?:shortcut\s+)?(?:icon|apple-touch-icon)["'][^>]*>/gi;
  const matches = html.match(linkRegex);

  if (matches) {
    // Prefer apple-touch-icon (higher quality), then icon
    const sorted = matches.sort((a, b) => {
      const aIsApple = a.includes("apple-touch-icon") ? 0 : 1;
      const bIsApple = b.includes("apple-touch-icon") ? 0 : 1;
      return aIsApple - bIsApple;
    });

    for (const tag of sorted) {
      const hrefMatch = tag.match(/href=["']([^"']+)["']/);
      if (hrefMatch?.[1]) {
        const href = hrefMatch[1];
        // Resolve relative URLs
        if (href.startsWith("//")) return `https:${href}`;
        if (href.startsWith("/")) return `${origin}${href}`;
        if (href.startsWith("http")) return href;
        return `${origin}/${href}`;
      }
    }
  }

  // Fallback to /favicon.ico
  return `${origin}/favicon.ico`;
}

/**
 * Download a favicon image and save it to the local cache directory.
 * Returns the relative URL path (e.g., "/images/favicons/google.png")
 * or null if the download fails.
 */
export async function downloadFavicon(
  faviconUrl: string,
  companyValue: string,
): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const response = await fetch(faviconUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; JobSync/1.0; +https://github.com/jobsync)",
      },
    });
    clearTimeout(timeout);

    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") || "";
    const ext = getExtensionFromContentType(contentType, faviconUrl);
    const buffer = Buffer.from(await response.arrayBuffer());

    // Ensure cache directory exists
    if (!existsSync(FAVICON_CACHE_DIR)) {
      await mkdir(FAVICON_CACHE_DIR, { recursive: true });
    }

    const filename = `${companyValue}${ext}`;
    const filePath = path.join(FAVICON_CACHE_DIR, filename);
    await writeFile(filePath, buffer);

    return `/images/favicons/${filename}`;
  } catch {
    return null;
  }
}

function getExtensionFromContentType(contentType: string, url: string): string {
  if (contentType.includes("svg")) return ".svg";
  if (contentType.includes("png")) return ".png";
  if (contentType.includes("gif")) return ".gif";
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return ".jpg";
  if (contentType.includes("x-icon") || contentType.includes("vnd.microsoft.icon")) return ".ico";

  // Fallback: check URL extension
  const urlExt = url.split("?")[0].split(".").pop()?.toLowerCase();
  if (urlExt && ["svg", "png", "gif", "jpg", "jpeg", "ico", "webp"].includes(urlExt)) {
    return `.${urlExt === "jpeg" ? "jpg" : urlExt}`;
  }

  return ".png";
}
