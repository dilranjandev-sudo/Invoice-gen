import "server-only";
import { sql } from "@/lib/db";
import { validateGstin } from "@/lib/gst";

export interface AnomalyFlag {
  key: string;
  label: string;
  severity: "high" | "medium";
}

/**
 * Heuristic anomaly checks for a bill — spots things worth a human look before
 * paying: unusually high amount vs the vendor's history, a brand-new vendor,
 * a missing/invalid GSTIN, or a possible duplicate.
 */
export async function billAnomalies(invoiceId: string): Promise<AnomalyFlag[]> {
  const [bill] = await sql`select id, vendor_name, vendor_gstin, total, invoice_number from invoices where id = ${invoiceId}`;
  if (!bill) return [];
  const flags: AnomalyFlag[] = [];
  const total = bill.total != null ? Number(bill.total) : null;

  if (bill.vendor_name) {
    const [hist] = await sql`
      select count(*)::int as n, coalesce(avg(total), 0) as avg
      from invoices
      where lower(vendor_name) = lower(${bill.vendor_name}) and id <> ${bill.id} and total is not null`;
    const n = hist?.n ?? 0;
    const avg = Number(hist?.avg ?? 0);
    if (n === 0) {
      flags.push({ key: "new_vendor", label: "First bill from this vendor", severity: "medium" });
    } else if (total != null && avg > 0 && total > avg * 1.5) {
      flags.push({ key: "high_amount", label: `${Math.round((total / avg - 1) * 100)}% above this vendor's average`, severity: "high" });
    }

    if (total != null) {
      const [dup] = await sql`
        select 1 from invoices
        where lower(vendor_name) = lower(${bill.vendor_name}) and total = ${total} and id <> ${bill.id}
        limit 1`;
      if (dup) flags.push({ key: "possible_duplicate", label: "Same vendor & amount as another bill", severity: "high" });
    }
  }

  if (!bill.vendor_gstin || !validateGstin(String(bill.vendor_gstin))) {
    flags.push({ key: "no_gstin", label: "No valid GSTIN on the bill", severity: "medium" });
  }

  return flags;
}

/** Flags for many bills at once → { invoiceId: AnomalyFlag[] }. */
export async function billAnomaliesBatch(ids: string[]): Promise<Record<string, AnomalyFlag[]>> {
  const out: Record<string, AnomalyFlag[]> = {};
  for (const id of ids.slice(0, 50)) {
    out[id] = await billAnomalies(id);
  }
  return out;
}
