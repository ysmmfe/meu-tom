import { searchSchema, searchSongs } from "../../../server/catalog/queries";
import { apiError, validatedJson } from "../../../server/http";
import { searchResultSchema } from "../../../lib/contracts";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    return validatedJson(
      searchResultSchema,
      await searchSongs(
        searchSchema.parse(
          Object.fromEntries(new URL(request.url).searchParams),
        ),
      ),
    );
  } catch (error) {
    return apiError(error);
  }
}
