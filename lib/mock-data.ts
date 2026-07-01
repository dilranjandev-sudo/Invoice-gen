/* ----------------------------------------------------------------------------
   PayRecord — mock data
   AP automation: Gmail payment records + uploaded invoices, AI-matched.
   Stands in for the database until the backend is wired.
---------------------------------------------------------------------------- */

export type RecordStatus =
  | "pending"
  | "matched"
  | "approved"
  | "paid"
  | "no_match"
  | "multiple"
  | "needs_review"
  | "failed"
  | "rejected"
  | "processing";

export interface Company {
  name: string;
  shortName: string;
  gst: string;
  email: string;
}

export const company: Company = {
  name: "Biqadx Private Limited",
  shortName: "Biqadx",
  gst: "27AAACA1234A1Z5",
  email: "accounts@biqadx.com",
};

export const currentUser = {
  name: "Admin User",
  role: "Administrator",
  email: "admin@biqadx.com",
  initials: "A",
};

/* ---- Dashboard stats -------------------------------------------------------- */

export const dashboardStats = {
  totalPayments: 1245750,
  billsUploaded: 72,
  matched: 56,
  pendingApproval: 16,
  trends: {
    totalPayments: 18.6,
    billsUploaded: 14.2,
    matched: 21.4,
    pendingApproval: -8.6,
  },
};

export const gmailSync = {
  status: "connected" as "connected" | "disconnected" | "expired",
  lastSyncedLabel: "2 min ago",
  nextSyncLabel: "3 min 45 sec",
};

/* ---- Payment (extracted from Gmail) ----------------------------------------- */

export interface PaymentSource {
  /** e.g. "Axis Bank", "HDFC Bank", "UPI" */
  channel: string;
  /** e.g. "Google Pay", "PhonePe" or masked account "•••• 2773" */
  detail: string;
}

export interface Payment {
  id: string;
  vendor: string;
  amount: number;
  currency: string;
  date: string;
  reference: string;
  utr: string;
  mode: string;
  paidBy: string;
  source: PaymentSource;
  status: "matched" | "pending" | "unmatched";
  linkedBillId: string | null;
}

/* ---- Invoice / Bill (uploaded or from Gmail attachment) --------------------- */

export interface InvoiceItem {
  name: string;
  qty: number;
  rate: number;
}

export interface Bill {
  id: string;
  fileName: string;
  uploadedAt: string;
  vendor: string;
  vendorId: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  gstNumber: string;
  subtotal: number;
  gst: number;
  total: number;
  currency: string;
  description: string;
  items: InvoiceItem[];
  /** null when no payment matched yet */
  matchScore: number | null;
  status: RecordStatus;
  confidence: number;
  paymentId: string | null;
}

export const payments: Payment[] = [
  {
    id: "p1",
    vendor: "ABC Tech Solutions",
    amount: 75000,
    currency: "INR",
    date: "2026-06-29",
    reference: "AXIS2026062912345678",
    utr: "AXIS2026062912345678",
    mode: "Bank Transfer",
    paidBy: "accounts@biqadx.com",
    source: { channel: "Axis Bank", detail: "•••• 2773" },
    status: "pending",
    linkedBillId: "b1",
  },
  {
    id: "p2",
    vendor: "Design Studio",
    amount: 35000,
    currency: "INR",
    date: "2026-06-28",
    reference: "GPAY28061900042",
    utr: "GPAY28061900042",
    mode: "UPI",
    paidBy: "finance@biqadx.com",
    source: { channel: "UPI", detail: "Google Pay" },
    status: "pending",
    linkedBillId: "b2",
  },
  {
    id: "p3",
    vendor: "Amazon Web Services",
    amount: 12450,
    currency: "INR",
    date: "2026-06-27",
    reference: "HDFC2026062799810",
    utr: "HDFC2026062799810",
    mode: "Bank Transfer",
    paidBy: "payments@biqadx.com",
    source: { channel: "HDFC Bank", detail: "•••• 9981" },
    status: "pending",
    linkedBillId: "b3",
  },
  {
    id: "p5",
    vendor: "Office Supplies Co.",
    amount: 4850,
    currency: "INR",
    date: "2026-06-25",
    reference: "PHPE25061900777",
    utr: "PHPE25061900777",
    mode: "UPI",
    paidBy: "finance@biqadx.com",
    source: { channel: "UPI", detail: "PhonePe" },
    status: "pending",
    linkedBillId: "b5",
  },
  {
    id: "p6",
    vendor: "Skyline Cloud Services",
    amount: 118000,
    currency: "INR",
    date: "2026-06-24",
    reference: "ICICI2026062488120",
    utr: "ICICI2026062488120",
    mode: "Bank Transfer",
    paidBy: "accounts@biqadx.com",
    source: { channel: "ICICI Bank", detail: "•••• 8812" },
    status: "matched",
    linkedBillId: "b6",
  },
];

