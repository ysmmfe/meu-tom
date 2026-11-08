import { ZodError, type ZodType } from "zod";
import { ContentError } from "../lib/errors";
export function validatedJson<T>(schema: ZodType<T>, value: unknown): Response {
  const parsed = schema.safeParse(value);
  if (!parsed.success)
    throw new Error("Contrato de saída inválido", { cause: parsed.error });
  return Response.json(parsed.data);
}
import { ProviderError } from "./providers/types";
export function apiError(error: unknown): Response {
  if (error instanceof ZodError)
    return Response.json(
      { error: "Dados inválidos", details: error.issues.map((i) => i.message) },
      { status: 400 },
    );
  if (error instanceof SyntaxError)
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  if (error instanceof ContentError)
    return Response.json({ error: error.message }, { status: 422 });
  if (error instanceof ProviderError)
    return Response.json({ error: error.message }, { status: error.status });
  console.error("[Meu Tom]", error);
  return Response.json(
    {
      error:
        "Não foi possível carregar os dados. Tente novamente em instantes.",
    },
    { status: 503 },
  );
}
