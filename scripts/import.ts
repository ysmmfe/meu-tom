import "dotenv/config";
import { readFile } from "node:fs/promises";
import { ingest } from "../server/services/ingest";
import { CifraClubProvider } from "../server/providers/cifraclub";
import { sql } from "../db/client";
try {
  const [mode, id, license, permission] = process.argv.slice(2);
  if (mode === "file" && id)
    console.log(await ingest(JSON.parse(await readFile(id, "utf8"))));
  else if (mode === "cifra" && id && license && permission) {
    const provider = new CifraClubProvider({
      enabled: process.env.CIFRA_IMPORT_ENABLED === "true",
      origin: process.env.CIFRA_API_ORIGIN || "https://www.cifraclub.com.br/",
      mode: process.env.CIFRA_API_ORIGIN ? "api" : "html",
      license,
      permission,
    });
    console.log(await ingest(await provider.fetch(id)));
  } else
    throw new Error(
      'Uso: npm run import -- file caminho.json OU cifra artista/musica licença "permissão documentada"',
    );
} catch (error) {
  console.error(
    "Falha de importação:",
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
} finally {
  await sql.end();
}
