// GST helpers — all computed locally, no external API/service.

const GST_STATES: Record<string, string> = {
  "01": "Jammu & Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh",
  "05": "Uttarakhand", "06": "Haryana", "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh",
  "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur",
  "15": "Mizoram", "16": "Tripura", "17": "Meghalaya", "18": "Assam", "19": "West Bengal",
  "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat",
  "25": "Daman & Diu", "26": "Dadra & Nagar Haveli", "27": "Maharashtra", "28": "Andhra Pradesh (Old)",
  "29": "Karnataka", "30": "Goa", "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu",
  "34": "Puducherry", "35": "Andaman & Nicobar", "36": "Telangana", "37": "Andhra Pradesh",
  "38": "Ladakh", "97": "Other Territory", "99": "Centre Jurisdiction",
};

const CODE = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

/** Validate a GSTIN's format AND its check digit (offline, per the GSTN spec). */
export function validateGstin(raw: string | null | undefined): boolean {
  if (!raw) return false;
  const g = raw.trim().toUpperCase();
  if (!GSTIN_RE.test(g)) return false;
  const mod = CODE.length; // 36
  let factor = 2;
  let sum = 0;
  for (let i = g.length - 2; i >= 0; i--) {
    let digit = factor * CODE.indexOf(g[i]);
    factor = factor === 2 ? 1 : 2;
    digit = Math.floor(digit / mod) + (digit % mod);
    sum += digit;
  }
  const check = (mod - (sum % mod)) % mod;
  return CODE[check] === g[g.length - 1];
}

/** State name from a GSTIN's first two digits. */
export function gstinState(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return GST_STATES[raw.trim().slice(0, 2)] ?? null;
}

/** PAN embedded in a GSTIN (chars 3-12). */
export function gstinPan(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const g = raw.trim().toUpperCase();
  return g.length >= 12 ? g.slice(2, 12) : null;
}
