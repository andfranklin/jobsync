import { NextResponse } from "next/server";
import { startInstance } from "@/lib/ollama/instance-manager";

export async function POST() {
  const result = await startInstance();
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
