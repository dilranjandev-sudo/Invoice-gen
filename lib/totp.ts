// TOTP (RFC 6238) using Web Crypto — no external dependency. Works in the
// Node runtime. Used for owner two-factor auth with an authenticator app.

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function randomSecret(): string {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return base32Encode(bytes);
}

function base32Encode(bytes: Uint8Array): string {
  let bits = 0, value = 0, out = "";
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(str: string): Uint8Array {
  const clean = str.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = B32.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

async function hotp(secret: string, counter: number): Promise<string> {
  const keyBytes = base32Decode(secret);
  const buf = new ArrayBuffer(8);
  const view = new DataView(buf);
  // 64-bit big-endian counter (high word is 0 for our time range).
  view.setUint32(0, Math.floor(counter / 0x100000000));
  view.setUint32(4, counter >>> 0);
  const key = await crypto.subtle.importKey("raw", keyBytes as unknown as ArrayBuffer, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, buf));
  const offset = sig[19] & 0xf;
  const bin = ((sig[offset] & 0x7f) << 24) | ((sig[offset + 1] & 0xff) << 16) | ((sig[offset + 2] & 0xff) << 8) | (sig[offset + 3] & 0xff);
  return String(bin % 1_000_000).padStart(6, "0");
}

/** Verify a 6-digit code against the secret, allowing ±1 time-step drift. */
export async function verifyTotp(code: string, secret: string): Promise<boolean> {
  const clean = String(code).replace(/\D/g, "");
  if (clean.length !== 6 || !secret) return false;
  const step = Math.floor(Date.now() / 1000 / 30);
  for (let w = -1; w <= 1; w++) {
    if ((await hotp(secret, step + w)) === clean) return true;
  }
  return false;
}

/** otpauth:// URI for QR/manual entry in an authenticator app. */
export function otpauthUri(secret: string, account: string, issuer = "PayRecord"): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({ secret, issuer, algorithm: "SHA1", digits: "6", period: "30" });
  return `otpauth://totp/${label}?${params.toString()}`;
}