export const bills: Bill[] = [
  {
    id: "b1",
    fileName: "INV-2026-1021.pdf",
    uploadedAt: "2026-06-29",
    vendor: "ABC Tech Solutions",
    vendorId: "v1",
    invoiceNumber: "INV-2026-1021",
    invoiceDate: "2026-06-29",
    dueDate: "2026-07-13",
    gstNumber: "29AABCA1429B1ZP",
    subtotal: 63559,
    gst: 11441,
    total: 75000,
    currency: "INR",
    description: "Website Development for company official site",
    items: [{ name: "Website Development", qty: 1, rate: 63559 }],
    matchScore: 95,
    status: "pending",
    confidence: 97,
    paymentId: "p1",
  },
  {
    id: "b2",
    fileName: "INV-2026-1020.pdf",
    uploadedAt: "2026-06-28",
    vendor: "Design Studio",
    vendorId: "v2",
    invoiceNumber: "INV-2026-1020",
    invoiceDate: "2026-06-28",
    dueDate: "2026-07-12",
    gstNumber: "27AABCD3456H1Z2",
    subtotal: 29661,
    gst: 5339,
    total: 35000,
    currency: "INR",
    description: "Brand identity & marketing collateral design",
    items: [{ name: "Brand identity package", qty: 1, rate: 29661 }],
    matchScore: 92,
    status: "pending",
    confidence: 94,
    paymentId: "p2",
  },
  {
    id: "b3",
    fileName: "INV-2026-1019.pdf",
    uploadedAt: "2026-06-27",
    vendor: "Amazon Web Services",
    vendorId: "v3",
    invoiceNumber: "INV-2026-1019",
    invoiceDate: "2026-06-27",
    dueDate: "2026-07-11",
    gstNumber: "—",
    subtotal: 10551,
    gst: 1899,
    total: 12450,
    currency: "INR",
    description: "Cloud hosting & compute — June 2026",
    items: [{ name: "EC2 + S3 usage", qty: 1, rate: 10551 }],
    matchScore: 90,
    status: "pending",
    confidence: 91,
    paymentId: "p3",
  },
  {
    id: "b4",
    fileName: "INV-2026-1018.pdf",
    uploadedAt: "2026-06-26",
    vendor: "Digital Marketing Pro",
    vendorId: "v4",
    invoiceNumber: "INV-2026-1018",
    invoiceDate: "2026-06-26",
    dueDate: "2026-07-10",
    gstNumber: "06AAFCD7788K1Z9",
    subtotal: 19068,
    gst: 3432,
    total: 22500,
    currency: "INR",
    description: "Performance marketing retainer — June",
    items: [{ name: "Ad management retainer", qty: 1, rate: 19068 }],
    matchScore: null,
    status: "no_match",
    confidence: 89,
    paymentId: null,
  },
  {
    id: "b5",
    fileName: "INV-2026-1017.pdf",
    uploadedAt: "2026-06-25",
    vendor: "Office Supplies Co.",
    vendorId: "v5",
    invoiceNumber: "INV-2026-1017",
    invoiceDate: "2026-06-25",
    dueDate: "2026-07-09",
    gstNumber: "33AAGCO5566L1Z1",
    subtotal: 4110,
    gst: 740,
    total: 4850,
    currency: "INR",
    description: "Stationery & pantry supplies",
    items: [{ name: "Office supplies", qty: 1, rate: 4110 }],
    matchScore: 88,
    status: "pending",
    confidence: 90,
    paymentId: "p5",
  },
  {
    id: "b6",
    fileName: "INV-2026-1016.pdf",
    uploadedAt: "2026-06-24",
    vendor: "Skyline Cloud Services",
    vendorId: "v6",
    invoiceNumber: "INV-2026-1016",
    invoiceDate: "2026-06-24",
    dueDate: "2026-07-08",
    gstNumber: "29AABCS1429B1ZP",
    subtotal: 100000,
    gst: 18000,
    total: 118000,
    currency: "INR",
    description: "Managed infrastructure retainer — June",
    items: [{ name: "Infra retainer", qty: 1, rate: 100000 }],
    matchScore: 98,
    status: "approved",
    confidence: 98,
    paymentId: "p6",
  },
];

