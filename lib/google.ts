import "server-only";
import { google } from "googleapis";

export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/userinfo.email",
];

export function appUrl() {
  return process.env.APP_URL || "http://localhost:3000";
}

export function redirectUri() {
  return process.env.GOOGLE_REDIRECT_URI || `${appUrl()}/api/gmail/callback`;
}

export function hasGoogleCreds() {
  return !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;
}

export function oauthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri()
  );
}

export { google };
