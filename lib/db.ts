import "server-only";
import postgres from "postgres";

declare global {
  // eslint-disable-next-line no-var
  var _payrecordSql: ReturnType<typeof postgres> | undefined;
}

function createClient() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set in .env.local");
  // prepare:false → compatible with Supabase transaction pooler (port 6543)
  return postgres(url, { ssl: "require", prepare: false, connect_timeout: 15 });
}

export const sql = globalThis._payrecordSql ?? createClient();
if (process.env.NODE_ENV !== "production") globalThis._payrecordSql = sql;
