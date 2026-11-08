import { equivalent, parseChord } from "../../lib/music/chords";

/** Validate the whole paste before committing, so invalid text never creates a partial profile. */
export function mergeChordInput(known: string[], text: string): string[] {
  const symbols = text
    .trim()
    .split(/[\s,;]+/)
    .filter(Boolean);
  if (!symbols.length) return known;
  if (symbols.some((symbol) => symbol.length > 40 || !parseChord(symbol)))
    throw new Error("Não reconhecemos esse acorde. Tente F#m, Bb ou C7M.");
  const result = [...known];
  for (const symbol of symbols)
    if (!result.some((chord) => equivalent(chord, symbol))) result.push(symbol);
  if (result.length > 40)
    throw new Error("Você pode selecionar até 40 acordes.");
  return result;
}
