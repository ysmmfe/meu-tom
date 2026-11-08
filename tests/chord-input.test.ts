import { it, expect } from "vitest";
import { mergeChordInput } from "../features/chords/input";
it("aceita colar uma lista de acordes", () =>
  expect(mergeChordInput([], "G, D; Em C")).toEqual(["G", "D", "Em", "C"]));
it("deduplica grafias equivalentes sem confundir extensões ou baixo", () =>
  expect(mergeChordInput(["C7M", "F#"], "Cmaj7 Gb C C/E")).toEqual([
    "C7M",
    "F#",
    "C",
    "C/E",
  ]));
it("entrada inválida não altera o perfil original", () => {
  const known = ["G"];
  expect(() => mergeChordInput(known, "D Amor")).toThrow("Não reconhecemos");
  expect(known).toEqual(["G"]);
});
it("entrada vazia não apaga os acordes conhecidos", () =>
  expect(mergeChordInput(["G"], " , ; ")).toEqual(["G"]));
