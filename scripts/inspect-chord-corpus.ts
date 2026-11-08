// Inspeção local: nunca conecta ao banco nem requisita páginas de músicas.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { parseChord } from "../lib/music/chords";
const directory = process.argv[2];
if (!directory)
  throw new Error(
    "Uso: npx tsx scripts/inspect-chord-corpus.ts diretório-da-inspeção",
  );
const counts = z
  .array(z.object({ symbol: z.string(), count: z.number().int().positive() }))
  .parse(
    JSON.parse(await readFile(join(directory, "chord-counts.json"), "utf8")),
  );
const groups = z
  .array(z.array(z.string()))
  .parse(
    JSON.parse(await readFile(join(directory, "song-symbols.json"), "utf8")),
  );
const supported = new Set(
  counts
    .filter(({ symbol }) => parseChord(symbol) !== null)
    .map(({ symbol }) => symbol),
);
console.log(
  JSON.stringify(
    {
      uniqueChordStrings: counts.length,
      parseableChordStrings: supported.size,
      totalOccurrences: counts.reduce((sum, item) => sum + item.count, 0),
      parseableOccurrences: counts
        .filter(({ symbol }) => supported.has(symbol))
        .reduce((sum, item) => sum + item.count, 0),
      artistSongGroups: groups.length,
      groupsWithAllSymbolsParseable: groups.filter(
        (symbols) =>
          symbols.length > 0 &&
          symbols.every((symbol) => supported.has(symbol)),
      ).length,
      unsupportedHarmonicExamples: counts
        .filter(
          ({ symbol }) =>
            !supported.has(symbol) &&
            /^[A-G][#b]?[a-zA-Z0-9()+/#b-]*$/.test(symbol),
        )
        .slice(0, 10)
        .map(({ symbol }) => symbol),
    },
    null,
    2,
  ),
);
