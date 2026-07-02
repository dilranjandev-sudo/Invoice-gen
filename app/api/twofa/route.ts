import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { randomSecret, otpauthUri, verifyTotp } from "@/lib/totp";

export const runtime = "nodejs";

const OWNER = (process.env.OWNER_EMAIL || "support@biqadx.com").trim().toLowerCase();

async function getSetting(key: string): Promise<string | null> {
  const [r] = await sql`select value from app_settings where key = ${key}`;
  return (r?.value as string) ?? null;
}
async function setSetting(key: string, value: string) {
  await sql`insert into app_settings (key, value) values (${key}, ${value})
            on conflict (key) do update set value = excluded.value, updated_at = now()`;
}

export async function GET() {
  try {
    const enabled = (await getSetting("owner_2fa_enabled")) === "true";
    return NextResponse.json({ enabled });
  } catch {
    return NextResponse.json({ enabled: false });
  }
}

export async function POST(req: Request) {
  try {
    const b = await req.json();

    if (b.action === "setup") {
      const secret = randomSecret();
      await setSetting("owner_2fa_pending", secret);
      return NextResponse.json({ secret, uri: otpauthUri(secret, OWNER) });
    }

    if (b.action === "enable") {
      const pending = await getSetting("owner_2fa_pending");
      if (!pending) return NextResponse.json({ error: "Start setup first." }, { status: 400 });
      if (!(await verifyTotp(String(b.code || ""), pending))) return NextResponse.json({ error: "Wrong code — try again." }, { status: 400 });
      await setSetting("owner_2fa_secret", pending);
      await setSetting("owner_2fa_enabled", "true");
      await sql`delete from app_settings where key = 'owner_2fa_pending'`;
      return NextResponse.json({ ok: true, enabled: true });
    }

    if (b.action === "disable") {
      const secret = await getSetting("owner_2fa_secret");
      if (secret && !(await verifyTotp(String(b.code || ""), secret))) {
        return NextResponse.json({ error: "Wrong code — enter a current code to turn off 2FA." }, { status: 400 });
      }
      await setSetting("owner_2fa_enabled", "false");
      await sql`delete from app_settings where key in ('owner_2fa_secret','owner_2fa_pending')`;
      return NextResponse.json({ ok: true, enabled: false });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed." }, { status: 500 });
  }
}
