import { getCurrentUser } from "@/utils/user.utils";
import { checkRateLimit } from "@/lib/ai/rate-limiter";
import { generateObject } from "ai";
import { fetchWithPlaywright } from "@/lib/scraping/playwright-fetcher";

// Must mock before importing the route
jest.mock("server-only", () => {});

jest.mock("@/utils/user.utils", () => ({
  getCurrentUser: jest.fn(),
  requireUser: jest.fn(),
}));

jest.mock("@/lib/ai/rate-limiter", () => ({
  checkRateLimit: jest.fn(),
}));

jest.mock("@/lib/ai/providers", () => ({
  getModel: jest.fn().mockReturnValue("mock-model"),
}));

jest.mock("ai", () => ({
  generateObject: jest.fn(),
}));

jest.mock("@/lib/ai/config", () => ({
  getTextLimit: jest.fn().mockReturnValue(15000),
}));

jest.mock("@/lib/ai/pipeline", () => ({
  createPipelineRun: jest.fn().mockResolvedValue({ id: "run-1" }),
  updatePipelineRunCleaned: jest.fn().mockResolvedValue({}),
  updatePipelineRunExtracted: jest.fn().mockResolvedValue({}),
  updatePipelineRunFailed: jest.fn().mockResolvedValue({}),
}));

jest.mock("@/lib/scraping/playwright-fetcher", () => ({
  fetchWithPlaywright: jest.fn(),
}));

// Minimal mock for @/lib/ai barrel — only what the route imports
jest.mock("@/lib/ai", () => ({
  JOB_EXTRACT_SYSTEM_PROMPT: "mock system prompt",
  buildJobExtractPrompt: jest.fn((text: string) => `extract: ${text}`),
  extractTextFromHtml: jest.fn((html: string) => {
    return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }),
  extractMainContent: jest.fn((html: string) => {
    return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }),
  AIUnavailableError: class AIUnavailableError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "AIUnavailableError";
    }
  },
}));

