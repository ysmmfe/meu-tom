import { LocalProvider } from "../server/providers/local";
import { ingest } from "../server/services/ingest";
import { sql } from "../db/client";
try {
  const provider = new LocalProvider();
  for (const song of await provider.find(""))
    console.log("Importado", await ingest(await provider.fetch(song.id)));
} finally {
  await sql.end();
}
