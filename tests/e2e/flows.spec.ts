import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
async function fullCatalog(page: Page) {
  await page.locator(".advanced-filters summary").click();
  await page
    .getByRole("combobox", { name: "Catálogo", exact: true })
    .selectOption("full");
  await page.locator(".advanced-filters summary").click();
}
async function selectProfile(page: Page) {
  await page.goto("/");
  await fullCatalog(page);
  await page.getByRole("button", { name: "G D Em C", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "G", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("button", { name: "Buscar músicas", exact: true })
    .click();
  await expect(page.locator(".song-row").first()).toBeVisible();
}
const songLink = (page: Page) =>
  page.locator(".song-row").filter({
    has: page.getByRole("heading", { name: "Primeiro sol", exact: true }),
  });
test("A–D: descoberta real, cifra adaptada, capo, original e persistência", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await selectProfile(page);
  const response = await page.request.get(
    "/api/songs?known=G,D,Em,C&title=Primeiro&catalog=full",
  );
  expect(response.ok()).toBe(true);
  expect((await response.json()).items[0].adaptation.capo).toBe(2);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Em", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await fullCatalog(page);
  await expect(songLink(page)).toBeVisible();
  await songLink(page).click();
  await expect(
    page.getByRole("heading", { name: "Primeiro sol", exact: true }),
  ).toBeVisible();
  const chords = page.getByTestId("song-sheet").locator(".inline-chord");
  await expect(chords.first()).toHaveText("G");
  expect(new Set(await chords.allTextContents())).toEqual(
    new Set(["G", "D", "Em", "C"]),
  );
  const text = await page.locator(".lyric-text").allTextContents();
  await expect(page.getByTestId("effective-key")).toHaveText("A");
  await expect(
    page.getByText("Altura original preservada", { exact: false }),
  ).toBeVisible();
  await page.getByLabel("Capotraste", { exact: true }).selectOption("0");
  await expect(page.getByTestId("effective-key")).toHaveText("G");
  await expect(
    page.getByText("A tonalidade foi alterada em relação ao tom original."),
  ).toBeVisible();
  await expect(page).toHaveURL(/capo=0/);
  await page.reload();
  await expect(page.getByTestId("effective-key")).toHaveText("G");
  await page.getByLabel("Capotraste", { exact: true }).selectOption("2");
  await expect(page.getByTestId("effective-key")).toHaveText("A");
  await page.getByRole("button", { name: "Original", exact: true }).click();
  expect(new Set(await chords.allTextContents())).toEqual(
    new Set(["A", "E", "F#m", "D"]),
  );
  expect(await page.locator(".lyric-text").allTextContents()).toEqual(text);
  await page
    .getByRole("button", { name: "Adaptada para você", exact: true })
    .click();
  await expect(chords.first()).toHaveText("G");
  await chords.first().click();
  await expect(page.getByRole("img", { name: /G, afinação/ })).toBeVisible();
  await page.getByRole("button", { name: /Aumentar fonte/ }).click();
  await expect(page.getByTestId("song-sheet")).toHaveCSS("font-size", "20px");
  await page
    .getByRole("link", { name: "Voltar às músicas", exact: false })
    .click();
  await expect(
    page.getByRole("button", { name: "C", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(errors).toEqual([]);
});
test("filtros, paginação, acordes personalizados e estados vazios", async ({
  page,
}) => {
  await selectProfile(page);
  await page
    .getByLabel("Música ou artista", { exact: true })
    .fill("não existe no catálogo");
  await expect(
    page.getByRole("heading", { name: "Nenhuma música por enquanto" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Limpar filtros/ }).click();
  await expect(page.locator(".song-row").first()).toBeVisible();
  await fullCatalog(page);
  await page
    .getByLabel("Apenas acordes compatíveis", { exact: true })
    .uncheck();
  await expect(page.getByText("10 resultados", { exact: true })).toBeVisible();
  const first = await page.locator(".song-row h3").allTextContents();
  await page.getByRole("button", { name: "Próxima", exact: true }).click();
  await expect(page.getByText("Página 2 de 2")).toBeVisible();
  await expect(page.locator(".song-row")).toHaveCount(4);
  expect(
    (await page.locator(".song-row h3").allTextContents()).some((s) =>
      first.includes(s),
    ),
  ).toBe(false);
  await page.locator(".advanced-filters summary").click();
  await page.getByLabel("Artista", { exact: true }).fill("Roda");
  await page
    .getByRole("combobox", { name: "Gênero", exact: true })
    .selectOption("Baião");
  await expect(page.locator(".song-row")).toHaveCount(2);
  await page.getByRole("button", { name: /Limpar filtros/ }).click();
  await page
    .getByRole("button", { name: "Limpar acordes", exact: true })
    .click();
  await expect(
    page.getByText("Selecione seus acordes para começar", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Buscar músicas", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Seus acordes", { exact: true }).fill("Amor");
  await page.getByLabel("Seus acordes", { exact: true }).press("Enter");
  await expect(
    page.getByRole("alert").filter({ hasText: "Não reconhecemos" }),
  ).toBeVisible();
  await page.getByLabel("Seus acordes", { exact: true }).fill("Bb");
  await page.getByLabel("Seus acordes", { exact: true }).press("Enter");
  await expect(
    page.getByRole("button", { name: "Remover Bb", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Remover Bb", exact: true }).click();
  await expect(
    page.getByText("Selecione seus acordes para começar", { exact: true }),
  ).toBeVisible();
});
test("campo de acordes aceita colar, remover, buscar artista e limpar tudo", async ({
  page,
}) => {
  await page.goto("/");
  await fullCatalog(page);
  const input = page.getByLabel("Seus acordes", { exact: true });
  await input.fill("G, D; Em C");
  await input.press("Enter");
  await expect(
    page.getByRole("button", { name: "Remover Em", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("4 acordes selecionados", { exact: true }),
  ).toBeVisible();
  await input.press("Backspace");
  await expect(
    page.getByRole("button", { name: "Remover C", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "C", exact: true }).click();
  await page.getByLabel("Música ou artista", { exact: true }).fill("Oficina");
  await page
    .getByRole("button", { name: "Buscar músicas", exact: true })
    .click();
  await expect(
    page.locator(".song-name p").filter({ hasText: "Roda" }),
  ).toHaveCount(0);
  await expect(page.locator(".song-row").first()).toBeVisible();
  expect(
    (await page.locator(".song-name p").allTextContents()).every((t) =>
      t.includes("Oficina"),
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Limpar", exact: true }).click();
  await expect(input).toHaveValue("");
  await expect(
    page.getByLabel("Música ou artista", { exact: true }),
  ).toHaveValue("");
  await expect(
    page.getByRole("button", { name: "Buscar músicas", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "G", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
});
for (const width of [1440, 1280, 768, 390, 320])
  test(`E: descoberta e alinhamento responsivo em ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await selectProfile(page);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (width === 320)
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await songLink(page).click();
    await expect(
      page.getByTestId("song-sheet").locator(".inline-chord").first(),
    ).toHaveText("G");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const alignment = await page
      .locator(".lyric-segment")
      .evaluateAll((segments) =>
        segments.every((s) => {
          const chord = s.querySelector(".inline-chord"),
            text = s.querySelector(".lyric-text");
          if (!chord || !text) return true;
          const a = chord.getBoundingClientRect(),
            b = text.getBoundingClientRect();
          return Math.abs(a.left - b.left) < 1 && a.bottom <= b.top + 1;
        }),
      );
    expect(alignment).toBe(true);
    for (let i = 0; i < 5; i++)
      await page.getByRole("button", { name: /Aumentar fonte/ }).click();
    await expect(page.getByTestId("song-sheet")).toHaveCSS("font-size", "28px");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
test("estado de carregamento comunica busca em andamento", async ({ page }) => {
  await page.route("**/api/songs?**", async (route) => {
    const response = await route.fetch();
    await new Promise((r) => setTimeout(r, 800));
    await route.fulfill({ response });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "G D Em C", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Buscando…");
  await expect(
    page.getByRole("region", { name: "Resultados da busca" }),
  ).toHaveAttribute("aria-busy", "true");
  await expect(page.locator(".song-row").first()).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Resultados da busca" }),
  ).toHaveAttribute("aria-busy", "false");
});
test("F: falha na busca é recuperável e provedor externo não é dependência", async ({
  page,
}) => {
  await page.route("**/api/songs?**", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Serviço temporariamente indisponível" }),
    }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "G D Em C", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Não foi possível carregar" }),
  ).toBeVisible();
  await page.unroute("**/api/songs?**");
  await page
    .getByRole("button", { name: "Tentar novamente", exact: true })
    .click();
  await expect(page.locator(".song-row").first()).toBeVisible();
  expect(
    (await page.request.post("/api/admin/import", { data: {} })).status(),
  ).toBe(401);
  expect((await page.request.get("/api/songs?known=Amor")).status()).toBe(400);
});
test("APIs públicas devolvem documento adaptado e diagramas reais", async ({
  request,
}) => {
  const response = await request.get(
    "/api/songs/primeiro-sol/adaptations?known=G,D,Em,C",
  );
  expect(response.ok()).toBe(true);
  const data = await response.json();
  expect(data.adaptation).toMatchObject({
    semitones: -2,
    capo: 2,
    effectiveKey: "A",
  });
  expect(data.document.sections[1].lines[0][0].chord).toBe("G");
  expect((await request.get("/api/songs/nao-existe")).status()).toBe(404);
  expect((await request.get("/api/chords?symbol=Amor")).status()).toBe(400);
  expect(
    (await (await request.get("/api/chords?symbol=C7M")).json()).shape.frets,
  ).toEqual([-1, 3, 2, 0, 0, 0]);
});
test("teclado, foco, estados acessíveis e axe nas duas telas", async ({
  page,
}) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Pular para o conteúdo" }),
  ).toBeFocused();
  await page.getByRole("button", { name: "G", exact: true }).focus();
  await page.keyboard.press("Space");
  await expect(
    page.getByRole("button", { name: "G", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await selectProfile(page);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await songLink(page).click();
  await expect(
    page.getByTestId("song-sheet").locator(".inline-chord").first(),
  ).toHaveText("G");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
