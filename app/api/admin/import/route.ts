import { timingSafeEqual } from "node:crypto";
import { ingest } from "../../../../server/services/ingest";
import { rawSongSchema } from "../../../../server/providers/types";
import { apiError } from "../../../../server/http";
export async function POST(request: Request) {
  const token = process.env.ADMIN_IMPORT_TOKEN;
  const supplied =
    request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (
    !token ||
    token.length < 24 ||
    Buffer.byteLength(supplied) !== Buffer.byteLength(token) ||
    !timingSafeEqual(Buffer.from(supplied), Buffer.from(token))
  )
    return Response.json({ error: "Não autorizado" }, { status: 401 });
  const body = await request.text();
  if (body.length > 250000)
    return Response.json({ error: "Arquivo excede o limite" }, { status: 413 });
  try {
    const raw = rawSongSchema.parse(JSON.parse(body));
    if (!raw.source.publishable)
      return Response.json(
        { error: "Conteúdo não autorizado para publicação" },
        { status: 422 },
      );
    return Response.json(await ingest(raw), { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
