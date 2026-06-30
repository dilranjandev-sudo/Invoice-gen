import { NextResponse } from "next/server";
import { oauthClient, google, appUrl } from "@/lib/google";
import { sql } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const err = searchParams.get("error");
  if (err || !code) {
    return NextResponse.redirect(`${appUrl()}/connectors?error=${err || "no_code"}`);
  }

  try {
    const client = oauthClient();
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: "v2", auth: client });
    const { data: profile } = await oauth2.userinfo.get();
    const email = profile.email;
    if (!email) throw new Error("Could not read Gmail address.");

    const expiry = tokens.expiry_date ? new Date(tokens.expiry_date) : null;
    await sql`
      insert into gmail_accounts (email, refresh_token, access_token, token_expiry, scope, status)
      values (${email}, ${tokens.refresh_token ?? null}, ${tokens.access_token ?? null}, ${expiry}, ${tokens.scope ?? null}, 'connected')
      on conflict (email) do update set
        refresh_token = coalesce(excluded.refresh_token, gmail_accounts.refresh_token),
        access_token = excluded.access_token,
        token_expiry = excluded.token_expiry,
        scope = excluded.scope,
        status = 'connected'
    `;

    return NextResponse.redirect(`${appUrl()}/connectors?connected=${encodeURIComponent(email)}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "oauth_failed";
    return NextResponse.redirect(`${appUrl()}/connectors?error=${encodeURIComponent(msg)}`);
  }
}
