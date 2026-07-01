import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { AutoSync } from "@/components/auto-sync";
import { SyncProvider } from "@/components/sync-provider";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SyncProvider>
      <div className="flex h-screen overflow-hidden">
        <AutoSync />
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-7xl px-5 py-6 lg:px-8">{children}</div>
          </main>
        </div>
      </div>
    </SyncProvider>
  );
}
