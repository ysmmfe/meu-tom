import { chromium, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
const directory = process.env.VISUAL_OUTPUT ?? "docs/evidence";
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  if (process.argv.includes("--reference")) {
    const page = await browser.newPage();
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto("https://chords.chaosinstitut.de/", {
        waitUntil: "networkidle",
      });
      await page.screenshot({
        path: `${directory}/greifbar-${width}.png`,
        fullPage: true,
      });
    }
    await page.close();
  }
  for (const width of [1440, 1280, 768, 390, 320]) {
    const page = await browser.newPage();
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("http://localhost:3000/");
    await page.evaluate(() => localStorage.removeItem("meu-tom:chords"));
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Buscar músicas", exact: true }),
    ).toBeDisabled();
    await page.screenshot({
      path: `${directory}/inicio-${width}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "G D Em C", exact: true }).click();
    await page.locator(".song-row").first().waitFor();
    await page.screenshot({
      path: `${directory}/descoberta-${width}.png`,
      fullPage: true,
    });
    const indexed = page
      .locator(".song-row")
      .filter({ hasText: "Índice · sem cifra completa" })
      .first();
    if (await indexed.count()) {
      await indexed.click();
      await page
        .getByRole("heading", {
          name: "Esta música ainda não tem cifra completa",
        })
        .waitFor();
      // Next may align the Page below the layout header, not at document y=0.
      // Verify the real arrival viewport, then standardize full-page captures.
      await expect(page.getByRole("heading", { level: 1 })).toBeInViewport({
        ratio: 1,
      });
      await expect(
        page.getByRole("heading", {
          name: "Esta música ainda não tem cifra completa",
        }),
      ).toBeInViewport({ ratio: 1 });
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: `${directory}/indice-${width}.png`,
        fullPage: true,
      });
    }
    await page.goto(
      "http://localhost:3000/musicas/primeiro-sol?known=G,D,Em,C&shift=-2&capo=2",
    );
    await page.getByTestId("effective-key").filter({ hasText: "A" }).waitFor();
    await expect(
      page.getByTestId("song-sheet").locator(".inline-chord").first(),
    ).toHaveText("G");
    await page.screenshot({
      path: `${directory}/cifra-${width}.png`,
      fullPage: true,
    });
    console.log(
      width,
      await page.evaluate(() => ({
        width: innerWidth,
        scroll: document.documentElement.scrollWidth,
      })),
    );
    await page.close();
  }
} finally {
  await browser.close();
}
