import { NextResponse } from "next/server";
import { checkCredentials, createSession, SESSION_COOKIE } from "@/lib/auth";
import { sql } from "@/lib/db";
import { verifyTotp } from "@/lib/totp";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { email, password, code } = await req.json();
    if (!checkCredentials(String(email || ""), String(password || ""))) {
      return NextResponse.json({ error: "Incorrect email or password." }, { status: 401 });
    }

    // Second factor, if the owner enabled it.
    let twoFaEnabled = false;
    let secret: string | null = null;
    try {
      const rows = await sql`select key, value from app_settings where key in ('owner_2fa_enabled','owner_2fa_secret')`;
      for (const r of rows) {
        if (r.key === "owner_2fa_enabled") twoFaEnabled = r.value === "true";
        if (r.key === "owner_2fa_secret") secret = r.value as string;
      }
    } catch {
      /* if settings can't be read, fall back to password-only */
    }
    if (twoFaEnabled && secret) {
      if (!code) return NextResponse.json({ need2fa: true }, { status: 200 });
      if (!(await verifyTotp(String(code), secret))) {
        return NextResponse.json({ error: "Wrong 2FA code.", need2fa: true }, { status: 401 });
      }
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
