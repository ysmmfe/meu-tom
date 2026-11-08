import { getCatalogEntry } from "../../../../server/catalog/queries";
import { apiError, validatedJson } from "../../../../server/http";
import { catalogEntrySchema } from "../../../../lib/contracts";
export async function GET(
  _: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const song = await getCatalogEntry((await params).slug);
    return song
      ? validatedJson(catalogEntrySchema, song)
      : Response.json({ error: "Música não encontrada" }, { status: 404 });
  } catch (error) {
    return apiError(error);
  }
}
