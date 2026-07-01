import "server-only";
import { sql } from "@/lib/db";

export interface Rule {
  key: string;
  name: string;
  description: string | null;
  enabled: boolean;
  threshold: number | null;
  action: "reject" | "flag";
  sort: number;
}

export interface Check {
  key: string;
  name: string;
  action: "reject" | "flag";
  ok: boolean;
  detail: string;
}

export interface Verdict {
  accepted: boolean;
  rejectedBy: { key: string; name: string; reason: string } | null;
  flags: string[];
  checks: Check[];
}

export async function getRules(): Promise<Rule[]> {
  const rows = await sql`select key, name, description, enabled, threshold, action, sort from rules order by sort`;
  return rows as unknown as Rule[];
}

// The bill fields the rules look at.
export interface BillInput {
  vendor?: string | null;
  invoiceNumber?: string | null;
  total?: number | string | null;
  confidence?: number | null;
  itemsCount?: number;
}

/** Run the enabled rules against an extracted/entered bill. */
export function evaluateBill(b: BillInput, opts: { duplicate: boolean }, rules: Rule[]): Verdict {
  const total = b.total === null || b.total === undefined || b.total === "" ? null : Number(b.total);
  const checks: Check[] = [];

  for (const r of rules) {
    if (!r.enabled) continue;
    let ok = true;
    let detail = "";

    switch (r.key) {
      case "require_amount": {
        const min = r.threshold ?? 1;
        ok = total != null && total >= min;
        detail = ok ? `Amount ₹${total}` : "No amount / ₹0";
        break;
      }
      case "require_vendor":
        ok = !!(b.vendor && String(b.vendor).trim());
        detail = ok ? "Vendor present" : "No vendor name";
        break;
      case "require_invoice_number":
        ok = !!(b.invoiceNumber && String(b.invoiceNumber).trim());
        detail = ok ? "Invoice number present" : "No invoice number";
        break;
      case "min_confidence": {
        // Only applies to AI-read docs (confidence present).
        const min = r.threshold ?? 45;
        ok = b.confidence == null ? true : b.confidence >= min;
        detail =
          b.confidence == null
            ? "No AI confidence (manual)"
            : ok
              ? `Confidence ${b.confidence}%`
              : `Low confidence ${b.confidence}% — not an invoice`;
        break;
      }
      case "no_duplicate":
        ok = !opts.duplicate;
        detail = ok ? "Not a duplicate" : "Duplicate of an existing bill";
        break;
      case "flag_no_items":
        ok = (b.itemsCount ?? 0) > 0;
        detail = ok ? `${b.itemsCount} line item(s)` : "No line items";
        break;
      default:
        continue;
    }

    checks.push({ key: r.key, name: r.name, action: r.action, ok, detail });
  }

  const rejecting = checks.find((c) => c.action === "reject" && !c.ok);
  const flags = checks.filter((c) => c.action === "flag" && !c.ok).map((c) => c.detail);

  return {
    accepted: !rejecting,
    rejectedBy: rejecting ? { key: rejecting.key, name: rejecting.name, reason: rejecting.detail } : null,
    flags,
    checks,
  };
}

/** Log a bill that a rule blocked (so the user can see why). */
export async function logRejected(input: {
  source: string;
  vendorName: string | null;
  invoiceNumber: string | null;
  total: number | null;
  reasonKey: string;
  reason: string;
}) {
  await sql`
    insert into rejected_bills (source, vendor_name, invoice_number, total, reason_key, reason)
    values (${input.source}, ${input.vendorName}, ${input.invoiceNumber}, ${input.total}, ${input.reasonKey}, ${input.reason})
  `;
}
