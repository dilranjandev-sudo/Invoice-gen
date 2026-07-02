import postgres from "postgres";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
function loadUrl() {
  for (const f of [".env.local", ".env"]) {
    try {
      const txt = readFileSync(join(root, f), "utf8");
      const m = txt.match(/^DATABASE_URL=(.+)$/m);
      if (m) return m[1].trim().replace(/^["']|["']$/g, "");
    } catch {}
  }
  throw new Error("DATABASE_URL not found");
}

const sql = postgres(loadUrl(), { ssl: "require", prepare: false, max: 1, connect_timeout: 30 });
try {
  await sql`alter table payments add column if not exists reconciled boolean default false`;
  console.log("OK — payments.reconciled added");
} catch (e) {
  console.error("MIGRATION FAILED:", e.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
