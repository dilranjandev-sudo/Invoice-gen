import "server-only";

const COMPANY = process.env.COMPANY_NAME || "Biqadx Private Limited";
const ACCENT = "#e41f07";

export interface PoItem {
  name?: string | null;
  hsn?: string | null;
  qty?: number | null;
  rate?: number | null;
  gst?: number | null;
  amount?: number | null;
}
export interface PoEmailData {
  poNumber: string;
  vendorName: string;
  orderDate: string | null;
  expectedDate: string | null;
  currency: string;
  items: PoItem[];
  subtotal: number | null;
  gst: number | null;
  total: number | null;
  notes: string | null;
  logoUrl?: string | null;
}

function money(n: number | null | undefined, currency: string) {
  if (n == null) return "—";
  const sym: Record<string, string> = { INR: "₹", USD: "$", EUR: "€", GBP: "£" };
  return `${sym[currency] ?? ""}${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function prettyDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function esc(s: unknown) {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}

export function poEmailHtml(d: PoEmailData): string {
  const cur = d.currency || "INR";
  const rows = d.items
    .map(
      (it, i) => `
    <tr>
      <td style="padding:9px 8px;border-bottom:1px solid #eef1f5;font-size:13px;color:#64748b;">${i + 1}</td>
      <td style="padding:9px 8px;border-bottom:1px solid #eef1f5;font-size:13px;color:#0f172a;font-weight:600;">${esc(it.name) || "Item"}${it.hsn ? `<div style="font-weight:400;color:#94a3b8;font-size:11px;">HSN ${esc(it.hsn)}</div>` : ""}</td>
      <td style="padding:9px 8px;border-bottom:1px solid #eef1f5;font-size:13px;color:#475569;text-align:right;">${it.qty ?? "—"}</td>
      <td style="padding:9px 8px;border-bottom:1px solid #eef1f5;font-size:13px;color:#475569;text-align:right;">${money(it.rate, cur)}</td>
      <td style="padding:9px 8px;border-bottom:1px solid #eef1f5;font-size:13px;color:#475569;text-align:right;">${it.gst != null ? it.gst + "%" : "—"}</td>
      <td style="padding:9px 8px;border-bottom:1px solid #eef1f5;font-size:13px;color:#0f172a;font-weight:600;text-align:right;">${money(it.amount, cur)}</td>
    </tr>`
    )
    .join("");

  const totalRow = (label: string, value: string, strong = false) => `
    <tr>
      <td style="padding:5px 0;color:${strong ? "#0f172a" : "#64748b"};font-size:${strong ? "15px" : "13px"};font-weight:${strong ? "700" : "400"};">${label}</td>
      <td style="padding:5px 0 5px 24px;color:#0f172a;font-size:${strong ? "16px" : "13px"};font-weight:${strong ? "800" : "600"};text-align:right;white-space:nowrap;">${value}</td>
    </tr>`;

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f3f6;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f3f6;padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border:1px solid #e2e8f0;border-radius:4px;border-top:3px solid ${ACCENT};">
        <tr><td style="padding:24px 32px 18px;border-bottom:1px solid #eef1f5;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td style="font-size:17px;font-weight:700;color:#0f172a;">${d.logoUrl ? `<img src="${d.logoUrl}" alt="${esc(COMPANY)}" height="34" style="display:block;max-height:40px;border:0;">` : esc(COMPANY)}</td>
            <td align="right" style="font-size:11px;font-weight:700;letter-spacing:0.8px;color:#94a3b8;text-transform:uppercase;">Purchase Order</td>
          </tr></table>
        </td></tr>

        <tr><td style="padding:22px 32px 6px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td style="vertical-align:top;">
              <div style="font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.4px;">Order to</div>
              <div style="margin-top:3px;font-size:15px;font-weight:700;color:#0f172a;">${esc(d.vendorName) || "Vendor"}</div>
            </td>
            <td align="right" style="vertical-align:top;">
              <div style="font-size:13px;color:#0f172a;font-weight:700;">#${esc(d.poNumber)}</div>
              <div style="font-size:12px;color:#64748b;margin-top:2px;">Order date: ${prettyDate(d.orderDate)}</div>
              ${d.expectedDate ? `<div style="font-size:12px;color:#64748b;">Expected by: ${prettyDate(d.expectedDate)}</div>` : ""}
            </td>
          </tr></table>
        </td></tr>

        <tr><td style="padding:16px 32px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eef1f5;border-radius:4px;overflow:hidden;">
            <tr style="background:#f8fafc;">
              <th style="padding:9px 8px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.4px;color:#94a3b8;">#</th>
              <th style="padding:9px 8px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.4px;color:#94a3b8;">Description</th>
              <th style="padding:9px 8px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:0.4px;color:#94a3b8;">Qty</th>
              <th style="padding:9px 8px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:0.4px;color:#94a3b8;">Rate</th>
              <th style="padding:9px 8px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:0.4px;color:#94a3b8;">GST</th>
              <th style="padding:9px 8px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:0.4px;color:#94a3b8;">Amount</th>
            </tr>
            ${rows}
          </table>
        </td></tr>

        <tr><td style="padding:14px 32px 6px;">
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin-left:auto;min-width:240px;">
            ${totalRow("Subtotal", money(d.subtotal, cur))}
            ${d.gst != null ? totalRow("GST", money(d.gst, cur)) : ""}
            <tr><td colspan="2" style="border-top:1px solid #eef1f5;padding-top:4px;"></td></tr>
            ${totalRow("Total", money(d.total, cur), true)}
          </table>
        </td></tr>

        ${d.notes ? `<tr><td style="padding:12px 32px 4px;"><div style="font-size:12px;color:#94a3b8;text-transform:uppercase;">Notes / Terms</div><div style="margin-top:4px;font-size:13px;color:#475569;line-height:1.6;white-space:pre-wrap;">${esc(d.notes)}</div></td></tr>` : ""}

        <tr><td style="padding:18px 32px 26px;">
          <p style="margin:0;color:#475569;font-size:14px;line-height:1.65;">
            Please supply the items above${d.expectedDate ? ` by <strong style="color:#0f172a;">${prettyDate(d.expectedDate)}</strong>` : ""} and raise your invoice against this PO number.
          </p>
          <p style="margin:16px 0 0;color:#475569;font-size:14px;">Regards,<br><strong style="color:#0f172a;">${esc(COMPANY)}</strong></p>
        </td></tr>

        <tr><td style="background:#f8fafc;border-top:1px solid #eef1f5;padding:14px 32px;border-radius:0 0 4px 4px;">
          <p style="margin:0;color:#94a3b8;font-size:11px;">Sent securely via PayRecord.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}
