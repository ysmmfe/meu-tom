import { createHash, randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { slugify } from "../../lib/slug";
import { ContentError } from "../../lib/errors";
import { db } from "../../db/client";
import {
  artists,
  songs,
  sources,
  versions,
  sections,
  occurrences,
} from "../../db/schema";
import {
  parseChordPro,
  plainToChordPro,
  documentChords,
} from "../../lib/parsers/chordpro";
import { complexity, chordIdentity } from "../../lib/music/chords";
import { rawSongSchema, type RawSong } from "../providers/types";
export async function ingest(input: RawSong) {
  const raw = rawSongSchema.parse(input);
  if (
    !raw.source.publishable ||
    !raw.source.permission.trim() ||
    /unknown|desconhecid/i.test(raw.source.license)
  )
    throw new ContentError("Publicação exige licença e permissão explícitas.");
  const doc = parseChordPro(
    raw.format === "plain" ? plainToChordPro(raw.content) : raw.content,
  );
  if (!doc.sections.length || !documentChords(doc).length)
    throw new ContentError("Cifra vazia ou sem acordes estruturados.");
  const progression = documentChords(doc),
    chords = [...new Set(progression)];
  const revision = createHash("sha256")
    .update(JSON.stringify(raw))
    .digest("hex");
  const artistSlug = slugify(raw.artist);
  if (!artistSlug) throw new ContentError("Artista sem identificador válido.");
  return db.transaction(async (tx) => {
    // Serializes duplicate concurrent imports; slugs/URLs also have unique constraints.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(210313)`);
    const [artist] = await tx
      .insert(artists)
      .values({ id: randomUUID(), name: raw.artist, slug: artistSlug })
      .onConflictDoUpdate({ target: artists.slug, set: { name: raw.artist } })
      .returning();
    const [source] = await tx
      .insert(sources)
      .values({
        id: randomUUID(),
        provider: raw.source.provider,
        url: raw.source.url,
        license: raw.source.license,
        permission: raw.source.permission,
        status: "published",
      })
      .onConflictDoUpdate({
        target: sources.url,
        set: {
          license: raw.source.license,
          permission: raw.source.permission,
          fetchedAt: new Date(),
        },
      })
      .returning();
    const [existing] = await tx
      .select()
      .from(versions)
      .where(eq(versions.sourceId, source.id));
    const values = {
      title: raw.title,
      artistId: artist.id,
      genre: raw.genre,
      originalKey: doc.key,
      originalCapo: doc.capo,
      difficulty: Math.round(chords.reduce((n, c) => n + complexity(c), 0)),
      chords,
      progression,
      updatedAt: new Date(),
    };
    let song;
    if (existing) {
      [song] = await tx
        .update(songs)
        .set(values)
        .where(eq(songs.id, existing.songId))
        .returning();
    } else {
      [song] = await tx
        .insert(songs)
        .values({ id: randomUUID(), slug: raw.slug, ...values })
        .onConflictDoUpdate({ target: songs.slug, set: values })
        .returning();
    }
    const versionId = existing?.id ?? randomUUID();
    // The compact summary belongs to the current canonical version only.
    await tx
      .update(versions)
      .set({ status: "archived" })
      .where(eq(versions.songId, song.id));
    await tx
      .insert(versions)
      .values({
        id: versionId,
        songId: song.id,
        sourceId: source.id,
        revision,
        status: "available",
        warnings: doc.warnings,
      })
      .onConflictDoUpdate({
        target: versions.id,
        set: { revision, status: "available", warnings: doc.warnings },
      });
    await tx.delete(sections).where(eq(sections.versionId, versionId));
    for (const [order, section] of doc.sections.entries()) {
      const sectionId = randomUUID();
      await tx.insert(sections).values({
        id: sectionId,
        versionId,
        name: section.name,
        order,
        repeat: section.repeat,
        lines: section.lines,
      });
      const rows = section.lines.flatMap((line, lineIndex) => {
        let position = 0;
        return line.flatMap((part, order) => {
          const anchor = position;
          position += part.text.length;
          return part.chord
            ? [
                {
                  id: randomUUID(),
                  sectionId,
                  symbol: part.chord,
                  normalized: chordIdentity(part.chord),
                  line: lineIndex,
                  position: anchor,
                  order,
                },
              ]
            : [];
        });
      });
      if (rows.length) await tx.insert(occurrences).values(rows);
    }
    return { slug: song.slug, revision, warnings: doc.warnings };
  });
}
