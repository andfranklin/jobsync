import "server-only";

import { getCurrentUser } from "@/utils/user.utils";
import { NextResponse } from "next/server";
import { checkRateLimit } from "./rate-limiter";
import { AIUnavailableError } from "./tools/errors";

type AuthSuccess = { success: true; userId: string };
type AuthFailure = { success: false; response: NextResponse };
type AuthResult = AuthSuccess | AuthFailure;

/**
 * Authenticate the current user and check rate limits.
 * Returns the userId on success, or a NextResponse error on failure.
 */
export async function authenticateAndRateLimit(): Promise<AuthResult> {
  const user = await getCurrentUser();
  const userId = user?.id;

  if (!userId) {
    return {
      success: false,
      response: NextResponse.json(
        { error: "No user found. Run the seed script." },
        { status: 500 },
      ),
    };
  }

  const rateLimit = checkRateLimit(userId);
  if (!rateLimit.allowed) {
    return {
      success: false,
      response: NextResponse.json(
        {
          error: `Rate limit exceeded. Try again in ${Math.ceil(
            rateLimit.resetIn / 1000,
          )} seconds.`,
        },
        { status: 429 },
      ),
    };
  }

  return { success: true, userId };
}

/**
 * Handle errors from AI API routes with consistent error responses.
 */
export function handleAiError(
  error: unknown,
  providerName: string,
): NextResponse {
  console.error(`AI error (${providerName}):`, error);

  if (error instanceof AIUnavailableError) {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }

  const message =
    error instanceof Error ? error.message : "AI request failed";

  if (message.includes("fetch failed") || message.includes("ECONNREFUSED")) {
    return NextResponse.json(
      {
        error: `Cannot connect to ${providerName} service. Please ensure the service is running.`,
      },
      { status: 503 },
    );
  }

  return NextResponse.json({ error: message }, { status: 500 });
}
