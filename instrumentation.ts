// Runs once when the Node.js server starts (Next.js instrumentation hook).
// Keeps the Supabase project + connection pool warm so the dashboard and other
// pages don't pay a cold-start penalty after a quiet period. Hostinger runs a
// persistent Node process, so this interval lives for the app's lifetime.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Guard against duplicate intervals (HMR / multiple init in dev).
  const g = globalThis as unknown as { __prKeepWarm?: boolean };
  if (g.__prKeepWarm) return;
  g.__prKeepWarm = true;

  const { sql } = await import("@/lib/db");
  const ping = async () => {
    try {
      await sql`select 1`;
    } catch {
      /* ignore — next tick will retry */
    }
  };

  await ping(); // warm immediately on boot
  const iv = setInterval(ping, 3 * 60 * 1000); // every 3 minutes
  if (typeof iv.unref === "function") iv.unref();
}
