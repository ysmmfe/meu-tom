import { eq } from "drizzle-orm";
import { db } from "../../db/client";
import {
  offlineDatasets,
  indexedSongs,
  indexedVariants,
} from "../../db/schema";
import { prepareIndexRow } from "../../lib/catalog/offline";
export async function removeIndexFixture(datasetId: string) {
  await db.transaction(async (tx) => {
    await tx.delete(indexedSongs).where(eq(indexedSongs.datasetId, datasetId));
    await tx.delete(offlineDatasets).where(eq(offlineDatasets.id, datasetId));
  });
}
export async function seedIndexFixture(
  datasetId: string,
  artist = "Autor de índice de teste",
) {
  await removeIndexFixture(datasetId);
  await db.transaction(async (tx) => {
    await tx.insert(offlineDatasets).values({
      id: datasetId,
      provider: "fixture-original-CC0",
      revision: "1",
      sha256: "fixture-original-nao-e-corpus",
      sourceUrl: "https://example.invalid/fixture",
      license: "CC0-1.0",
      rightsNotice:
        "Dados sintéticos autorais para testes, não são repertório de terceiros.",
      report: { test: true },
    });
    for (let n = 0; n < 8; n++) {
      const result = prepareIndexRow({
        artist,
        music: `${artist} Exercício do índice ${n}`,
        genre: "Teste de integração",
        chords: ["A", "E", "F#m", "D"],
        keys: ["A"],
      });
      if (!result.ok) throw new Error("Fixture inválida");
      await tx.insert(indexedSongs).values({ ...result.song, datasetId });
      await tx.insert(indexedVariants).values(result.variants);
    }
  });
}
