import { it, expect } from "vitest";
import {
  foldText,
  prepareIndexRow,
  offlineExportSchema,
} from "../lib/catalog/offline";
import { evaluateIndex } from "../lib/music/index-adaptation";
import {
  chordIdentity,
  complexity,
  parseChord,
  equivalent,
} from "../lib/music/chords";
const row = {
  artist: "Autor de teste",
  music: " autor de teste canção sem letra ",
  genre: "Estudo",
  chords: ["A", "E", "F#m", "D"],
  keys: ["A"],
};
it("normaliza identidade e busca sem inventar acentos ou apagar trechos internos do título", () => {
  const result = prepareIndexRow(row);
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.song.title).toBe("Cancao Sem Letra");
  expect(result.song.artistKey).toBe("autor de teste");
  expect(foldText("  Legião  URBANA ")).toBe("legiao urbana");
  const repeated = prepareIndexRow({
    ...row,
    music: "autor de teste autor de teste outra vez",
  });
  expect(repeated.ok && repeated.song.title).toBe("Autor de Teste Outra Vez");
});
it("não persiste sequência, letra, posições ou capo inventado", () => {
  const result = prepareIndexRow(row);
  if (!result.ok) throw Error("fixture");
  expect(result.song).not.toHaveProperty("progression");
  expect(result.song).not.toHaveProperty("content");
  expect(result.song).not.toHaveProperty("originalCapo");
  expect(result.song.chords).toEqual(["A", "D", "E", "F#m"]);
});
it("símbolo desconhecido coloca o grupo inteiro em quarentena, sem simplificar", () => {
  expect(prepareIndexRow({ ...row, chords: ["C", "Bm7(b5)"] })).toEqual({
    ok: false,
    reason: "unsupported-symbol",
  });
  expect(
    prepareIndexRow({ ...row, chords: ["C", "texto que não é acorde"] }),
  ).toEqual({ ok: false, reason: "unsupported-symbol" });
});
it("prefixo de artista ambíguo não vira título silenciosamente", () => {
  expect(prepareIndexRow({ ...row, music: "nome estranho" })).toEqual({
    ok: false,
    reason: "title-prefix",
  });
  expect(prepareIndexRow({ ...row, music: "autor de teste " })).toMatchObject({
    ok: false,
  });
});
it("materializa as 12 classes sem remover baixos ou extensões", () => {
  const result = prepareIndexRow(row);
  if (!result.ok) throw Error("fixture");
  expect(new Set(result.variants.map((v) => v.shift)).size).toBe(12);
  expect(result.variants.find((v) => v.shift === -2)?.identities).toEqual(
    ["G", "D", "Em", "C"].map(chordIdentity).sort(),
  );
  const extended = prepareIndexRow({
    ...row,
    chords: ["C", "C/E", "C7", "C7M", "Cmaj7"],
  });
  if (!extended.ok) throw Error("fixture");
  expect(extended.song.chords).toHaveLength(4);
});
it("ids e variantes são determinísticos para reimportação", () =>
  expect(prepareIndexRow(row)).toEqual(
    prepareIndexRow({ ...row, chords: [...row.chords].reverse() }),
  ));
it("compatibilidade do índice não afirma capo, altura ou tom original", () => {
  const result = evaluateIndex(
    ["A", "E", "F#m", "D"],
    ["G", "D", "Em", "C"],
    -2,
  );
  expect(result.compatible).toBe(true);
  expect(result.preservesKey).toBeNull();
  expect(result.effectiveKey).toBeNull();
  expect(result.originalKey).toBeNull();
  expect(result.capo).toBe(0);
  expect(result.warnings.join(" ")).toContain("não é uma cifra completa");
});
it("extensões e inversões continuam necessárias no perfil", () => {
  expect(evaluateIndex(["C/E", "C7"], ["C"], 0).compatible).toBe(false);
});
it("pré-cálculo de formas abertas preserva a fórmula de complexidade, inclusive baixos e extensões", () => {
  const open = [
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
  ];
  for (const root of [
    "C",
    "Db",
    "D",
    "Eb",
    "E",
    "F",
    "F#",
    "G",
    "Ab",
    "A",
    "Bb",
    "B",
  ])
    for (const suffix of ["", "m", "7", "maj7", "sus4", "dim", "m7b5", "add9"])
      for (const bass of ["", "/E"]) {
        const symbol = root + suffix + bass,
          chord = parseChord(symbol);
        const reference = chord
          ? (open.some((value) => equivalent(value, symbol)) ? 0 : 3) +
            Math.max(0, chord.intervals.length - 3) +
            (chord.bass ? 2 : 0)
          : 12;
        expect(complexity(symbol), symbol).toBe(reference);
      }
});
it("revisões e checksums não homologados são recusados antes da persistência", () => {
  expect(() =>
    offlineExportSchema.parse({
      provider: "chorrrds",
      revision: "outra",
      sha256: "invalido",
      rows: [row],
    }),
  ).toThrow();
});
