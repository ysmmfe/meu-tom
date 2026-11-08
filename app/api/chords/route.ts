import { getShape } from "../../../lib/music/diagrams";
import { parseChord } from "../../../lib/music/chords";
export function GET(request: Request) {
  const chord = new URL(request.url).searchParams.get("symbol") ?? "";
  if (chord.length > 40 || !parseChord(chord))
    return Response.json({ error: "Acorde não reconhecido" }, { status: 400 });
  return Response.json({
    symbol: chord,
    tuning: ["E", "A", "D", "G", "B", "E"],
    shape: getShape(chord),
  });
}
