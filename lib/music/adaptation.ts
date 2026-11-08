import {
  chordIdentity,
  complexity,
  mod12,
  parseChord,
  transposeChord,
} from "./chords";

export interface MusicSummary {
  chords: string[];
  progression: string[];
  originalKey: string | null;
  originalCapo: number;
}
export interface AdaptationOptions {
  transpose: boolean;
  capo: boolean;
}
export interface Weights {
  unknown: number;
  complexity: number;
  changes: number;
  capo: number;
  keyChange: number;
  shift: number;
  repetition: number;
}
export const defaultWeights: Weights = {
  unknown: 1000,
  complexity: 2,
  changes: 0.1,
  capo: 2,
  keyChange: 50,
  shift: 0.1,
  repetition: 0.1,
};
export type Compatibility =
  | "original"
  | "capo"
  | "transposed"
  | "transposed-preserved"
  | "one-more"
  | "multiple"
  | "not-recommended";
export interface Adaptation {
  originalChords: string[];
  chords: string[];
  semitones: number;
  capo: number;
  originalKey: string | null;
  shapeKey: string | null;
  effectiveKey: string | null;
  unknown: string[];
  compatible: boolean;
  category: Compatibility;
  score: number;
  preservesKey: boolean;
  warnings: string[];
}
export const categoryLabels: Record<Compatibility, string> = {
  original: "Tocável sem adaptação",
  capo: "Tocável com capotraste",
  transposed: "Tocável com mudança de tom",
  "transposed-preserved": "Tocável com novas formas, tom preservado",
  "one-more": "Exige aprender um acorde",
  multiple: "Exige aprender múltiplos acordes",
  "not-recommended": "Não recomendada",
};
export function evaluate(
  summary: MusicSummary,
  known: string[],
  semitones: number,
  capo: number,
  weights = defaultWeights,
): Adaptation {
  const chords = [
    ...new Set(summary.chords.map((c) => transposeChord(c, semitones))),
  ];
  const identities = new Set(known.map(chordIdentity));
  const unknown = chords.filter((c) => !identities.has(chordIdentity(c)));
  const unsupported = chords.filter((c) => !parseChord(c));
  // Original symbols represent shapes; an original capo is part of the sounding pitch.
  const preservesKey = mod12(semitones + capo - summary.originalCapo) === 0;
  const category: Compatibility = unsupported.length
    ? "not-recommended"
    : unknown.length === 1
      ? "one-more"
      : unknown.length > 1
        ? "multiple"
        : preservesKey
          ? capo
            ? "capo"
            : semitones === 0
              ? "original"
              : "transposed-preserved"
          : "transposed";
  const changes = summary.progression
    .slice(1)
    .filter((c, i) => c !== summary.progression[i]).length;
  const repeated = Math.max(
    0,
    summary.progression.length - new Set(summary.progression).size,
  );
  const score =
    unknown.length * weights.unknown +
    chords.reduce((s, c) => s + complexity(c), 0) * weights.complexity +
    changes * weights.changes +
    capo * weights.capo +
    (preservesKey ? 0 : weights.keyChange) +
    Math.abs(semitones) * weights.shift -
    Math.min(changes, repeated) * weights.repetition;
  return {
    originalChords: summary.chords,
    chords,
    semitones,
    capo,
    originalKey: summary.originalKey,
    shapeKey: summary.originalKey
      ? transposeChord(summary.originalKey, semitones - summary.originalCapo)
      : null,
    effectiveKey: summary.originalKey
      ? transposeChord(
          summary.originalKey,
          semitones + capo - summary.originalCapo,
        )
      : null,
    unknown,
    compatible: unknown.length === 0 && unsupported.length === 0,
    category,
    score,
    preservesKey,
    warnings: [
      ...(!preservesKey
        ? ["A tonalidade foi alterada em relação ao tom original."]
        : []),
      ...unsupported.map(
        (c) =>
          `Símbolo não reconhecido: ${c}. Preservado, sem transposição segura.`,
      ),
    ],
  };
}
export function adaptations(
  summary: MusicSummary,
  known: string[],
  options: AdaptationOptions,
  weights = defaultWeights,
): Adaptation[] {
  const shifts = options.transpose
    ? Array.from({ length: 12 }, (_, i) => (i > 6 ? i - 12 : i))
    : [0];
  const results = shifts.flatMap((shift) =>
    Array.from({ length: options.capo ? 8 : 1 }, (_, capo) =>
      evaluate(summary, known, shift, capo, weights),
    ),
  );
  return results.sort(
    (a, b) =>
      a.unknown.length - b.unknown.length ||
      a.score - b.score ||
      Math.abs(a.semitones) - Math.abs(b.semitones) ||
      a.capo - b.capo,
  );
}
