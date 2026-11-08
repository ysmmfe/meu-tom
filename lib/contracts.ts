import { z } from "zod";
import { documentSchema } from "./parsers/chordpro";
export const adaptationSchema = z.object({
  originalChords: z.array(z.string()),
  chords: z.array(z.string()),
  semitones: z.number().int(),
  capo: z.number().int().min(0).max(7),
  originalKey: z.string().nullable(),
  shapeKey: z.string().nullable(),
  effectiveKey: z.string().nullable(),
  unknown: z.array(z.string()),
  compatible: z.boolean(),
  category: z.enum([
    "original",
    "capo",
    "transposed",
    "transposed-preserved",
    "one-more",
    "multiple",
    "not-recommended",
  ]),
  score: z.number().finite(),
  preservesKey: z.boolean().nullable(),
  warnings: z.array(z.string()),
});
export const songDetailSchema = z.object({
  availability: z.literal("full"),
  slug: z.string(),
  title: z.string(),
  artist: z.string(),
  genre: z.string(),
  summary: z.object({
    chords: z.array(z.string()),
    progression: z.array(z.string()),
    originalKey: z.string().nullable(),
    originalCapo: z.number().int().min(0).max(7),
  }),
  document: documentSchema,
  source: z.object({
    provider: z.string(),
    url: z.string(),
    license: z.string(),
    permission: z.string(),
  }),
});
export const indexedSongSchema = z.object({
  availability: z.literal("index-only"),
  slug: z.string(),
  title: z.string(),
  artist: z.string(),
  genre: z.string(),
  chords: z.array(z.string()),
  declaredKey: z.string().nullable(),
  source: z.object({
    provider: z.string(),
    url: z.string(),
    revision: z.string(),
    license: z.string(),
    rightsNotice: z.string(),
    rawArtist: z.string(),
    rawTitle: z.string(),
  }),
});
export const catalogEntrySchema = z.discriminatedUnion("availability", [
  songDetailSchema,
  indexedSongSchema,
]);
export const adaptationResponseSchema = z.object({
  adaptation: adaptationSchema,
  options: z.array(adaptationSchema),
  document: documentSchema,
});
export const searchResultSchema = z.object({
  items: z.array(
    z.object({
      availability: z.enum(["full", "index-only"]),
      slug: z.string(),
      title: z.string(),
      artist: z.string(),
      genre: z.string(),
      adaptation: adaptationSchema,
    }),
  ),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  pageSize: z.number().int().positive(),
  genres: z.array(z.string()),
});
