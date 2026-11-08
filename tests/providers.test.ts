import { it, expect, vi } from "vitest";
import { readFile } from "node:fs/promises";
import {
  CifraClubProvider,
  parseCifraResponse,
} from "../server/providers/cifraclub";
const permission = {
  license: "CC0-1.0",
  permission: "Fixture original autorizada",
};
const config = {
  enabled: true,
  origin: "https://example.com/",
  mode: "html" as const,
  ...permission,
  minIntervalMs: 0,
  timeoutMs: 100,
};
it("interpreta fixture HTML autorizada", async () => {
  const body = await readFile(
    new URL("./fixtures/cifra.html", import.meta.url),
    "utf8",
  );
  const result = parseCifraResponse(
    body,
    "text/html",
    "fixture://original",
    permission,
  );
  expect(result.title).toBe("Canção autorizada");
  expect(result.content).toContain("{key: A}");
  expect(result.content).toContain("A       E");
});
it("interpreta contrato JSON adrianoh/code4music", () =>
  expect(
    parseCifraResponse(
      JSON.stringify({
        name: "Sol",
        artist: "Oficina",
        cifra: ["A E", "Meu sol"],
      }),
      "application/json",
      "fixture://json",
      permission,
    ).content,
  ).toBe("A E\nMeu sol"));
it("não aceita erro retornado com HTTP 200", () =>
  expect(() =>
    parseCifraResponse(
      '{"error":"Cifra não encontrada"}',
      "application/json",
      "fixture://error",
      permission,
    ),
  ).toThrow("Cifra não encontrada"));
it("detecta formato alterado", () =>
  expect(() =>
    parseCifraResponse(
      "<html>mudou</html>",
      "text/html",
      "fixture://changed",
      permission,
    ),
  ).toThrow("Formato"));
it("recusa publicação externa sem autorização antes de qualquer conexão", async () => {
  const fetcher = vi.fn();
  await expect(
    new CifraClubProvider({ ...config, enabled: false }, fetcher).fetch(
      "teste/sol",
    ),
  ).rejects.toMatchObject({ status: 403 });
  expect(fetcher).not.toHaveBeenCalled();
});
it("modo API mantém o endpoint e usa artist/song, sem confundir com a rota Python", async () => {
  const fetcher = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        name: "Sol",
        artist: "Oficina",
        cifra: ["A E", "Meu sol"],
      }),
      { headers: { "content-type": "application/json" } },
    ),
  );
  const result = await new CifraClubProvider(
    { ...config, mode: "api", origin: "https://example.com/api/cifra" },
    fetcher,
  ).fetch("oficina/sol");
  expect(result.title).toBe("Sol");
  const [url, options] = fetcher.mock.calls[0];
  expect(url).toBe("https://example.com/api/cifra?artist=oficina&song=sol");
  expect(options.redirect).toBe("error");
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it("HTTP 200 com erro 403 no JSON não é sucesso nem provoca nova tentativa", async () => {
  const fetcher = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        artist: "oficina",
        name: "sol",
        error: "Request failed with status code 403",
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    ),
  );
  await expect(
    new CifraClubProvider({ ...config, mode: "api" }, fetcher).fetch(
      "oficina/sol",
    ),
  ).rejects.toMatchObject({
    status: 502,
    message: "Request failed with status code 403",
  });
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it("descoberta externa não está implementada e não abre conexão", async () => {
  const fetcher = vi.fn();
  await expect(
    new CifraClubProvider(config, fetcher).find(),
  ).rejects.toMatchObject({ status: 501 });
  expect(fetcher).not.toHaveBeenCalled();
});
it("404 não faz retry", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response("", { status: 404 }));
  await expect(
    new CifraClubProvider(config, fetcher).fetch("teste/sol"),
  ).rejects.toMatchObject({ status: 404 });
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it("403 não tenta contornar o bloqueio", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response("", { status: 403 }));
  await expect(
    new CifraClubProvider(config, fetcher).fetch("teste/sol"),
  ).rejects.toThrow("Acesso recusado");
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it("indisponibilidade tenta no máximo duas vezes", async () => {
  const fetcher = vi.fn().mockRejectedValue(new Error("offline"));
  await expect(
    new CifraClubProvider(config, fetcher).fetch("teste/sol"),
  ).rejects.toThrow("indisponível");
  expect(fetcher).toHaveBeenCalledTimes(2);
});
it("nega caminho arbitrário e origem não segura", async () => {
  await expect(
    new CifraClubProvider(config).fetch("http://localhost/secret"),
  ).rejects.toMatchObject({ status: 400 });
  await expect(
    new CifraClubProvider({ ...config, origin: "http://localhost" }).fetch(
      "teste/sol",
    ),
  ).rejects.toMatchObject({ status: 400 });
});
it("limita tamanho da resposta", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue(new Response("x".repeat(2_000_001)));
  await expect(
    new CifraClubProvider(config, fetcher).fetch("teste/sol"),
  ).rejects.toThrow("limite");
});
