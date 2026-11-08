import { createHash } from "node:crypto";
import { z } from "zod";
import {
  parseChord,
  chordIdentity,
  complexity,
  transposeChord,
} from "../music/chords";
import { slugify } from "../slug";
export const foldText = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
const rowSchema = z.object({
  artist: z.string().min(1).max(200),
  music: z.string().min(1).max(500),
  genre: z.string().max(80),
  chords: z.array(z.string()).min(1).max(1000),
  keys: z.array(z.string()).max(30),
});
export const offlineExportSchema = z.object({
  provider: z.literal("chorrrds"),
  revision: z.literal("e01864278aab879fbc13e21d5eb89e365b16741d"),
  sha256: z.literal(
    "0fefd3d830e9a982fdc5a837a6f0bc2bc0cc8a5987d1c9229567896cda3c0ca9",
  ),
  rows: z.array(rowSchema).min(1).max(15000),
});
export type OfflineRow = z.infer<typeof rowSchema>;
const titleCase = (text: string) =>
  text
    .split(" ")
    .map((word, i) =>
      i > 0 && ["de", "da", "do", "das", "dos", "e", "a", "o"].includes(word)
        ? word
        : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(" ");
const variantCache = new Map<
  string,
  { symbol: string; identity: string; complexity: number }[]
>();
function chordVariants(chord: string) {
  let cached = variantCache.get(chord);
  if (!cached) {
    cached = Array.from({ length: 12 }, (_, n) => (n > 6 ? n - 12 : n)).map(
      (shift) => {
        const symbol = transposeChord(chord, shift);
        return {
          symbol,
          identity: chordIdentity(symbol),
          complexity: complexity(symbol),
        };
      },
    );
    if (variantCache.size > 4096) variantCache.clear();
    variantCache.set(chord, cached);
  }
  return cached;
}
export function prepareIndexRow(raw: OfflineRow) {
  const artistKey = foldText(raw.artist),
    music = foldText(raw.music);
  if (!artistKey || !music.startsWith(artistKey + " "))
    return { ok: false as const, reason: "title-prefix" };
  const titleKey = music.slice(artistKey.length + 1).trim();
  if (!titleKey || !slugify(titleKey))
    return { ok: false as const, reason: "empty-title" };
  const input = raw.chords.map((chord) => chord.trim());
  if (input.some((chord) => chord.length > 40 || !parseChord(chord)))
    return { ok: false as const, reason: "unsupported-symbol" };
  // No sequence, lyric snippets or invented anchors: persist only the unordered harmonic set.
  const chords = [
    ...new Map(input.map((chord) => [chordIdentity(chord), chord])).values(),
  ].sort();
  if (chords.length > 40)
    return { ok: false as const, reason: "too-many-chords" };
  const id = createHash("sha256")
    .update(JSON.stringify([raw.artist, raw.music]))
    .digest("hex");
  return {
    ok: true as const,
    song: {
      id,
      slug: `indice-${slugify(artistKey + "-" + titleKey).slice(0, 150)}-${id.slice(0, 10)}`,
      rawArtist: raw.artist,
      rawTitle: raw.music,
      artist: titleCase(artistKey),
      title: titleCase(titleKey),
      artistKey,
      titleKey,
      genre: raw.genre.trim() || "Não informado",
      chords,
      declaredKey:
        raw.keys.length === 1 && parseChord(raw.keys[0]) ? raw.keys[0] : null,
    },
    variants: Array.from({ length: 12 }, (_, n) => (n > 6 ? n - 12 : n)).map(
      (shift, n) => {
        const shifted = chords.map((chord) => chordVariants(chord)[n]);
        return {
          songId: id,
          shift,
          identities: [
            ...new Set(shifted.map((chord) => chord.identity)),
          ].sort(),
          complexity: shifted.reduce((sum, chord) => sum + chord.complexity, 0),
        };
      },
    ),
  };
}
