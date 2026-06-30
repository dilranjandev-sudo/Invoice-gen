import { NextResponse } from "next/server";
import { runMatching } from "@/lib/run-match";

export const runtime = "nodejs";

export async function POST() {
  try {
    const matched = await runMatching();
    return NextResponse.json({ matched });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Matching failed." },
      { status: 500 }
    );
  }
}
