import { NextResponse } from "next/server";
import { oauthClient, hasGoogleCreds, GMAIL_SCOPES, appUrl } from "@/lib/google";

export const runtime = "nodejs";

export async function GET() {
  if (!hasGoogleCreds()) {
    return NextResponse.redirect(`${appUrl()}/connectors?error=no_google_creds`);
  }
  const url = oauthClient().generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // always return a refresh_token
    scope: GMAIL_SCOPES,
  });
  return NextResponse.redirect(url);
}
