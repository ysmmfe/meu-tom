import "dotenv/config";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";
const globalDb = globalThis as unknown as {
  meuTomSql?: ReturnType<typeof postgres>;
};
export const sql =
  globalDb.meuTomSql ??
  postgres(
    process.env.DATABASE_URL ??
      "postgres://meutom:meutom@localhost:5434/meutom",
    { max: 8, connect_timeout: 5 },
  );
if (process.env.NODE_ENV !== "production") globalDb.meuTomSql = sql;
export const db = drizzle(sql, { schema, casing: "snake_case" });
