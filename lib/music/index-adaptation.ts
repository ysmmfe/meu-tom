import { evaluate, defaultWeights, type Adaptation } from "./adaptation";
export type IndexAdaptation = Omit<Adaptation, "preservesKey"> & {
  preservesKey: null;
};
export function evaluateIndex(
  chords: string[],
  known: string[],
  shift: number,
): IndexAdaptation {
  const result = evaluate(
    { chords, progression: [], originalKey: null, originalCapo: 0 },
    known,
    shift,
    0,
    { ...defaultWeights, keyChange: 0 },
  );
  return {
    ...result,
    preservesKey: null,
    warnings: [
      "Compatibilidade apenas do conjunto de acordes do índice; não é uma cifra completa.",
      "Tom efetivo e capotraste original não confirmados. Não se garante preservar a altura da gravação.",
    ],
  };
}
