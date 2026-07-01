import { NextResponse } from "next/server";
import { checkCredentials, createSession, SESSION_COOKIE } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();
    if (!checkCredentials(String(email || ""), String(password || ""))) {
      return NextResponse.json({ error: "Incorrect email or password." }, { status: 401 });
    }
    const token = await createSession(String(email).trim().toLowerCase());
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
    });
    return res;
  } catch {
    return NextResponse.json({ error: "Login failed." }, { status: 400 });
  }
}
