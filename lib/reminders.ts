import "server-only";
import { sql } from "@/lib/db";
import { sendGmailEmail } from "@/lib/email";

const COMPANY = process.env.COMPANY_NAME || "Biqadx Private Limited";
const ACCENT = "#e41f07";

function money(n: unknown, cur = "INR") {
  if (n == null) return "—";
  const sym: Record<string, string> = { INR: "₹", USD: "$", EUR: "€", GBP: "£" };
  return `${sym[cur] ?? ""}${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function prettyDate(iso: unknown) {
  if (!iso) return "—";
  return new Date(String(iso)).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function daysUntil(iso: unknown): number {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(String(iso).slice(0, 10) + "T00:00:00");
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildHtml(rows: any[]): string {
  const items = rows
    .map((r) => {
      const dn = daysUntil(r.next_due);
      const status = dn < 0 ? `Overdue ${Math.abs(dn)}d` : dn === 0 ? "Due today" : `In ${dn}d`;
      const color = dn <= 0 ? "#dc2626" : dn <= 3 ? "#d97706" : "#16a34a";
      return `<tr>
        <td style="padding:9px 8px;border-bottom:1px solid #eef1f5;font-size:13px;color:#0f172a;font-weight:600;">${r.name || "—"}${r.payee ? `<div style="font-weight:400;color:#94a3b8;font-size:11px;">${r.payee}</div>` : ""}</td>
        <td style="padding:9px 8px;border-bottom:1px solid #eef1f5;font-size:13px;color:#475569;">${r.category || "—"}</td>
        <td style="padding:9px 8px;border-bottom:1px solid #eef1f5;font-size:13px;color:#0f172a;font-weight:600;text-align:right;">${money(r.amount, r.currency || "INR")}</td>
        <td style="padding:9px 8px;border-bottom:1px solid #eef1f5;font-size:13px;color:#475569;">${prettyDate(r.next_due)}</td>
        <td style="padding:9px 8px;border-bottom:1px solid #eef1f5;font-size:12px;font-weight:700;color:${color};text-align:right;">${status}</td>
      </tr>`;
    })
    .join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;background:#f1f3f6;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:28px 12px;background:#f1f3f6;"><tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#fff;border:1px solid #e2e8f0;border-radius:4px;border-top:3px solid ${ACCENT};">
      <tr><td style="padding:22px 32px 8px;">
        <div style="font-size:11px;font-weight:700;letter-spacing:0.8px;color:#94a3b8;text-transform:uppercase;">${COMPANY} · Reminder</div>
        <div style="margin-top:6px;font-size:18px;font-weight:800;color:#0f172a;">${rows.length} recurring payment${rows.length === 1 ? "" : "s"} due soon</div>
      </td></tr>
      <tr><td style="padding:12px 32px 0;">
        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eef1f5;border-radius:4px;overflow:hidden;">
          <tr style="background:#f8fafc;">
            <th style="padding:9px 8px;text-align:left;font-size:11px;text-transform:uppercase;color:#94a3b8;">Item</th>
            <th style="padding:9px 8px;text-align:left;font-size:11px;text-transform:uppercase;color:#94a3b8;">Category</th>
            <th style="padding:9px 8px;text-align:right;font-size:11px;text-transform:uppercase;color:#94a3b8;">Amount</th>
            <th style="padding:9px 8px;text-align:left;font-size:11px;text-transform:uppercase;color:#94a3b8;">Due</th>
            <th style="padding:9px 8px;text-align:right;font-size:11px;text-transform:uppercase;color:#94a3b8;">Status</th>
          </tr>
          ${items}
        </table>
      </td></tr>
      <tr><td style="padding:18px 32px 26px;color:#475569;font-size:13px;">Open PayRecord → Recurring to mark these paid once done. This is an automated daily reminder.</td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

/**
 * Send a once-a-day digest of recurring expenses due within 7 days (or overdue)
 * to the owner. Self-guards via app_settings so it runs at most once per day
 * even though it's called from the keep-warm interval.
 */
export async function runRecurringReminders(): Promise<{ sent: boolean; count?: number; reason?: string }> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const [last] = await sql`select value from app_settings where key = 'recurring_reminder_last'`;
    if (last?.value === today) return { sent: false, reason: "already_ran_today" };

    // Reminders on/off (default on)
    const [enabled] = await sql`select value from app_settings where key = 'recurring_reminders_enabled'`;
    if (enabled?.value === "false") return { sent: false, reason: "disabled" };

    const rows = await sql`
      select name, payee, category, amount, currency, next_due, frequency
      from recurring_expenses
      where active = true and next_due is not null and next_due <= (current_date + interval '7 days')
      order by next_due asc
    `;

    // Mark as run today regardless, so we never spam if send fails.
    await sql`insert into app_settings (key, value) values ('recurring_reminder_last', ${today})
              on conflict (key) do update set value = excluded.value, updated_at = now()`;

    if (rows.length === 0) return { sent: false, reason: "nothing_due" };

    const [acct] = await sql`select email, refresh_token from gmail_accounts where status = 'connected' order by created_at limit 1`;
    if (!acct?.refresh_token) return { sent: false, reason: "no_gmail" };

    const to = process.env.OWNER_EMAIL || (acct.email as string);
    await sendGmailEmail(acct.refresh_token as string, acct.email as string, to, `PayRecord — ${rows.length} recurring payment(s) due soon`, buildHtml(rows));
    return { sent: true, count: rows.length };
  } catch (e) {
    return { sent: false, reason: e instanceof Error ? e.message : "error" };
  }
}