// Mock next/server — jsdom stubs lack real Request/Response implementations
jest.mock("next/server", () => ({
  NextRequest: jest.fn(),
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));

// Import after mocks are set up
import { POST } from "@/app/api/ai/job/extract/route";

const VALID_BODY = {
  url: "https://example.com/job/123",
  selectedModel: { provider: "ollama", model: "llama3.2" },
};

const MOCK_EXTRACTION = {
  title: "Software Engineer",
  company: "Acme Corp",
  locations: ["San Francisco, CA"],
  description: "<p>Great job opportunity</p>",
  jobType: "FT",
  salaryMin: 120000,
  salaryMax: 150000,
};

function createRequest(body: object) {
  return { json: async () => body } as any;
}

// Generate HTML with enough text content (>500 chars after tag stripping)
const MOCK_HTML = `<html><body>
  <h1>Software Engineer</h1>
  <p>Acme Corp is looking for a Software Engineer to join our team in San Francisco.
  You will work on cutting-edge technology and help build the future of our platform.
  Requirements include 5+ years of experience in software development.</p>
  <h2>Responsibilities</h2>
  <ul>
    <li>Design and implement scalable backend services using modern frameworks</li>
    <li>Collaborate with cross-functional teams to define and ship new features</li>
    <li>Write clean, maintainable code with comprehensive test coverage</li>
    <li>Participate in code reviews and mentor junior developers on best practices</li>
  </ul>
  <h2>Qualifications</h2>
  <ul>
    <li>Bachelor's degree in Computer Science or equivalent practical experience</li>
    <li>Strong proficiency in Python, Java, or TypeScript</li>
    <li>Experience with cloud platforms such as AWS, GCP, or Azure</li>
    <li>Excellent problem-solving skills and attention to detail</li>
  </ul>
</body></html>`;

describe("POST /api/ai/job/extract", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    (getCurrentUser as jest.Mock).mockResolvedValue({ id: "user-123" });
    (checkRateLimit as jest.Mock).mockReturnValue({
      allowed: true,
      remaining: 4,
      resetIn: 0,
    });
    (generateObject as jest.Mock).mockResolvedValue({
      object: MOCK_EXTRACTION,
    });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => MOCK_HTML,
    });
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it("should successfully extract job data from a URL", async () => {
    const response = await POST(createRequest(VALID_BODY) as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.title).toBe("Software Engineer");
    expect(data.company).toBe("Acme Corp");
    expect(data.locations).toEqual(["San Francisco, CA"]);
    expect(global.fetch).toHaveBeenCalledWith(
      "https://example.com/job/123",
      expect.objectContaining({
        headers: expect.objectContaining({
          "User-Agent": expect.stringContaining("JobSync"),
        }),
      }),
    );
    expect(generateObject).toHaveBeenCalledWith(
      expect.objectContaining({
        schema: expect.anything(),
        temperature: 0.1,
      }),
    );
  });

  it("should return 500 when no user found", async () => {
    (getCurrentUser as jest.Mock).mockResolvedValue(null);

    const response = await POST(createRequest(VALID_BODY) as any);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain("No user found");
  });

  it("should return 429 when rate limited", async () => {
    (checkRateLimit as jest.Mock).mockReturnValue({
      allowed: false,
      resetIn: 30000,
    });

    const response = await POST(createRequest(VALID_BODY) as any);
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.error).toContain("Rate limit exceeded");
  });

  it("should return 400 when both URL and htmlContent are missing", async () => {
    const response = await POST(
      createRequest({ selectedModel: VALID_BODY.selectedModel }) as any,
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("required");
  });

  it("should return 400 when selectedModel is missing", async () => {
    const response = await POST(
      createRequest({ url: VALID_BODY.url }) as any,
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("required");
  });

  it("should return 400 for invalid URL format", async () => {
    const response = await POST(
      createRequest({
        url: "not-a-valid-url",
        selectedModel: VALID_BODY.selectedModel,
      }) as any,
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("Invalid URL");
  });

  it("should fall back to Playwright when fetch returns 403", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 403,
    });
    (fetchWithPlaywright as jest.Mock).mockResolvedValue(MOCK_HTML);

    const response = await POST(createRequest(VALID_BODY) as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.title).toBe("Software Engineer");
    expect(fetchWithPlaywright).toHaveBeenCalledWith("https://example.com/job/123");
  });

  it("should return 422 when fetch returns 403 and Playwright also fails", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 403,
    });
    (fetchWithPlaywright as jest.Mock).mockRejectedValue(
      new Error("Browser not installed"),
    );

    const response = await POST(createRequest(VALID_BODY) as any);
    const data = await response.json();

    expect(response.status).toBe(422);
    expect(data.error).toContain("browser fallback failed");
  });

  it("should fall back to Playwright when fetch returns 429", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 429,
    });
    (fetchWithPlaywright as jest.Mock).mockResolvedValue(MOCK_HTML);

    const response = await POST(createRequest(VALID_BODY) as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(fetchWithPlaywright).toHaveBeenCalled();
  });

  it("should return 422 when target site returns other error", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 404,
    });

    const response = await POST(createRequest(VALID_BODY) as any);
    const data = await response.json();

    expect(response.status).toBe(422);
    expect(data.error).toContain("Failed to fetch the page");
  });

  it("should return 504 on fetch timeout (AbortError)", async () => {
    (global.fetch as jest.Mock).mockRejectedValue(
      new DOMException("The operation was aborted.", "AbortError"),
    );

    const response = await POST(createRequest(VALID_BODY) as any);
    const data = await response.json();

    expect(response.status).toBe(504);
    expect(data.error).toContain("timed out");
  });

  it("should return 502 on network error", async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error("Network error"));

    const response = await POST(createRequest(VALID_BODY) as any);
    const data = await response.json();

    expect(response.status).toBe(502);
    expect(data.error).toContain("Could not reach the URL");
  });

  it("should return 422 when extracted text is too short from both fetch and Playwright", async () => {
    const shortHtml = "<html><body><p>Hi</p></body></html>";
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => shortHtml,
    });
    // Playwright also returns short content
    (fetchWithPlaywright as jest.Mock).mockResolvedValue(shortHtml);

    const response = await POST(createRequest(VALID_BODY) as any);
    const data = await response.json();

    expect(response.status).toBe(422);
    expect(data.error).toContain("not extract enough text");
    // Should have tried Playwright since standard fetch content was short
    expect(fetchWithPlaywright).toHaveBeenCalled();
  });

  it("should return 503 when AI provider connection fails", async () => {
    (generateObject as jest.Mock).mockRejectedValue(
      new Error("fetch failed: ECONNREFUSED"),
    );

    const response = await POST(createRequest(VALID_BODY) as any);
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.error).toContain("Cannot connect to ollama");
  });

  describe("htmlContent (paste fallback)", () => {
    const PASTED_TEXT =
      "Software Engineer at Acme Corp in San Francisco. " +
      "We are looking for a talented engineer to join our team. " +
      "Requirements include 5+ years of experience in software development.";

    it("should extract job data from pasted content without fetching URL", async () => {
      const response = await POST(
        createRequest({
          htmlContent: PASTED_TEXT,
          selectedModel: VALID_BODY.selectedModel,
        }) as any,
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.title).toBe("Software Engineer");
      expect(global.fetch).not.toHaveBeenCalled();
      expect(generateObject).toHaveBeenCalled();
    });

    it("should return 422 when pasted content is too short", async () => {
      const response = await POST(
        createRequest({
          htmlContent: "Short text",
          selectedModel: VALID_BODY.selectedModel,
        }) as any,
      );
      const data = await response.json();

      expect(response.status).toBe(422);
      expect(data.error).toContain("Not enough text");
    });

    it("should strip HTML tags from pasted HTML content", async () => {
      const response = await POST(
        createRequest({
          htmlContent: `<html><body><p>${PASTED_TEXT}</p></body></html>`,
          selectedModel: VALID_BODY.selectedModel,
        }) as any,
      );

      expect(response.status).toBe(200);
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });
});
