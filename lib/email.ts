import "server-only";
import { oauthClient, google } from "@/lib/google";

const COMPANY = process.env.COMPANY_NAME || "Biqadx Private Limited";
const ACCENT = "#2563eb";

export interface PaymentEmailData {
  vendorName: string;
  invoiceNumber: string | null;
  amount: number;
  currency: string;
  paidOn: string | null;
  mode: string | null;
  channel: string | null;
  reference: string | null;
}

function money(n: number, currency: string) {
  const sym: Record<string, string> = { INR: "₹", USD: "$", EUR: "€", GBP: "£" };
  return `${sym[currency] ?? ""}${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function prettyDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

/** Professional, corporate, email-client-safe HTML payment confirmation. */
export function paymentEmailHtml(d: PaymentEmailData): string {
  const row = (label: string, value: string) => `
    <tr>
      <td style="padding:11px 0;border-bottom:1px solid #eef1f5;color:#64748b;font-size:13px;">${label}</td>
      <td style="padding:11px 0;border-bottom:1px solid #eef1f5;color:#0f172a;font-size:13px;font-weight:600;text-align:right;">${value}</td>
    </tr>`;

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f3f6;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f3f6;padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#ffffff;border:1px solid #e2e8f0;border-radius:4px;border-top:3px solid ${ACCENT};">
        <!-- Header -->
        <tr><td style="padding:24px 32px 18px;border-bottom:1px solid #eef1f5;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td style="font-size:17px;font-weight:700;color:#0f172a;letter-spacing:-0.2px;">${COMPANY}</td>
            <td align="right" style="font-size:11px;font-weight:700;letter-spacing:0.8px;color:#94a3b8;text-transform:uppercase;">Payment Receipt</td>
          </tr></table>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:28px 32px 6px;">
          <h1 style="margin:0 0 10px;color:#0f172a;font-size:19px;font-weight:700;">Payment confirmation</h1>
          <p style="margin:0;color:#475569;font-size:14px;line-height:1.65;">
            Dear ${d.vendorName},<br>
            This is to confirm that we have processed the following payment to your account${d.invoiceNumber ? ` towards invoice <strong style="color:#0f172a;">${d.invoiceNumber}</strong>` : ""}.
          </p>
        </td></tr>
        <!-- Amount -->
        <tr><td style="padding:18px 32px 6px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #eef1f5;border-radius:4px;">
            <tr><td style="padding:16px 20px;">
              <div style="color:#64748b;font-size:12px;letter-spacing:0.3px;text-transform:uppercase;">Amount paid</div>
              <div style="color:#0f172a;font-size:28px;font-weight:800;margin-top:3px;letter-spacing:-0.5px;">${money(d.amount, d.currency)}</div>
            </td></tr>
          </table>
        </td></tr>
        <!-- Details -->
        <tr><td style="padding:14px 32px 6px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${d.invoiceNumber ? row("Invoice number", d.invoiceNumber) : ""}
            ${row("Payment date", prettyDate(d.paidOn))}
            ${d.mode ? row("Payment mode", d.mode) : ""}
            ${d.channel ? row("Paid via", d.channel) : ""}
            ${d.reference ? row("Reference / UTR", d.reference) : ""}
          </table>
        </td></tr>
        <!-- Closing -->
        <tr><td style="padding:18px 32px 26px;">
          <p style="margin:0;color:#475569;font-size:14px;line-height:1.65;">
            Please retain this email for your records. If anything looks incorrect, reply to this email and our team will assist you.
          </p>
          <p style="margin:16px 0 0;color:#475569;font-size:14px;line-height:1.65;">
            Regards,<br><strong style="color:#0f172a;">${COMPANY}</strong>
          </p>
        </td></tr>
        <!-- Footer -->
        <tr><td style="background:#f8fafc;border-top:1px solid #eef1f5;padding:16px 32px;border-radius:0 0 4px 4px;">
          <p style="margin:0;color:#94a3b8;font-size:11px;line-height:1.55;">
            This is an automated payment confirmation from ${COMPANY}. For your security, never share banking credentials or OTPs in reply to this email.
          </p>
        </td></tr>
      </table>
      <p style="margin:14px 0 0;color:#b0b8c4;font-size:11px;">Sent securely via PayRecord</p>
    </td></tr>
  </table>
</body></html>`;
}

/** Send an HTML email from a connected Gmail account (needs gmail.send scope). */
export async function sendGmailEmail(
  refreshToken: string,
  fromEmail: string,
  to: string,
  subject: string,
  html: string
): Promise<void> {
  const client = oauthClient();
  client.setCredentials({ refresh_token: refreshToken });
  const gmail = google.gmail({ version: "v1", auth: client });

  const message = [
    `From: ${fromEmail}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
    "",
    html,
  ].join("\r\n");

  const raw = Buffer.from(message, "utf8").toString("base64url");
  await gmail.users.messages.send({ userId: "me", requestBody: { raw } });
}
