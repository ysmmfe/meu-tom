import { and, or, eq, ilike, asc, sql as fragment } from "drizzle-orm";
import { sql } from "../../db/client";
import { searchIndex, getIndexedSong } from "./offline";
import { foldText } from "../../lib/catalog/offline";
import { z } from "zod";
import { db } from "../../db/client";
import { songs, artists, versions, sources, sections } from "../../db/schema";
import { adaptations } from "../../lib/music/adaptation";
import type { SongDocument } from "../../lib/parsers/chordpro";
import { parseChord } from "../../lib/music/chords";
export const searchSchema = z.object({
  known: z
    .string()
    .max(1000)
    .default("")
    .transform((s) =>
      s
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean),
    )
    .refine(
      (c) => c.length <= 40 && c.every((v) => parseChord(v) !== null),
      "Acordes inválidos",
    ),
  catalog: z.enum(["all", "full", "index"]).default("all"),
  q: z.string().max(200).default(""),
  title: z.string().max(200).default(""),
  artist: z.string().max(200).default(""),
  genre: z.string().max(80).default(""),
  sort: z.enum(["ease", "title", "artist", "fewest"]).default("ease"),
  transpose: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
  capo: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
  playable: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
  extra: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  page: z.coerce.number().int().min(1).max(10000).default(1),
});
export type SearchInput = z.infer<typeof searchSchema>;
const escaped = (s: string) => s.replace(/[\\%_]/g, (c) => "\\" + c);
export async function searchSongs(input: SearchInput) {
  const genreRows = await db
    .selectDistinct({ genre: songs.genre })
    .from(songs)
    .innerJoin(versions, eq(versions.songId, songs.id))
    .innerJoin(sources, eq(sources.id, versions.sourceId))
    .where(
      and(eq(sources.status, "published"), eq(versions.status, "available")),
    )
    .orderBy(asc(songs.genre));
  const indexGenres =
    input.catalog === "full"
      ? []
      : await sql<
          { genre: string }[]
        >`SELECT DISTINCT genre FROM indexed_songs ORDER BY genre`;
  const genres = [
    ...new Set([
      ...(input.catalog === "index" ? [] : genreRows.map((row) => row.genre)),
      ...indexGenres.map((row) => row.genre),
    ]),
  ].sort();
  if (!input.known.length)
    return { items: [], total: 0, page: input.page, pageSize: 6, genres };
  // Only compact harmonic summaries are read, never section/lyric payloads during search.
  const rows =
    input.catalog === "index"
      ? []
      : await db
          .select({ song: songs, artist: artists.name })
          .from(songs)
          .innerJoin(artists, eq(artists.id, songs.artistId))
          .innerJoin(versions, eq(versions.songId, songs.id))
          .innerJoin(sources, eq(sources.id, versions.sourceId))
          .where(
            and(
              eq(versions.status, "available"),
              eq(sources.status, "published"),
              input.q
                ? or(
                    ilike(
                      fragment`unaccent(${songs.title})`,
                      `%${escaped(foldText(input.q))}%`,
                    ),
                    ilike(
                      fragment`unaccent(${artists.name})`,
                      `%${escaped(foldText(input.q))}%`,
                    ),
                  )
                : undefined,
              input.title
                ? ilike(
                    fragment`unaccent(${songs.title})`,
                    `%${escaped(foldText(input.title))}%`,
                  )
                : undefined,
              input.artist
                ? ilike(
                    fragment`unaccent(${artists.name})`,
                    `%${escaped(foldText(input.artist))}%`,
                  )
                : undefined,
              input.genre ? eq(songs.genre, input.genre) : undefined,
            ),
          );
  const unique = [...new Map(rows.map((r) => [r.song.id, r])).values()];
  const ranked = unique
    .map(({ song, artist }) => {
      const best = adaptations(
        {
          chords: song.chords,
          progression: song.progression,
          originalKey: song.originalKey,
          originalCapo: song.originalCapo,
        },
        input.known,
        input,
      )[0];
      return {
        availability: "full" as const,
        slug: song.slug,
        title: song.title,
        artist,
        genre: song.genre,
        adaptation: best,
      };
    })
    .filter((r) =>
      input.playable
        ? r.adaptation.compatible ||
          (input.extra && r.adaptation.unknown.length === 1)
        : true,
    );
  const indexed = await searchIndex(input);
  const combined = [...ranked, ...indexed.items];
  const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
  combined.sort(
    (a, b) =>
      Number(b.adaptation.compatible) - Number(a.adaptation.compatible) ||
      (input.sort === "title"
        ? compare(foldText(a.title), foldText(b.title))
        : input.sort === "artist"
          ? compare(foldText(a.artist), foldText(b.artist))
          : input.sort === "fewest"
            ? a.adaptation.chords.length - b.adaptation.chords.length
            : a.adaptation.score - b.adaptation.score) ||
      compare(foldText(a.title), foldText(b.title)) ||
      compare(foldText(a.artist), foldText(b.artist)) ||
      compare(a.slug, b.slug),
  );
  return {
    items: combined.slice((input.page - 1) * 6, input.page * 6),
    total: ranked.length + indexed.total,
    page: input.page,
    pageSize: 6,
    genres,
  };
}
export type SearchResult = z.infer<
  typeof import("../../lib/contracts").searchResultSchema
>;
export async function getSong(slug: string) {
  const [row] = await db
    .select({
      song: songs,
      artist: artists.name,
      version: versions,
      source: sources,
    })
    .from(songs)
    .innerJoin(artists, eq(artists.id, songs.artistId))
    .innerJoin(versions, eq(versions.songId, songs.id))
    .innerJoin(sources, eq(sources.id, versions.sourceId))
    .where(
      and(
        eq(songs.slug, slug),
        eq(versions.status, "available"),
        eq(sources.status, "published"),
      ),
    )
    .orderBy(asc(versions.id))
    .limit(1);
  if (!row) return null;
  const parts = await db
    .select()
    .from(sections)
    .where(eq(sections.versionId, row.version.id))
    .orderBy(asc(sections.order));
  const document: SongDocument = {
    title: row.song.title,
    artist: row.artist,
    key: row.song.originalKey,
    capo: row.song.originalCapo,
    warnings: row.version.warnings,
    sections: parts.map((s) => ({
      name: s.name,
      repeat: s.repeat,
      lines: s.lines,
    })),
  };
  return {
    availability: "full" as const,
    slug: row.song.slug,
    title: row.song.title,
    artist: row.artist,
    genre: row.song.genre,
    summary: {
      chords: row.song.chords,
      progression: row.song.progression,
      originalKey: row.song.originalKey,
      originalCapo: row.song.originalCapo,
    },
    document,
    source: {
      provider: row.source.provider,
      url: row.source.url,
      license: row.source.license,
      permission: row.source.permission,
    },
  };
}
export type SongDetail = NonNullable<Awaited<ReturnType<typeof getSong>>>;
export async function getCatalogEntry(slug: string) {
  return (await getSong(slug)) ?? (await getIndexedSong(slug));
}
