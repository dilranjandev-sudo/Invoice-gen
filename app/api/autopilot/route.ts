import { NextResponse } from "next/server";
import { runAutopilot } from "@/lib/autopilot";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST() {
  try {
    const res = await runAutopilot();
    return NextResponse.json(res);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Autopilot failed." }, { status: 500 });
  }
}
