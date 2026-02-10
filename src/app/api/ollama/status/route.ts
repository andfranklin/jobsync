import { NextResponse } from "next/server";
import { getInstanceStatus } from "@/lib/ollama/instance-manager";

export const dynamic = "force-dynamic";

export async function GET() {
  const status = getInstanceStatus();
  return NextResponse.json({
    running: status.status === "running",
    status: status.status,
    port: status.port,
    modelsDir: status.modelsDir,
  });
}
