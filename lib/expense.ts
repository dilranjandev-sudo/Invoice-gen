/**
 * Expense categories for payments that are NOT tied to a vendor bill
 * (salary, rent, taxes, bank charges …). A payment marked with a `type` of
 * "expense" needs no invoice match — it is considered reconciled on its own.
 */

export const EXPENSE_CATEGORIES = [
  "Salary",
  "Rent",
  "Utilities",
  "GST / Tax",
  "TDS",
  "Bank charges",
  "Reimbursement",
  "Owner drawing",
  "Office supplies",
  "Software / Subscription",
  "Professional fees",
  "Other",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

// Keyword → category. First match wins. Keep patterns lowercase.
const RULES: { category: ExpenseCategory; words: string[] }[] = [
  { category: "Salary", words: ["salary", "payroll", "wages", "stipend", "sal cr", "sal-"] },
  { category: "Rent", words: ["rent", "lease", "landlord"] },
  { category: "GST / Tax", words: ["gst", "gstn", "income tax", "advance tax", "self assessment", "challan", "cbdt"] },
  { category: "TDS", words: ["tds", "tcs", "tax deducted"] },
  { category: "Bank charges", words: ["bank charge", "service charge", "processing fee", "amc", "annual maintenance", "chrg", "penal"] },
  { category: "Utilities", words: ["electricity", "power bill", "water bill", "internet", "broadband", "wifi", "mobile bill", "airtel", "jio", "vodafone", "bses", "torrent power"] },
  { category: "Software / Subscription", words: ["subscription", "google workspace", "microsoft", "aws", "adobe", "figma", "slack", "zoom", "hostinger", "godaddy", "openai", "renewal"] },
  { category: "Reimbursement", words: ["reimburs", "expense claim", "petty cash"] },
];

/**
 * Best-effort auto-classification of a payment into an expense category from
 * its payee / subject / body text. Returns null if nothing obvious matches
 * (in which case it stays a normal "bill" payment awaiting a match).
 */
export function autoClassifyExpense(...parts: (string | null | undefined)[]): ExpenseCategory | null {
  const hay = parts.filter(Boolean).join(" ").toLowerCase();
  if (!hay) return null;
  for (const rule of RULES) {
    if (rule.words.some((w) => hay.includes(w))) return rule.category;
  }
  return null;
}
