import { readFile, stat } from "node:fs/promises";
import { importOffline } from "../server/services/import-offline";
import { sql } from "../db/client";
try {
  const [file, ack] = process.argv.slice(2);
  if (!file || ack !== "--local-index")
    throw new Error(
      "Uso: npm run catalog:import -- export.json --local-index. Apenas índice local; não autoriza publicação de cifras.",
    );
  if ((await stat(file)).size > 25_000_000)
    throw new Error("Arquivo excede 25 MB.");
  console.log(
    JSON.stringify(
      await importOffline(JSON.parse(await readFile(file, "utf8"))),
      null,
      2,
    ),
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await sql.end();
}
