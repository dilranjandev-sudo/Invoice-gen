// Lightweight single-owner auth. Signed session cookie, verified in middleware
// (edge) and route handlers (node) using Web Crypto — no external service.

export const SESSION_COOKIE = "pr_session";
const SECRET = process.env.AUTH_SECRET || "payrecord-insecure-dev-secret-change-me";
const enc = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sign(data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return b64url(new Uint8Array(sig));
}

/** Create a signed session token valid for 30 days. */
export async function createSession(email: string): Promise<string> {
  const payload = `${email}|${Date.now() + 30 * 24 * 60 * 60 * 1000}`;
  const p = btoa(payload).replace(/=+$/, "");
  return `${p}.${await sign(payload)}`;
}

/** Verify a session token (signature + not expired). */
export async function verifySession(token?: string | null): Promise<boolean> {
  if (!token) return false;
  const [p, sig] = token.split(".");
  if (!p || !sig) return false;
  let payload: string;
  try {
    payload = atob(p);
  } catch {
    return false;
  }
  const exp = Number(payload.split("|")[1]);
  if (!exp || Date.now() > exp) return false;
  return (await sign(payload)) === sig;
}

/** Check login credentials against the owner set in env (with a dev default). */
export function checkCredentials(email: string, password: string): boolean {
  const ownerEmail = (process.env.OWNER_EMAIL || "support@biqadx.com").trim().toLowerCase();
  const ownerPass = process.env.OWNER_PASSWORD || "payrecord123";
  return email.trim().toLowerCase() === ownerEmail && password === ownerPass;
}
