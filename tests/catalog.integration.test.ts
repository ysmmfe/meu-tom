import { afterAll, it, expect } from "vitest";
import { sql } from "../db/client";
import { LocalProvider } from "../server/providers/local";
import { ingest } from "../server/services/ingest";
import {
  searchSongs,
  searchSchema as baseSchema,
  getSong,
} from "../server/catalog/queries";
const searchSchema = {
  parse: (value: Record<string, unknown>) =>
    baseSchema.parse({ catalog: "full", ...value }),
};
import { adaptations } from "../lib/music/adaptation";
import {
  CifraClubProvider,
  parseCifraResponse,
} from "../server/providers/cifraclub";
import { readFile } from "node:fs/promises";
import { POST as adminImport } from "../app/api/admin/import/route";
import { seedIndexFixture, removeIndexFixture } from "./helpers/index-fixture";
import { getCatalogEntry } from "../server/catalog/queries";
import { catalogEntrySchema } from "../lib/contracts";
const local = new LocalProvider();
afterAll(async () => {
  await sql.end();
});
it("seed é idempotente, inclusive ocorrências e fontes", async () => {
  const raw = await local.fetch("primeiro-sol");
  await ingest(raw);
  const [before] =
    await sql`SELECT (SELECT count(*) FROM songs)::int songs, (SELECT count(*) FROM chord_occurrences)::int occurrences, (SELECT count(*) FROM sources)::int sources`;
  await ingest(raw);
  const [after] =
    await sql`SELECT (SELECT count(*) FROM songs)::int songs, (SELECT count(*) FROM chord_occurrences)::int occurrences, (SELECT count(*) FROM sources)::int sources`;
  expect(after).toEqual(before);
});
it("importação concorrente não duplica conteúdo", async () => {
  const raw = await local.fetch("primeiro-sol");
  await Promise.all([ingest(raw), ingest(raw)]);
  const [count] =
    await sql`SELECT count(*)::int n FROM songs WHERE slug='primeiro-sol'`;
  expect(count.n).toBe(1);
});
it("rejeita cifra malformada e não autorizada antes da persistência", async () => {
  const raw = await local.fetch("primeiro-sol");
  await expect(ingest({ ...raw, content: "só texto" })).rejects.toThrow(
    "sem acordes",
  );
  await expect(
    ingest({ ...raw, source: { ...raw.source, publishable: false } }),
  ).rejects.toThrow("permissão");
});
it("busca persistida calcula a adaptação correta", async () => {
  const result = await searchSongs(
    searchSchema.parse({ known: "G,D,Em,C", title: "Primeiro sol" }),
  );
  expect(result.total).toBe(1);
  expect(result.items[0].adaptation).toMatchObject({
    semitones: -2,
    capo: 2,
    compatible: true,
  });
});
it("filtra artista, gênero e título, com paginação", async () => {
  const first = await searchSongs(
    searchSchema.parse({ known: "G,D,Em,C", playable: "false", sort: "title" }),
  );
  const second = await searchSongs(
    searchSchema.parse({
      known: "G,D,Em,C",
      playable: "false",
      sort: "title",
      page: 2,
    }),
  );
  expect(first.total).toBe(10);
  expect(first.items).toHaveLength(6);
  expect(second.items).toHaveLength(4);
  expect(
    second.items
      .map((i) => i.slug)
      .some((s) => first.items.some((i) => i.slug === s)),
  ).toBe(false);
  const filtered = await searchSongs(
    searchSchema.parse({
      known: "A,D,E",
      artist: "Roda",
      genre: "Baião",
      title: "Três",
    }),
  );
  expect(filtered.items.map((s) => s.slug)).toEqual(["tres-passos"]);
});
it("vazio e acorde adicional não afirmam compatibilidade inexistente", async () => {
  expect((await searchSongs(searchSchema.parse({}))).total).toBe(0);
  const result = await searchSongs(
    searchSchema.parse({ known: "G,D,C", extra: "true" }),
  );
  expect(result.items.every((s) => s.adaptation.unknown.length <= 1)).toBe(
    true,
  );
  expect(
    result.items.find((s) => s.slug === "casa-aberta")?.adaptation.category,
  ).toBe("one-more");
});
it("campo unificado busca tanto título quanto artista sem perder filtros individuais", async () => {
  const byTitle = await searchSongs(
    searchSchema.parse({ known: "G,D,Em,C", q: "Primeiro sol" }),
  );
  expect(byTitle.items.map((song) => song.slug)).toEqual(["primeiro-sol"]);
  const byArtist = await searchSongs(
    searchSchema.parse({
      known: "G,D,Em,C",
      playable: "false",
      q: "Roda",
      genre: "Baião",
    }),
  );
  expect(byArtist.items.map((song) => song.slug).sort()).toEqual([
    "tres-passos",
    "um-acorde",
  ]);
});
it("documento recuperado do PostgreSQL é adaptável", async () => {
  const song = await getSong("primeiro-sol");
  expect(song?.document.sections[1].lines[0][0].chord).toBe("A");
  expect(
    adaptations(song!.summary, ["G", "D", "Em", "C"], {
      transpose: true,
      capo: true,
    })[0].chords,
  ).toEqual(["G", "D", "Em", "C"]);
  expect(await getSong("nao-existe")).toBeNull();
});
it("valida filtros inválidos", () => {
  expect(() => searchSchema.parse({ known: "Amor" })).toThrow();
  expect(() => searchSchema.parse({ page: -1 })).toThrow();
});
it("incluir um acorde novo não restringe a busca quando todos os níveis já estão habilitados", async () => {
  expect(
    (
      await searchSongs(
        searchSchema.parse({
          known: "G,D,Em,C",
          playable: "false",
          extra: "true",
        }),
      )
    ).total,
  ).toBe(10);
});
it("fixture externa autorizada percorre parser, normalização e persistência", async () => {
  const original = await local.fetch("primeiro-sol");
  const fixture = parseCifraResponse(
    await readFile(new URL("./fixtures/cifra.html", import.meta.url), "utf8"),
    "text/html",
    "fixture://authorized",
    { license: "CC0-1.0", permission: "Fixture original" },
  );
  try {
    await ingest({
      ...fixture,
      title: original.title,
      artist: original.artist,
      slug: original.slug,
      source: original.source,
    });
    const song = await getSong(original.slug);
    expect(song?.document.sections[0].lines[0][0]).toEqual({
      chord: "A",
      text: "Um dia d",
    });
    expect(song?.summary.chords).toEqual(["A", "E", "F#m", "D"]);
  } finally {
    await ingest(original);
  }
});
it("falha externa não compromete catálogo persistido", async () => {
  const provider = new CifraClubProvider(
    {
      enabled: true,
      origin: "https://example.com/",
      mode: "html",
      license: "CC0",
      permission: "teste autorizado",
      minIntervalMs: 0,
    },
    async () => {
      throw new Error("offline");
    },
  );
  await expect(provider.fetch("teste/sol")).rejects.toThrow("indisponível");
  expect(
    (
      await searchSongs(
        searchSchema.parse({ known: "G,D,Em,C", title: "Primeiro sol" }),
      )
    ).total,
  ).toBe(1);
});
it("endpoint administrativo valida segredo, contrato e ingestão real", async () => {
  const previous = process.env.ADMIN_IMPORT_TOKEN;
  process.env.ADMIN_IMPORT_TOKEN = "token-apenas-para-testes-locais";
  try {
    const raw = await local.fetch("primeiro-sol");
    const response = await adminImport(
      new Request("http://localhost/api/admin/import", {
        method: "POST",
        headers: { authorization: `Bearer ${process.env.ADMIN_IMPORT_TOKEN}` },
        body: JSON.stringify(raw),
      }),
    );
    expect(response.status).toBe(201);
    expect((await response.json()).slug).toBe("primeiro-sol");
    const invalid = await adminImport(
      new Request("http://localhost/api/admin/import", {
        method: "POST",
        headers: { authorization: `Bearer ${process.env.ADMIN_IMPORT_TOKEN}` },
        body: "{}",
      }),
    );
    expect(invalid.status).toBe(400);
    const malformed = await adminImport(
      new Request("http://localhost/api/admin/import", {
        method: "POST",
        headers: { authorization: `Bearer ${process.env.ADMIN_IMPORT_TOKEN}` },
        body: JSON.stringify({ ...raw, content: "sem cifra" }),
      }),
    );
    expect(malformed.status).toBe(422);
  } finally {
    if (previous === undefined) delete process.env.ADMIN_IMPORT_TOKEN;
    else process.env.ADMIN_IMPORT_TOKEN = previous;
  }
});
it("índice persistido compara formas, pagina corretamente e nunca fabrica documento ou tom", async () => {
  const dataset = "integration-offline-fixture",
    artist = "Autor de índice de integração";
  await seedIndexFixture(dataset, artist);
  try {
    const query = {
      catalog: "index",
      known: "G,D,Em,C",
      artist,
      sort: "title",
    };
    const first = await searchSongs(baseSchema.parse(query)),
      second = await searchSongs(baseSchema.parse({ ...query, page: 2 }));
    expect(first.total).toBe(8);
    expect(first.items).toHaveLength(6);
    expect(second.items).toHaveLength(2);
    expect(
      new Set([...first.items, ...second.items].map((row) => row.slug)).size,
    ).toBe(8);
    for (const item of first.items) {
      expect(item.availability).toBe("index-only");
      expect(item.adaptation).toMatchObject({
        semitones: -2,
        capo: 0,
        compatible: true,
        preservesKey: null,
        effectiveKey: null,
        score: 0.2,
      });
    }
    const entry = await getCatalogEntry(first.items[0].slug);
    expect(catalogEntrySchema.safeParse(entry).success).toBe(true);
    expect(entry).not.toHaveProperty("document");
    expect(
      (await searchSongs(baseSchema.parse({ ...query, transpose: "false" })))
        .total,
    ).toBe(0);
    const extra = await searchSongs(
      baseSchema.parse({ ...query, known: "G,D,C", extra: "true" }),
    );
    expect(extra.total).toBe(8);
    expect(extra.items[0].adaptation.unknown).toEqual(["Em"]);
    expect(
      (
        await searchSongs(
          baseSchema.parse({ ...query, artist: "índice de INTEGRACAO" }),
        )
      ).total,
    ).toBe(8);
    expect(
      (
        await searchSongs(
          baseSchema.parse({ ...query, q: "%'; DROP TABLE indexed_songs; --" }),
        )
      ).total,
    ).toBe(0);
    await seedIndexFixture(dataset, artist);
    expect((await searchSongs(baseSchema.parse(query))).total).toBe(8);
  } finally {
    await removeIndexFixture(dataset);
  }
});
it("provedor local não permite sair do diretório", async () =>
  await expect(local.fetch("../secret")).rejects.toMatchObject({
    status: 400,
  }));
