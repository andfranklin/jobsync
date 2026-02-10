import { getCurrentUser } from "@/utils/user.utils";
import { checkRateLimit } from "@/lib/ai/rate-limiter";
import { generateObject } from "ai";
import prisma from "@/lib/db";

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

jest.mock("next/server", () => ({
  NextRequest: jest.fn(),
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    pipelineRun: {
      findFirst: jest.fn(),
    },
  },
}));

import { POST } from "@/app/api/ai/job/reprocess/route";

const STORED_HTML = `<html><body>
  <h1>Software Engineer</h1>
  <p>Acme Corp is looking for a Software Engineer to join our team in San Francisco.
  You will work on cutting-edge technology and help build the future of our platform.
  Requirements include 5+ years of experience in software development.</p>
  <h2>Responsibilities</h2>
  <ul>
    <li>Design and implement scalable backend services using modern frameworks</li>
    <li>Collaborate with cross-functional teams to define and ship new features</li>
    <li>Write clean, maintainable code with comprehensive test coverage</li>
  </ul>
</body></html>`;

const MOCK_EXTRACTION = {
  title: "Software Engineer",
  company: "Acme Corp",
  locations: ["San Francisco, CA"],
  description: "<p>Great job opportunity</p>",
  jobType: "FT",
  salaryMin: 120000,
  salaryMax: 150000,
};

const VALID_BODY = {
  jobId: "job-123",
  selectedModel: { provider: "ollama", model: "llama3.2" },
};

function createRequest(body: object) {
  return { json: async () => body } as any;
}

describe("POST /api/ai/job/reprocess", () => {
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
    (prisma.pipelineRun.findFirst as jest.Mock).mockResolvedValue({
      rawContent: STORED_HTML,
      sourceUrl: "https://example.com/job/123",
    });
  });

  it("should successfully re-process a job", async () => {
    const response = await POST(createRequest(VALID_BODY) as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.title).toBe("Software Engineer");
    expect(data.company).toBe("Acme Corp");
    expect(prisma.pipelineRun.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { jobId: "job-123" },
        orderBy: { createdAt: "desc" },
        select: { rawContent: true, sourceUrl: true },
      }),
    );
    expect(generateObject).toHaveBeenCalledWith(
      expect.objectContaining({
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

  it("should return 400 when jobId is missing", async () => {
    const response = await POST(
      createRequest({ selectedModel: VALID_BODY.selectedModel }) as any,
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("required");
  });

  it("should return 400 when selectedModel is missing", async () => {
    const response = await POST(
      createRequest({ jobId: "job-123" }) as any,
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("required");
  });

  it("should return 404 when no pipeline run exists", async () => {
    (prisma.pipelineRun.findFirst as jest.Mock).mockResolvedValue(null);

    const response = await POST(createRequest(VALID_BODY) as any);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toContain("No previous pipeline data");
  });

  it("should return 404 when pipeline run has no rawContent", async () => {
    (prisma.pipelineRun.findFirst as jest.Mock).mockResolvedValue({
      rawContent: "",
      sourceUrl: null,
    });

    const response = await POST(createRequest(VALID_BODY) as any);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toContain("No previous pipeline data");
  });

  it("should return 422 when cleaned text is too short", async () => {
    (prisma.pipelineRun.findFirst as jest.Mock).mockResolvedValue({
      rawContent: "<html><body><p>Hi</p></body></html>",
      sourceUrl: null,
    });

    const response = await POST(createRequest(VALID_BODY) as any);
    const data = await response.json();

    expect(response.status).toBe(422);
    expect(data.error).toContain("insufficient text content");
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

  it("should use html-strip when pipelineSettings specify it", async () => {
    const { extractTextFromHtml } = require("@/lib/ai");

    const body = {
      ...VALID_BODY,
      pipelineSettings: {
        cleaningMethod: "html-strip",
        fetchMethod: "standard-with-fallback",
      },
    };

    const response = await POST(createRequest(body) as any);

    expect(response.status).toBe(200);
    expect(extractTextFromHtml).toHaveBeenCalledWith(STORED_HTML);
  });

  it("should use readability by default", async () => {
    const { extractMainContent } = require("@/lib/ai");

    const response = await POST(createRequest(VALID_BODY) as any);

    expect(response.status).toBe(200);
    expect(extractMainContent).toHaveBeenCalledWith(STORED_HTML);
  });
});
