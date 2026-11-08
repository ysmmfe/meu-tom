import { Chord, Note } from "@tonaljs/tonal";

export interface ParsedChord {
  original: string;
  root: string;
  suffix: string;
  bass?: string;
  quality: string;
  intervals: string[];
  extensions: number[];
  alterations: string[];
  suspensions: number[];
  identity: string;
}
const sharps = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];
const flats = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
export const mod12 = (n: number) => ((n % 12) + 12) % 12;

export function parseChord(symbol: string): ParsedChord | null {
  const clean = symbol.trim().replaceAll("♯", "#").replaceAll("♭", "b");
  const match = /^([A-G](?:#|b)?)([^/\s]*)(?:\/([A-G](?:#|b)?))?$/.exec(clean);
  if (!match) return null;
  const [, root, suffix, bass] = match;
  const normalizedSuffix = suffix
    .replace(/^7M/, "maj7")
    .replace(/^M7/, "maj7")
    .replace(/^7\(9\)$/, "9");
  const chord = Chord.get(root + normalizedSuffix);
  if (chord.empty) return null;
  return {
    original: symbol,
    root,
    suffix,
    bass,
    quality: chord.quality,
    intervals: chord.intervals,
    extensions: chord.intervals
      .map((i) => Number.parseInt(i, 10))
      .filter((degree) => degree >= 7),
    alterations: normalizedSuffix.match(/[b#]\d+/g) ?? [],
    suspensions: chord.intervals.some((i) => i.startsWith("3"))
      ? []
      : chord.intervals
          .filter((i) => i === "2M" || i === "4P")
          .map((i) => Number.parseInt(i, 10)),
    // Full harmonic identity, including bass. Knowing C does not imply knowing C/E.
    identity: `${Note.chroma(root)}:${chord.intervals.join(",")}:${bass ? Note.chroma(bass) : "-"}`,
  };
}
export function transposeNote(
  note: string,
  semitones: number,
  preferFlats = note.includes("b"),
): string {
  const chroma = Note.chroma(note);
  if (chroma === undefined) return note;
  if (mod12(semitones) === 0) return note;
  return (preferFlats ? flats : sharps)[mod12(chroma + semitones)];
}
export function transposeChord(symbol: string, semitones: number): string {
  const chord = parseChord(symbol);
  if (!chord || mod12(semitones) === 0) return symbol;
  return (
    transposeNote(chord.root, semitones) +
    chord.suffix +
    (chord.bass ? "/" + transposeNote(chord.bass, semitones) : "")
  );
}
export function chordIdentity(chord: string): string {
  return parseChord(chord)?.identity ?? `unknown:${chord}`;
}
export function equivalent(a: string, b: string): boolean {
  return chordIdentity(a) === chordIdentity(b);
}
// Same identity comparison as equivalent(), but computed once rather than
// reparsing every open shape for every candidate/capo in a catalog request.
const openChordIdentities = new Set(
  [
    "C",
    "D",
    "E",
    "G",
    "A",
    "Am",
    "Dm",
    "Em",
    "A7",
    "B7",
    "C7",
    "D7",
    "E7",
    "G7",
  ].map(chordIdentity),
);
export function complexity(symbol: string): number {
  const chord = parseChord(symbol);
  if (!chord) return 12;
  return (
    (openChordIdentities.has(chord.identity) ? 0 : 3) +
    Math.max(0, chord.intervals.length - 3) +
    (chord.bass ? 2 : 0)
  );
}
