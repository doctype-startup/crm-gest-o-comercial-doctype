import { expect, test } from "@playwright/test";

test("Guardião principles remain readable and visible", async ({ page }, testInfo) => {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill("admin@doctype.local");
  await page.getByLabel("Senha").fill("Doctype@2026");
  await page.getByRole("button", { name: "Entrar no DOCTYPE OS" }).click();
  await expect(page.locator(".topbar h1")).toHaveText("Visão Geral");

  if (testInfo.project.name === "mobile") await page.getByRole("button", { name: "Abrir menu" }).click();
  await page.getByRole("button", { name: /^DOC Monitor/ }).click();

  const titles = ["Observa", "Orienta", "Registra"];
  for (const title of titles) {
    const card = page.locator(".monitor-principles > div").filter({ hasText: title });
    await expect(card).toBeVisible();
    await expect(card.locator("strong")).toHaveText(title);
    const contrast = await card.evaluate((el) => {
      const strong = el.querySelector("strong");
      const span = el.querySelector("span");
      return {
        background: getComputedStyle(el).backgroundColor,
        title: strong ? getComputedStyle(strong).color : "",
        detail: span ? getComputedStyle(span).color : "",
        opacity: span ? getComputedStyle(span).opacity : "",
      };
    });
    expect(contrast.background).not.toBe("rgb(248, 250, 255)");
    expect(contrast.title).toBe("rgb(255, 255, 255)");
    expect(contrast.detail).not.toBe("rgb(23, 32, 51)");
    expect(contrast.opacity).toBe("1");
  }
});
