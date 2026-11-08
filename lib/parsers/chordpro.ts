import { parseChord, transposeChord } from "../music/chords";
import { z } from "zod";

export const segmentSchema = z.object({
  text: z.string(),
  chord: z.string().optional(),
});
export const documentSchema = z.object({
  title: z.string(),
  artist: z.string(),
  key: z.string().nullable(),
  capo: z.number().int().min(0).max(7),
  sections: z.array(
    z.object({
      name: z.string(),
      repeat: z.number().int().min(1),
      lines: z.array(z.array(segmentSchema)),
    }),
  ),
  warnings: z.array(z.string()),
});
export type SongDocument = z.infer<typeof documentSchema>;
export type Segment = z.infer<typeof segmentSchema>;

export function parseChordPro(raw: string): SongDocument {
  const doc: SongDocument = {
    title: "",
    artist: "",
    key: null,
    capo: 0,
    sections: [],
    warnings: [],
  };
  let section = { name: "Verso", repeat: 1, lines: [] as Segment[][] };
  const flush = () => {
    if (section.lines.length) doc.sections.push(section);
  };
  for (const line of raw.replaceAll("\r", "").split("\n")) {
    const directive = /^\{([^:}]+)(?::\s*([^}]*))?\}$/.exec(line.trim());
    if (directive) {
      const [, key, value = ""] = directive;
      if (["title", "t"].includes(key)) doc.title = value;
      else if (["artist", "subtitle", "st"].includes(key)) doc.artist = value;
      else if (key === "key") {
        if (parseChord(value)) doc.key = value;
        else {
          doc.key = null;
          doc.warnings.push(`Tom original não reconhecido: ${value}`);
        }
      } else if (key === "capo") {
        const n = Number(value);
        if (Number.isInteger(n) && n >= 0 && n <= 7) doc.capo = n;
        else doc.warnings.push(`Capotraste inválido: ${value}`);
      } else if (
        [
          "section",
          "start_of_chorus",
          "soc",
          "start_of_verse",
          "start_of_bridge",
        ].includes(key)
      ) {
        flush();
        section = {
          name:
            value ||
            (key.includes("chorus") || key === "soc"
              ? "Refrão"
              : key.includes("bridge")
                ? "Ponte"
                : "Verso"),
          repeat: 1,
          lines: [],
        };
      } else if (key === "repeat") {
        const count = Number(value);
        if (Number.isInteger(count) && count >= 1 && count <= 16)
          section.repeat = count;
        else doc.warnings.push(`Repetição inválida: ${value}`);
      } else if (
        ![
          "end_of_chorus",
          "eoc",
          "end_of_verse",
          "end_of_bridge",
          "comment",
          "c",
        ].includes(key)
      )
        doc.warnings.push(`Diretiva preservada como aviso: ${line}`);
      continue;
    }
    if (!line.trim()) continue;
    const segments: Segment[] = [];
    let cursor = 0;
    for (const match of line.matchAll(/\[([^\]]+)\]/g)) {
      const index = match.index!;
      if (index > cursor) {
        if (segments.length)
          segments[segments.length - 1].text += line.slice(cursor, index);
        else segments.push({ text: line.slice(cursor, index) });
      }
      const symbol = match[1];
      if (!parseChord(symbol))
        doc.warnings.push(`Acorde não reconhecido: ${symbol}`);
      segments.push({ chord: symbol, text: "" });
      cursor = index + match[0].length;
    }
    if (segments.length)
      segments[segments.length - 1].text += line.slice(cursor);
    else segments.push({ text: line });
    section.lines.push(segments);
  }
  flush();
  return documentSchema.parse(doc);
}
export function documentChords(doc: SongDocument): string[] {
  return doc.sections.flatMap((s) =>
    Array.from({ length: s.repeat }, () =>
      s.lines.flatMap((l) => l.flatMap((p) => (p.chord ? [p.chord] : []))),
    ).flat(),
  );
}
export function transposeDocument(
  doc: SongDocument,
  semitones: number,
): SongDocument {
  return {
    ...doc,
    sections: doc.sections.map((s) => ({
      ...s,
      lines: s.lines.map((l) =>
        l.map((p) => ({
          ...p,
          chord: p.chord ? transposeChord(p.chord, semitones) : undefined,
        })),
      ),
    })),
  };
}

/** Two-line chord sheets: only entire chord lines are interpreted, never lyric words. */
export function plainToChordPro(raw: string): string {
  const lines = raw.replaceAll("\r", "").split("\n");
  const output: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (
      /^\[(Introdução|Intro|Verso|Refrão|Ponte|Final)(?:\s+(\d+)x)?\]$/i.test(
        line.trim(),
      )
    ) {
      const m = /^\[([^\]]+?)(?:\s+(\d+)x)?\]$/.exec(line.trim())!;
      output.push(`{section: ${m[1]}}`);
      if (m[2]) output.push(`{repeat: ${m[2]}}`);
      continue;
    }
    const tokens = [...line.matchAll(/\S+/g)];
    const isChordLine =
      tokens.length > 0 && tokens.every((t) => parseChord(t[0]));
    if (!isChordLine) {
      output.push(line);
      continue;
    }
    const next = lines[i + 1];
    const nextIsLyric =
      next !== undefined &&
      next.trim() !== "" &&
      !next.trim().startsWith("[") &&
      !next.trim().startsWith("{") &&
      !next
        .trim()
        .split(/\s+/)
        .every((t) => parseChord(t));
    const lyric = nextIsLyric ? lines[++i] : "";
    let converted = lyric;
    // Insert from right to left so changing symbol lengths cannot move later anchors.
    for (const token of tokens.reverse()) {
      const pos = token.index!;
      if (pos > converted.length) converted = converted.padEnd(pos, " ");
      converted =
        converted.slice(0, pos) + `[${token[0]}]` + converted.slice(pos);
    }
    output.push(converted);
  }
  return output.join("\n");
}