/* ---- Vendors ---------------------------------------------------------------- */

export interface Vendor {
  id: string;
  name: string;
  gst: string;
  email: string;
  phone: string;
  address: string;
  category: string;
  notes?: string;
  paymentCount: number;
  invoiceCount: number;
  totalPaid: number;
}

export const vendors: Vendor[] = [
  { id: "v1", name: "ABC Tech Solutions", gst: "29AABCA1429B1ZP", email: "billing@abctech.io", phone: "+91 80 4567 8900", address: "Prestige Tech Park, Bengaluru 560103", category: "Software", paymentCount: 14, invoiceCount: 14, totalPaid: 980000 },
  { id: "v2", name: "Design Studio", gst: "27AABCD3456H1Z2", email: "accounts@designstudio.com", phone: "+91 22 3344 5566", address: "BKC, Mumbai 400051", category: "Marketing", paymentCount: 6, invoiceCount: 6, totalPaid: 210000 },
  { id: "v3", name: "Amazon Web Services", gst: "—", email: "aws-billing@amazon.com", phone: "+1 206 555 0100", address: "410 Terry Ave N, Seattle, WA", category: "Cloud", notes: "USD billed in INR by reseller.", paymentCount: 12, invoiceCount: 12, totalPaid: 149400 },
  { id: "v4", name: "Digital Marketing Pro", gst: "06AAFCD7788K1Z9", email: "finance@dmpro.in", phone: "+91 124 408 1100", address: "Cyber City, Gurugram 122002", category: "Marketing", paymentCount: 8, invoiceCount: 9, totalPaid: 180000 },
  { id: "v5", name: "Office Supplies Co.", gst: "33AAGCO5566L1Z1", email: "sales@officesupplies.in", phone: "+91 44 2233 1100", address: "Anna Salai, Chennai 600002", category: "Office Supplies", paymentCount: 9, invoiceCount: 9, totalPaid: 43600 },
  { id: "v6", name: "Skyline Cloud Services", gst: "29AABCS1429B1ZP", email: "billing@skylinecloud.io", phone: "+91 80 4567 1200", address: "Whitefield, Bengaluru 560066", category: "Hosting", paymentCount: 7, invoiceCount: 7, totalPaid: 826000 },
];

/* ---- Categories ------------------------------------------------------------- */

export interface Category {
  id: string;
  name: string;
  color: string;
  vendorCount: number;
  spend: number;
}

export const categories: Category[] = [
  { id: "c1", name: "Software", color: "#2563eb", vendorCount: 8, spend: 1240000 },
  { id: "c2", name: "Marketing", color: "#7c3aed", vendorCount: 5, spend: 390000 },
  { id: "c3", name: "Office Supplies", color: "#ea580c", vendorCount: 4, spend: 86000 },
  { id: "c4", name: "Hosting", color: "#0284c7", vendorCount: 3, spend: 826000 },
  { id: "c5", name: "Cloud", color: "#16a34a", vendorCount: 6, spend: 412000 },
  { id: "c6", name: "Travel", color: "#d97706", vendorCount: 7, spend: 158000 },
  { id: "c7", name: "Salary", color: "#dc2626", vendorCount: 2, spend: 0 },
  { id: "c8", name: "Freelancer", color: "#0891b2", vendorCount: 11, spend: 264000 },
  { id: "c9", name: "Subscription", color: "#9333ea", vendorCount: 9, spend: 132000 },
  { id: "c10", name: "Utilities", color: "#65a30d", vendorCount: 3, spend: 74000 },
];

/* ---- Gmail accounts --------------------------------------------------------- */

export interface GmailAccount {
  id: string;
  email: string;
  status: "connected" | "disconnected" | "expired" | "paused" | "syncing";
  unread: number;
  lastSync: string;
  synced: number;
}

export const gmailAccounts: GmailAccount[] = [
  { id: "g1", email: "finance@company.com", status: "connected", unread: 64, lastSync: "2 min ago", synced: 1284 },
  { id: "g2", email: "accounts@company.com", status: "connected", unread: 38, lastSync: "5 min ago", synced: 902 },
  { id: "g3", email: "payments@company.com", status: "syncing", unread: 26, lastSync: "now", synced: 651 },
  { id: "g4", email: "admin@company.com", status: "paused", unread: 0, lastSync: "2 days ago", synced: 410 },
];

