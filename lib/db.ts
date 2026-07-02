import "server-only";
import postgres from "postgres";

declare global {
  // eslint-disable-next-line no-var
  var _payrecordSql: ReturnType<typeof postgres> | undefined;
}

function createClient() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set in .env.local");
  // Tuned for the Supabase transaction pooler (port 6543) on a managed host:
  // - prepare:false → required for the pooler
  // - max:5 → stay well under pooler connection limits
  // - idle_timeout / max_lifetime → recycle connections so stale ones from an
  //   idle app don't fail on reuse (the main cause of intermittent errors)
  return postgres(url, {
    ssl: "require",
    prepare: false,
    connect_timeout: 15,
    // Recycle idle connections quickly. The Supabase pgbouncer pooler closes
    // server-side connections after a short idle period; if we keep ours open
    // longer we end up reusing dead sockets and every query on them hangs
    // ~30s. A short idle_timeout drops them before they go stale.
    idle_timeout: 10,
    max_lifetime: 60 * 10,
    // Small pool, safely under the free-tier pooler client limit.
    max: 8,
  });
}

// Reuse one client per process (avoids leaking connections across hot reloads
// and reused serverless invocations).
export const sql = globalThis._payrecordSql ?? createClient();
globalThis._payrecordSql = sql;
