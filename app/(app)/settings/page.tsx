"use client";

import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Field, Select } from "@/components/ui/input";
import { PageHeader } from "@/components/layout/page-header";
import { StorageCard } from "@/components/storage-card";
import { AutoSyncToggle } from "@/components/auto-sync-toggle";
import { LogoSetting } from "@/components/logo-setting";
import { company } from "@/lib/mock-data";

export default function SettingsPage() {
  function save(e: React.FormEvent) {
    e.preventDefault();
    toast.success("Settings saved");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Company details used across invoices, matching and reports."
      />

      <LogoSetting />

      <AutoSyncToggle />

      <StorageCard />

      <form onSubmit={save} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Company Profile</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Company Name" className="sm:col-span-2">
              <Input defaultValue={company.name} />
            </Field>
            <Field label="Billing Email">
              <Input defaultValue={company.email} />
            </Field>
            <Field label="Phone">
              <Input defaultValue="+91 22 4000 1234" />
            </Field>
            <Field label="Address" className="sm:col-span-2">
              <Input defaultValue="One BKC, Bandra Kurla Complex, Mumbai 400051" />
            </Field>
            <Field label="Website">
              <Input defaultValue="www.biqadx.com" />
            </Field>
            <Field label="Logo" hint="PNG or SVG, transparent background">
              <Input type="file" className="file:mr-3 file:rounded file:border-0 file:bg-surface-muted file:px-2 file:py-1 file:text-xs" />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tax &amp; Identity</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="GSTIN">
              <Input defaultValue={company.gst} />
            </Field>
            <Field label="PAN">
              <Input defaultValue="AAACA1234A" />
            </Field>
            <Field label="Default Currency">
              <Select defaultValue="INR">
                <option>INR</option>
                <option>USD</option>
                <option>EUR</option>
              </Select>
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>AI &amp; Matching</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Auto-match threshold (%)" hint="Auto-link above this score">
              <Input type="number" defaultValue={90} />
            </Field>
            <Field label="Low-confidence flag (%)" hint="Below this needs review">
              <Input type="number" defaultValue={85} />
            </Field>
            <Field label="Sync frequency">
              <Select defaultValue="5 min">
                <option>2 min</option>
                <option>5 min</option>
                <option>15 min</option>
              </Select>
            </Field>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => toast("Changes discarded")}>
            Cancel
          </Button>
          <Button type="submit">Save changes</Button>
        </div>
      </form>
    </div>
  );
}
