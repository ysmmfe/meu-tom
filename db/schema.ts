import {
  pgTable,
  text,
  timestamp,
  integer,
  jsonb,
  index,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/pg-core";
import type { Segment } from "../lib/parsers/chordpro";
export const artists = pgTable(
  "artists",
  {
    id: text().primaryKey(),
    name: text().notNull(),
    slug: text().notNull().unique(),
  },
  (t) => [index("artist_name_idx").on(t.name)],
);
export const songs = pgTable(
  "songs",
  {
    id: text().primaryKey(),
    title: text().notNull(),
    slug: text().notNull().unique(),
    artistId: text()
      .notNull()
      .references(() => artists.id),
    genre: text().notNull(),
    originalKey: text(),
    language: text().notNull().default("pt-BR"),
    difficulty: integer().notNull(),
    chords: jsonb().$type<string[]>().notNull(),
    progression: jsonb().$type<string[]>().notNull(),
    originalCapo: integer().notNull().default(0),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp().notNull().defaultNow(),
  },
  (t) => [
    index("song_title_idx").on(t.title),
    index("song_genre_idx").on(t.genre),
    index("song_artist_idx").on(t.artistId),
  ],
);
export const sources = pgTable("sources", {
  id: text().primaryKey(),
  provider: text().notNull(),
  url: text().notNull().unique(),
  license: text().notNull(),
  permission: text().notNull(),
  status: text().notNull(),
  fetchedAt: timestamp().notNull().defaultNow(),
});
export const versions = pgTable(
  "song_versions",
  {
    id: text().primaryKey(),
    songId: text()
      .notNull()
      .references(() => songs.id),
    sourceId: text()
      .notNull()
      .references(() => sources.id),
    revision: text().notNull(),
    status: text().notNull(),
    warnings: jsonb().$type<string[]>().notNull(),
  },
  (t) => [uniqueIndex("version_source_idx").on(t.sourceId)],
);
export const sections = pgTable("song_sections", {
  id: text().primaryKey(),
  versionId: text()
    .notNull()
    .references(() => versions.id, { onDelete: "cascade" }),
  name: text().notNull(),
  order: integer().notNull(),
  repeat: integer().notNull(),
  lines: jsonb().$type<Segment[][]>().notNull(),
});
export const offlineDatasets = pgTable("offline_datasets", {
  id: text().primaryKey(),
  provider: text().notNull(),
  revision: text().notNull(),
  sha256: text().notNull(),
  sourceUrl: text().notNull(),
  license: text().notNull(),
  rightsNotice: text().notNull(),
  importedAt: timestamp().notNull().defaultNow(),
  report: jsonb().notNull(),
});
export const indexedSongs = pgTable("indexed_songs", {
  id: text().primaryKey(),
  slug: text().notNull().unique(),
  datasetId: text()
    .notNull()
    .references(() => offlineDatasets.id),
  rawArtist: text().notNull(),
  rawTitle: text().notNull(),
  artist: text().notNull(),
  title: text().notNull(),
  artistKey: text().notNull(),
  titleKey: text().notNull(),
  genre: text().notNull(),
  chords: jsonb().$type<string[]>().notNull(),
  declaredKey: text(),
});
export const indexedVariants = pgTable(
  "indexed_variants",
  {
    songId: text()
      .notNull()
      .references(() => indexedSongs.id, { onDelete: "cascade" }),
    shift: integer().notNull(),
    identities: text().array().notNull(),
    complexity: integer().notNull(),
  },
  (t) => [primaryKey({ columns: [t.songId, t.shift] })],
);
export const occurrences = pgTable(
  "chord_occurrences",
  {
    id: text().primaryKey(),
    sectionId: text()
      .notNull()
      .references(() => sections.id, { onDelete: "cascade" }),
    symbol: text().notNull(),
    normalized: text().notNull(),
    line: integer().notNull(),
    position: integer().notNull(),
    order: integer().notNull(),
  },
  (t) => [index("chord_normalized_idx").on(t.normalized)],
);
