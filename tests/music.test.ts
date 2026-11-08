import { describe, it, expect } from "vitest";
import { Chord, Note } from "@tonaljs/tonal";
import {
  parseChord,
  transposeChord,
  equivalent,
  mod12,
} from "../lib/music/chords";
import { adaptations, evaluate, defaultWeights } from "../lib/music/adaptation";
import {
  parseChordPro,
  transposeDocument,
  documentChords,
  plainToChordPro,
} from "../lib/parsers/chordpro";
import { shapes } from "../lib/music/diagrams";
const symbols = [
  "C",
  "Am",
  "F#m",
  "Bb",
  "G7",
  "C7M",
  "Cmaj7",
  "Dm7",
  "G/B",
  "F#7(9)",
  "A7sus4",
  "Bbmaj7/D",
];
const summary = {
  chords: ["A", "E", "F#m", "D"],
  progression: ["A", "E", "F#m", "D", "A", "E", "F#m", "D"],
  originalKey: "A",
  originalCapo: 0,
};
const known = ["G", "D", "Em", "C"];
describe("símbolos completos e transposição", () => {
  it.each(symbols)("interpreta %s sem destruir a notação", (symbol) => {
    expect(parseChord(symbol)).not.toBeNull();
    expect(transposeChord(symbol, 0)).toBe(symbol);
  });
  it.each([
    "Amor",
    "Casa",
    "Hoje",
    "Cwhatever",
    "H",
    "C/banana",
    "Dó",
    "A7#invalid",
  ])("não interpreta palavra ou símbolo inválido: %s", (symbol) =>
    expect(parseChord(symbol)).toBeNull(),
  );
  it("equivale grafias, não inversões/extensões", () => {
    expect(equivalent("C7M", "Cmaj7")).toBe(true);
    expect(equivalent("F#", "Gb")).toBe(true);
    expect(equivalent("G", "G/B")).toBe(false);
    expect(equivalent("C", "C7")).toBe(false);
    expect(equivalent("Am", "A")).toBe(false);
  });
  it("decompõe extensões, alterações, suspensões e baixo", () => {
    expect(parseChord("C7b9/E")).toMatchObject({
      root: "C",
      bass: "E",
      alterations: ["b9"],
      extensions: [7, 9],
      suspensions: [],
    });
    expect(parseChord("A7sus4")).toMatchObject({
      root: "A",
      suspensions: [4],
      extensions: [7],
    });
  });
  it("exemplo obrigatório -2", () =>
    expect(summary.chords.map((c) => transposeChord(c, -2))).toEqual(known));
  it("transpõe baixo e preserva alterações", () => {
    expect(transposeChord("G/B", 2)).toBe("A/C#");
    expect(transposeChord("F#7(9)", -2)).toBe("E7(9)");
  });
  it.each(symbols)(
    "propriedades matemáticas de %s em todas as 12 classes",
    (symbol) => {
      for (let n = 0; n < 12; n++) {
        const out = transposeChord(symbol, n);
        expect(equivalent(transposeChord(out, -n), symbol)).toBe(true);
        expect(parseChord(out)?.intervals).toEqual(
          parseChord(symbol)?.intervals,
        );
        expect(equivalent(transposeChord(symbol, n + 12), out)).toBe(true);
      }
    },
  );
  it("preserva símbolos desconhecidos", () =>
    expect(transposeChord("C???", 2)).toBe("C???"));
});
describe("adaptação, capotraste e ranking", () => {
  it("avalia 12×8 candidatos e prioriza capo 2 mantendo A", () => {
    const result = adaptations(summary, known, { transpose: true, capo: true });
    expect(result).toHaveLength(96);
    expect(result[0]).toMatchObject({
      semitones: -2,
      capo: 2,
      chords: known,
      effectiveKey: "A",
      shapeKey: "G",
      compatible: true,
      category: "capo",
      unknown: [],
    });
  });
  it("sem capo muda para G e avisa", () =>
    expect(
      adaptations(summary, known, { transpose: true, capo: false })[0],
    ).toMatchObject({
      semitones: -2,
      capo: 0,
      effectiveKey: "G",
      preservesKey: false,
      category: "transposed",
    }));
  it("sem transposição não inventa compatibilidade", () => {
    const best = adaptations(summary, known, {
      transpose: false,
      capo: false,
    })[0];
    expect(best.compatible).toBe(false);
    expect(best.unknown).toEqual(["A", "E", "F#m"]);
  });
  it("categorias explícitas", () => {
    expect(evaluate(summary, summary.chords, 0, 0).category).toBe("original");
    expect(evaluate(summary, ["A", "E", "D"], 0, 0).category).toBe("one-more");
    expect(evaluate(summary, [], 0, 0).category).toBe("multiple");
    expect(evaluate({ ...summary, chords: ["C???"] }, [], 0, 0).category).toBe(
      "not-recommended",
    );
  });
  it("conhecer G não significa conhecer G/B", () =>
    expect(
      evaluate({ ...summary, chords: ["G/B"] }, ["G"], 0, 0).compatible,
    ).toBe(false));
  it("pesos configuráveis e desconhecidos sempre prioritários", () => {
    expect(evaluate(summary, known, -2, 2).score).toBeLessThan(
      evaluate(summary, known, 0, 0).score,
    );
    expect(
      evaluate(summary, known, -2, 2, { ...defaultWeights, capo: 200 }).score,
    ).toBeGreaterThan(evaluate(summary, known, -2, 0).score);
  });
  it("todas as combinações de capo produzem a altura calculada", () => {
    for (let n = -5; n <= 6; n++)
      for (let capo = 0; capo <= 7; capo++) {
        const out = evaluate(summary, known, n, capo);
        expect(Note.chroma(out.effectiveKey!)).toBe(
          mod12(Note.chroma("A")! + n + capo),
        );
        expect(out.preservesKey).toBe(mod12(n + capo) === 0);
      }
  });
  it("remover capo original pode preservar tom com novas formas, sem alegar ausência de adaptação", () => {
    const out = evaluate(
      { ...summary, originalKey: "B", originalCapo: 2 },
      ["B", "F#", "G#m", "E"],
      2,
      0,
    );
    expect(out).toMatchObject({
      preservesKey: true,
      effectiveKey: "B",
      capo: 0,
      category: "transposed-preserved",
      compatible: true,
    });
  });
  it("considera capotraste original na altura", () =>
    expect(
      evaluate(
        { ...summary, originalKey: "B", originalCapo: 2 },
        summary.chords,
        0,
        2,
      ),
    ).toMatchObject({ preservesKey: true, shapeKey: "A", effectiveKey: "B" }));
});
describe("documento estruturado", () => {
  const raw =
    "{title: Teste}\n{artist: Oficina}\n{key: A}\n{capo: 2}\n{section: Introdução}\n[A] [E]\n{section: Refrão}\n{repeat: 2}\n[A]Amor não é [F#m]acorde\n[G/B]Ouça [C???]este som";
  it("não inventa transposição para tom original inválido", () => {
    const doc = parseChordPro("{key: qualquer}\n[C]Texto");
    expect(doc.key).toBeNull();
    expect(doc.warnings).toContain("Tom original não reconhecido: qualquer");
  });
  it("preserva seções, repetições, capo e símbolos não interpretados", () => {
    const doc = parseChordPro(raw);
    expect(doc.title).toBe("Teste");
    expect(doc.artist).toBe("Oficina");
    expect(doc.capo).toBe(2);
    expect(doc.sections[1].repeat).toBe(2);
    expect(doc.warnings).toContain("Acorde não reconhecido: C???");
    expect(documentChords(doc).length).toBe(10);
  });
  it("transposição não altera nenhum trecho de letra nem seu segmento", () => {
    const doc = parseChordPro(raw),
      out = transposeDocument(doc, -2);
    expect(
      out.sections.map((s) => s.lines.map((l) => l.map((p) => p.text))),
    ).toEqual(
      doc.sections.map((s) => s.lines.map((l) => l.map((p) => p.text))),
    );
    expect(out.sections[1].lines[0][0].chord).toBe("G");
    expect(doc.sections[1].lines[0][0].chord).toBe("A");
  });
  it("converte linhas posicionais sem interpretar palavras", () => {
    const doc = parseChordPro(
      plainToChordPro("[Refrão 2x]\nC     G/B\nCasa aberta\nAmor é caminho"),
    );
    expect(doc.sections[0].repeat).toBe(2);
    expect(doc.sections[0].lines[0]).toEqual([
      { chord: "C", text: "Casa a" },
      { chord: "G/B", text: "berta" },
    ]);
    expect(doc.sections[0].lines[1]).toEqual([{ text: "Amor é caminho" }]);
  });
  it("linhas instrumentais consecutivas não são consumidas como letra", () =>
    expect(documentChords(parseChordPro(plainToChordPro("C G\nAm F")))).toEqual(
      ["C", "G", "Am", "F"],
    ));
});
describe("diagramas EADGBE", () => {
  it.each(Object.keys(shapes))(
    "%s produz somente notas reais do acorde e baixo correto",
    (symbol) => {
      const shape = shapes[symbol],
        chord = Chord.get(symbol.split("/")[0]);
      const pitches = new Set(chord.notes.map((n) => Note.chroma(n)));
      const tuning = [4, 9, 2, 7, 11, 4];
      for (const [i, fret] of shape.frets.entries())
        if (fret >= 0) expect(pitches.has(mod12(tuning[i] + fret))).toBe(true);
      const first = shape.frets.findIndex((f) => f >= 0);
      expect(mod12(tuning[first] + shape.frets[first])).toBe(
        Note.chroma(
          symbol.includes("/")
            ? symbol.split("/")[1]
            : parseChord(symbol)!.root,
        ),
      );
      expect(shape.fingers).toHaveLength(6);
    },
  );
});