/* ---- Synced emails ---------------------------------------------------------- */

export interface GmailEmail {
  id: string;
  account: string;
  from: string;
  fromName: string;
  subject: string;
  snippet: string;
  receivedAt: string;
  unread: boolean;
  amount: number | null;
  channel: string;
}

export const emails: GmailEmail[] = [
  { id: "e1", account: "finance@company.com", from: "alerts@axisbank.com", fromName: "Axis Bank", subject: "Payment of ₹75,000 successful", snippet: "Your account •••• 2773 has been debited ₹75,000 towards ABC Tech Solutions. UTR AXIS2026...", receivedAt: "2026-06-29T10:24:00", unread: true, amount: 75000, channel: "Axis Bank" },
  { id: "e2", account: "finance@company.com", from: "no-reply@googlepay.com", fromName: "Google Pay", subject: "₹35,000 paid to Design Studio", snippet: "You paid ₹35,000 to Design Studio via UPI. Transaction ID GPAY28061900042.", receivedAt: "2026-06-28T16:02:00", unread: true, amount: 35000, channel: "UPI" },
  { id: "e3", account: "payments@company.com", from: "alerts@hdfcbank.net", fromName: "HDFC Bank", subject: "Debit alert: ₹12,450", snippet: "INR 12,450.00 debited from a/c •••• 9981 towards Amazon Web Services on 27-Jun-2026.", receivedAt: "2026-06-27T09:11:00", unread: false, amount: 12450, channel: "HDFC Bank" },
  { id: "e4", account: "finance@company.com", from: "no-reply@phonepe.com", fromName: "PhonePe", subject: "Payment successful — ₹4,850", snippet: "₹4,850 paid to Office Supplies Co. Txn PHPE25061900777.", receivedAt: "2026-06-25T13:40:00", unread: false, amount: 4850, channel: "UPI" },
  { id: "e5", account: "accounts@company.com", from: "alerts@icicibank.com", fromName: "ICICI Bank", subject: "₹1,18,000 transferred", snippet: "Your a/c •••• 8812 debited ₹1,18,000 to Skyline Cloud Services. Ref ICICI2026062488120.", receivedAt: "2026-06-24T11:30:00", unread: false, amount: 118000, channel: "ICICI Bank" },
];

/* ---- Activity --------------------------------------------------------------- */

export interface Activity {
  id: string;
  action:
    | "email_synced"
    | "ai_extracted"
    | "ai_matched"
    | "approved"
    | "rejected"
    | "bill_uploaded"
    | "settings_changed";
  user: string;
  detail: string;
  at: string;
}

export const activity: Activity[] = [
  { id: "a1", action: "approved", user: "Admin User", detail: "Approved & marked paid: INV-2026-1016 (₹1,18,000) — Skyline Cloud Services", at: "2026-06-30T09:40:00" },
  { id: "a2", action: "ai_matched", user: "System", detail: "Matched INV-2026-1021 to Axis Bank payment (95% score)", at: "2026-06-30T09:12:00" },
  { id: "a3", action: "bill_uploaded", user: "Admin User", detail: "Uploaded INV-2026-1021.pdf", at: "2026-06-30T09:10:00" },
  { id: "a4", action: "ai_extracted", user: "System", detail: "Extracted invoice data from INV-2026-1021.pdf (97% confidence)", at: "2026-06-30T09:10:00" },
  { id: "a5", action: "email_synced", user: "System", detail: "Synced 5 new payment emails across 3 Gmail accounts", at: "2026-06-30T09:00:00" },
  { id: "a6", action: "rejected", user: "Admin User", detail: "Rejected match for INV-2026-1018 — amount mismatch", at: "2026-06-29T18:20:00" },
  { id: "a7", action: "settings_changed", user: "Admin User", detail: "Updated AI match threshold to 85%", at: "2026-06-29T17:05:00" },
];

export const actionLabels: Record<Activity["action"], string> = {
  email_synced: "Email Synced",
  ai_extracted: "AI Extracted",
  ai_matched: "AI Matched",
  approved: "Approved",
  rejected: "Rejected",
  bill_uploaded: "Bill Uploaded",
  settings_changed: "Settings Changed",
};

/* ---- Helpers ---------------------------------------------------------------- */

export function billPayment(bill: Bill): Payment | null {
  return bill.paymentId ? payments.find((p) => p.id === bill.paymentId) ?? null : null;
}
