import { createHash } from "node:crypto";
import { eq, sql as fragment } from "drizzle-orm";
import { db, sql } from "../../db/client";
import {
  indexedSongs,
  indexedVariants,
  offlineDatasets,
} from "../../db/schema";
import {
  offlineExportSchema,
  prepareIndexRow,
} from "../../lib/catalog/offline";
export async function importOffline(input: unknown) {
  const raw = offlineExportSchema.parse(input);
  const accepted: Extract<ReturnType<typeof prepareIndexRow>, { ok: true }>[] =
    [];
  const rejected: Record<string, number> = {};
  for (const row of raw.rows) {
    const prepared = prepareIndexRow(row);
    if (prepared.ok) accepted.push(prepared);
    else rejected[prepared.reason] = (rejected[prepared.reason] ?? 0) + 1;
  }
  if (!accepted.length)
    throw new Error(
      "Nenhum conjunto integralmente reconhecido; catálogo não alterado.",
    );
  if (new Set(accepted.map((row) => row.song.id)).size !== accepted.length)
    throw new Error("Identidades duplicadas no corpus.");
  const datasetId = "chorrrds";
  const report = {
    inputGroups: raw.rows.length,
    accepted: accepted.length,
    rejected,
    variants: accepted.length * 12,
    exportSha256: createHash("sha256")
      .update(JSON.stringify(raw))
      .digest("hex"),
  };
  await db.transaction(async (tx) => {
    await tx.execute(fragment`SELECT pg_advisory_xact_lock(210314)`);
    await tx
      .insert(offlineDatasets)
      .values({
        id: datasetId,
        provider: "chorrrds",
        revision: raw.revision,
        sha256: raw.sha256,
        sourceUrl: `https://github.com/r-music/chorrrds/blob/${raw.revision}/data/all.rda`,
        license: "MIT (repositório chorrrds)",
        rightsNotice:
          "Índice local de fatos harmônicos e metadados. Sem letras, sequências ordenadas ou cifras completas. A licença do repositório não transfere direitos das obras. Não homologado para redistribuição pública do repertório.",
        report,
      })
      .onConflictDoUpdate({
        target: offlineDatasets.id,
        set: { report, importedAt: new Date() },
      });
    await tx.delete(indexedSongs).where(eq(indexedSongs.datasetId, datasetId));
    for (let n = 0; n < accepted.length; n += 300) {
      const chunk = accepted.slice(n, n + 300);
      await tx
        .insert(indexedSongs)
        .values(chunk.map(({ song }) => ({ ...song, datasetId })));
      const variants = chunk.flatMap((row) => row.variants);
      for (let k = 0; k < variants.length; k += 1000)
        await tx.insert(indexedVariants).values(variants.slice(k, k + 1000));
    }
  });
  await sql`ANALYZE indexed_songs`;
  await sql`ANALYZE indexed_variants`;
  return report;
}
