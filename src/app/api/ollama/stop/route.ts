import { NextResponse } from "next/server";
import { stopInstance } from "@/lib/ollama/instance-manager";

export async function POST() {
  const result = await stopInstance();
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
