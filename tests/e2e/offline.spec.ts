import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
let artist =
  process.env.E2E_REAL_INDEX === "true" ? "Legião" : "Autor de índice de teste";
test.beforeAll(async ({ request }) => {
  if (process.env.E2E_REAL_INDEX === undefined) {
    const response = await request.get(
      "/api/songs?catalog=index&known=G,D,Em,C&q=Legi%C3%A3o",
    );
    if (response.ok() && (await response.json()).total > 0) artist = "Legião";
  }
  console.log(
    `Índice E2E: ${artist === "Legião" ? "corpus real chorrrds" : "fixture autoral CC0"}`,
  );
});
async function discover(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "G D Em C", exact: true }).click();
  await page.getByLabel("Música ou artista", { exact: true }).fill(artist);
  await page
    .getByRole("button", { name: "Buscar músicas", exact: true })
    .click();
  await expect(page.locator(".song-row").first()).toContainText(
    /Índice · sem cifra completa/,
  );
}
test("repertório persistido aparece na busca e abre índice honesto, não cifra inventada", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await discover(page);
  const link = page.locator(".song-row").first();
  const href = await link.getAttribute("href");
  const slug = href!.split("/musicas/")[1].split("?")[0];
  const response = await page.request.get(`/api/songs/${slug}`);
  expect(response.status()).toBe(200);
  const entry = await response.json();
  expect(entry.availability).toBe("index-only");
  expect(entry).not.toHaveProperty("document");
  const adapted = await page.request.get(
    `/api/songs/${slug}/adaptations?known=G,D,Em,C`,
  );
  expect(adapted.status()).toBe(422);
  expect(await adapted.json()).not.toHaveProperty("document");
  await link.click();
  await expect(
    page.getByRole("heading", {
      name: "Esta música ainda não tem cifra completa",
    }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toBeInViewport({
    ratio: 1,
  });
  await expect(
    page.getByRole("heading", {
      name: "Esta música ainda não tem cifra completa",
    }),
  ).toBeInViewport({ ratio: 1 });
  await expect(page.getByTestId("song-sheet")).toHaveCount(0);
  await expect(
    page.getByText("Tom da gravação e capotraste original não confirmados.", {
      exact: false,
    }),
  ).toBeVisible();
  await page.locator(".index-chords button").first().click();
  await expect(
    page.getByRole("img", { name: /afinação E A D G B E/ }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Transposição do conjunto", exact: true })
    .selectOption("1");
  await expect(page).toHaveURL(/shift=1/);
  await page.reload();
  await expect(
    page.getByRole("combobox", {
      name: "Transposição do conjunto",
      exact: true,
    }),
  ).toHaveValue("1");
  await page.getByText("Fonte e limites destes dados", { exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Consultar a fonte dos dados" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
for (const width of [1440, 1280, 768, 390, 320])
  test(`índice offline responsivo em ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await discover(page);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.locator(".song-row").first().click();
    await expect(
      page.getByRole("heading", { name: "Acordes do índice", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toBeInViewport({
      ratio: 1,
    });
    await expect(
      page.getByRole("heading", {
        name: "Esta música ainda não tem cifra completa",
      }),
    ).toBeInViewport({ ratio: 1 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (width === 1440 || width === 320)
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
