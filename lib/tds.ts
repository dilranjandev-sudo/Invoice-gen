// TDS sections & rates (India) — computed locally, no external service.
// Rates are the common ones; a CA can adjust per case.
export const TDS_SECTIONS = [
  { code: "none", label: "No TDS", rate: 0 },
  { code: "194C", label: "194C — Contractor / sub-contractor", rate: 2 },
  { code: "194J", label: "194J — Professional / technical fees", rate: 10 },
  { code: "194I", label: "194I — Rent (land/building)", rate: 10 },
  { code: "194H", label: "194H — Commission / brokerage", rate: 2 },
  { code: "194Q", label: "194Q — Purchase of goods", rate: 0.1 },
] as const;

export type TdsCode = (typeof TDS_SECTIONS)[number]["code"];

export function tdsRate(code: string | null | undefined): number {
  return TDS_SECTIONS.find((s) => s.code === code)?.rate ?? 0;
}

export function tdsLabel(code: string | null | undefined): string {
  return TDS_SECTIONS.find((s) => s.code === code)?.label ?? "No TDS";
}
