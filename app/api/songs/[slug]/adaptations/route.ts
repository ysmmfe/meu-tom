import { getIndexedSong } from "../../../../../server/catalog/offline";
import { getSong, searchSchema } from "../../../../../server/catalog/queries";
import { adaptations } from "../../../../../lib/music/adaptation";
import { transposeDocument } from "../../../../../lib/parsers/chordpro";
import { apiError, validatedJson } from "../../../../../server/http";
import { adaptationResponseSchema } from "../../../../../lib/contracts";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const input = searchSchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    const slug = (await params).slug;
    const song = await getSong(slug);
    if (!song)
      return (await getIndexedSong(slug))
        ? Response.json(
            {
              error:
                "Esta música tem apenas índice de acordes. Não há cifra completa para adaptar.",
            },
            { status: 422 },
          )
        : Response.json({ error: "Música não encontrada" }, { status: 404 });
    const options = adaptations(song.summary, input.known, input);
    return validatedJson(adaptationResponseSchema, {
      adaptation: options[0],
      options: options.slice(0, 12),
      document: transposeDocument(song.document, options[0].semitones),
    });
  } catch (error) {
    return apiError(error);
  }
}
