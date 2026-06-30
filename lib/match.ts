/** Deterministic invoice ↔ payment matching score (0–100). */

export interface MatchInvoice {
  id: string;
  vendor_name: string | null;
  total: string | number | null;
  invoice_date: string | null;
  due_date: string | null;
}

export interface MatchPayment {
  id: string;
  payee: string | null;
  amount: string | number | null;
  paid_on: string | null;
}

function normalize(s: string | null): string {
  return (s ?? "").toLowerCase().replace(/(private|pvt|limited|ltd|llp|inc|services|co)\b/g, "").replace(/[^a-z0-9]/g, "");
}

function nameSimilarity(a: string | null, b: string | null): number {
  const x = normalize(a);
  const y = normalize(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (x.includes(y) || y.includes(x)) return 0.85;
  // token overlap on the raw words
  const aw = new Set((a ?? "").toLowerCase().split(/\s+/).filter((w) => w.length > 2));
  const bw = new Set((b ?? "").toLowerCase().split(/\s+/).filter((w) => w.length > 2));
  if (aw.size === 0 || bw.size === 0) return 0;
  let common = 0;
  for (const w of aw) if (bw.has(w)) common++;
  return common / Math.max(aw.size, bw.size);
}

function daysBetween(a: string | null, b: string | null): number | null {
  if (!a || !b) return null;
  return Math.abs((new Date(a).getTime() - new Date(b).getTime()) / 86_400_000);
}

export function scoreMatch(payment: MatchPayment, invoice: MatchInvoice): number {
  let score = 0;

  const pa = Number(payment.amount);
  const ia = Number(invoice.total);
  if (pa > 0 && ia > 0) {
    const diff = Math.abs(pa - ia) / ia;
    if (diff < 0.001) score += 55;
    else if (diff < 0.02) score += 45;
    else if (diff < 0.05) score += 25;
  }

  score += Math.round(nameSimilarity(payment.payee, invoice.vendor_name) * 30);

  const d = Math.min(
    daysBetween(payment.paid_on, invoice.invoice_date) ?? 9999,
    daysBetween(payment.paid_on, invoice.due_date) ?? 9999
  );
  if (d <= 3) score += 15;
  else if (d <= 14) score += 8;

  return Math.min(100, score);
}

/** Pick the best invoice for a payment; returns null if below threshold. */
export function bestMatch(
  payment: MatchPayment,
  invoices: MatchInvoice[],
  threshold = 70
): { invoice: MatchInvoice; score: number } | null {
  let best: { invoice: MatchInvoice; score: number } | null = null;
  for (const inv of invoices) {
    const score = scoreMatch(payment, inv);
    if (!best || score > best.score) best = { invoice: inv, score };
  }
  return best && best.score >= threshold ? best : null;
}
