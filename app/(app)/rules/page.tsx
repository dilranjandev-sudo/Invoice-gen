"use client";

import { useState } from "react";
import { Plus, FileText, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { cn } from "@/lib/utils";

interface Rule {
  id: string;
  title: string;
  desc: string;
  on?: boolean;
  locked?: boolean;
}

const extractionRules: Rule[] = [
  { id: "x1", title: "Auto-extract on upload", desc: "Run AI extraction the moment a PDF is uploaded or arrives via Gmail." },
  { id: "x2", title: "Flag low confidence", desc: "If extraction confidence is below 85%, mark the invoice as Needs Review." },
  { id: "x3", title: "Auto-assign vendor", desc: "Match the vendor automatically using GST number or sender email." },
];

const matchingRules: Rule[] = [
  { id: "m1", title: "Auto-match threshold", desc: "Automatically link an invoice to a payment when the match score is 90% or higher." },
  { id: "m2", title: "Prioritise reference / UTR", desc: "Give the highest weight to a matching reference number or UTR." },
  { id: "m3", title: "Require approval before paid", desc: "Never mark a record as paid without human approval.", locked: true },
];

export default function RulesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Rules"
        description="Control how PayRecord extracts invoices and matches them to payments."
        actions={
          <Button onClick={() => toast.success("New rule created")}>
            <Plus className="size-4" /> New Rule
          </Button>
        }
      />

      <RuleGroup
        icon={<FileText className="size-4 text-primary" />}
        title="Invoice Extraction"
        rules={extractionRules.map((r) => ({ ...r, on: true }))}
      />
      <RuleGroup
        icon={<CreditCard className="size-4 text-violet" />}
        title="Payment Matching"
        rules={matchingRules.map((r) => ({ ...r, on: true }))}
      />
    </div>
  );
}

function RuleGroup({
  icon,
  title,
  rules,
}: {
  icon: React.ReactNode;
  title: string;
  rules: Rule[];
}) {
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        {icon} {title}
      </h2>
      <Card className="overflow-hidden">
        <div className="divide-y divide-border">
          {rules.map((r) => (
            <RuleRow key={r.id} rule={r} />
          ))}
        </div>
      </Card>
    </section>
  );
}

function RuleRow({ rule }: { rule: Rule }) {
  const [on, setOn] = useState(rule.on);
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-4">
      <div className="min-w-0">
        <div className="text-sm font-medium">{rule.title}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">{rule.desc}</div>
      </div>
      <button
        disabled={rule.locked}
        onClick={() => {
          setOn((v) => !v);
          toast(on ? "Rule turned off" : "Rule turned on");
        }}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-60",
          on ? "bg-primary" : "bg-border-strong"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-5 rounded-full bg-white shadow-sm transition-all",
            on ? "left-[1.375rem]" : "left-0.5"
          )}
        />
      </button>
    </div>
  );
}
