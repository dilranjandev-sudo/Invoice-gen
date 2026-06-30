/** Shape returned by the AI invoice extractor. Safe to import on the client. */
export interface InvoiceItem {
  name: string | null;
  hsn: string | null;
  qty: number | null;
  unitPrice: number | null;
  gst: number | null;
  amount: number | null;
}

export interface ExtractedInvoice {
  // Vendor (seller / supplier)
  vendor: string | null;
  vendorGstin: string | null;
  vendorAddress: string | null;
  vendorPhone: string | null;
  vendorEmail: string | null;
  // Buyer (bill-to)
  buyer: string | null;
  buyerGstin: string | null;
  // Invoice meta
  invoiceNumber: string | null;
  invoiceDate: string | null; // YYYY-MM-DD
  dueDate: string | null; // YYYY-MM-DD
  placeOfSupply: string | null;
  currency: string | null;
  // Amounts
  subtotal: number | null; // taxable amount
  cgst: number | null;
  sgst: number | null;
  igst: number | null;
  gst: number | null; // total tax
  total: number | null; // grand total
  amountPaid: number | null;
  balance: number | null;
  status: "paid" | "partial" | "unpaid" | null;
  // Overall extraction confidence (0–100)
  confidence: number | null;
  // Line items
  items: InvoiceItem[];
  // Bank details
  bankName: string | null;
  bankAccount: string | null;
  bankIfsc: string | null;
}
