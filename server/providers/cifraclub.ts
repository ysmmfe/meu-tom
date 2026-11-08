import { load } from "cheerio";
import { z } from "zod";
import {
  rawSongSchema,
  ProviderError,
  type RawSong,
  type SongProvider,
} from "./types";
import { slugify } from "../../lib/slug";
const apiSchema = z.object({
  name: z.string(),
  artist: z.string(),
  cifra: z.array(z.string()).min(1),
  error: z.string().nullable().optional(),
  cifraclub_url: z.string().optional(),
});
export function parseCifraResponse(
  body: string,
  contentType: string,
  url: string,
  permission: { license: string; permission: string },
): RawSong {
  let title: string, artist: string, content: string;
  if (contentType.includes("json")) {
    const json: unknown = JSON.parse(body);
    if (typeof json === "object" && json && "error" in json && json.error)
      throw new ProviderError(String(json.error));
    const data = apiSchema.parse(json);
    title = data.name;
    artist = data.artist;
    content = data.cifra.join("\n");
  } else {
    const $ = load(body);
    title = $("h1.t1").first().text().trim();
    artist = $("h2.t3").first().text().trim();
    content = $("div.cifra_cnt pre, pre.js-tab-content").first().text();
    const key = $("#cifra_tom a").first().text().trim();
    if (!title || !artist || !content.trim())
      throw new ProviderError(
        "Formato da fonte mudou ou cifra não encontrada.",
      );
    if (key) content = `{key: ${key}}\n${content}`;
  }
  return rawSongSchema.parse({
    title,
    artist,
    slug: slugify(`${artist}-${title}`),
    genre: "Não informado",
    format: "plain",
    content,
    source: {
      provider: "cifraclub-experimental",
      url,
      ...permission,
      publishable: true,
    },
  });
}
export class CifraClubProvider implements SongProvider {
  name = "cifraclub-experimental";
  private lastRequest = 0;
  constructor(
    private config: {
      enabled: boolean;
      origin: string;
      mode: "html" | "api";
      license: string;
      permission: string;
      timeoutMs?: number;
      minIntervalMs?: number;
    },
    private transport: typeof fetch = fetch,
  ) {}
  async find(): Promise<{ id: string; title: string; artist: string }[]> {
    throw new ProviderError(
      "Pesquisa externa não disponível; informe artista/música para importação autorizada.",
      501,
    );
  }
  async fetch(id: string): Promise<RawSong> {
    if (
      !this.config.enabled ||
      !this.config.license.trim() ||
      !this.config.permission.trim()
    )
      throw new ProviderError(
        "Importação externa desativada ou sem permissão explícita.",
        403,
      );
    if (!/^[a-z0-9-]+\/[a-z0-9-]+$/.test(id))
      throw new ProviderError("Use artista/musica, sem URL arbitrária.", 400);
    const origin = new URL(this.config.origin);
    if (origin.protocol !== "https:")
      throw new ProviderError("A origem precisa usar HTTPS.", 400);
    const url =
      this.config.mode === "api"
        ? new URL(
            `?artist=${id.split("/")[0]}&song=${id.split("/")[1]}`,
            origin,
          ).toString()
        : new URL(`${id}/`, origin).toString();
    for (let attempt = 0; attempt < 2; attempt++) {
      await new Promise((resolve) =>
        setTimeout(
          resolve,
          Math.max(
            0,
            this.lastRequest + (this.config.minIntervalMs ?? 1500) - Date.now(),
          ),
        ),
      );
      this.lastRequest = Date.now();
      let response: Response;
      try {
        response = await this.transport(url, {
          signal: AbortSignal.timeout(this.config.timeoutMs ?? 8000),
          redirect: "error",
          headers: { "User-Agent": "MeuTom/0.1 (authorized import)" },
        });
      } catch {
        if (attempt === 0) continue;
        throw new ProviderError(
          "Provedor indisponível ou tempo de resposta excedido.",
        );
      }
      if (response.status === 404)
        throw new ProviderError("Cifra não encontrada.", 404);
      if ([401, 403, 429].includes(response.status))
        throw new ProviderError(
          `Acesso recusado pelo provedor (HTTP ${response.status}). Sem novas tentativas.`,
          502,
        );
      if (response.status >= 500 && attempt === 0) continue;
      if (!response.ok)
        throw new ProviderError(`Provedor respondeu HTTP ${response.status}.`);
      const reader = response.body?.getReader();
      if (!reader) throw new ProviderError("Resposta vazia.");
      const chunks: Uint8Array[] = [];
      let length = 0;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        length += value.length;
        if (length > 2_000_000) {
          await reader.cancel();
          throw new ProviderError("Resposta excede o limite permitido.");
        }
        chunks.push(value);
      }
      return parseCifraResponse(
        Buffer.concat(chunks).toString("utf8"),
        response.headers.get("content-type") ?? "",
        url,
        this.config,
      );
    }
    throw new ProviderError("Provedor indisponível.");
  }
}
