import { sql } from "../db/client";
import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
const directory = new URL("../db/migrations/", import.meta.url);
try {
  await sql`CREATE TABLE IF NOT EXISTS migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamp NOT NULL DEFAULT now())`;
  const files = (await readdir(directory))
    .filter((file) => /^\d+_[a-z0-9_]+\.sql$/.test(file))
    .sort();
  for (const file of files) {
    const source = await readFile(new URL(file, directory), "utf8");
    const name = file.slice(0, -4);
    await sql.begin(async (tx) => {
      await tx`SELECT pg_advisory_xact_lock(210312)`;
      const checksum = createHash("sha256").update(source).digest("hex");
      const rows = await tx`SELECT checksum FROM migrations WHERE name=${name}`;
      if (rows.length && rows[0].checksum !== checksum)
        throw new Error(
          `Migração ${name} foi modificada após aplicação. Crie uma nova migração.`,
        );
      if (!rows.length) {
        await tx.unsafe(source);
        await tx`INSERT INTO migrations (name,checksum) VALUES (${name},${checksum})`;
      }
      console.log(name, rows.length ? "já aplicada" : "aplicada");
    });
  }
} finally {
  await sql.end();
}
