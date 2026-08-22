import { expect, test } from "@playwright/test";

async function login(page: import("@playwright/test").Page, projectName: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill("admin@doctype.local");
  await page.getByLabel("Senha").fill("Doctype@2026");
  await page.getByRole("button", { name: "Entrar no DOCTYPE OS" }).click();
  await expect(page.locator(".topbar h1")).toHaveText("Visão Geral");
  if (projectName === "mobile") await page.getByRole("button", { name: "Abrir menu" }).click();
}

test("DOC Monitor principles keep readable dark-theme contrast", async ({ page }, testInfo) => {
  await login(page, testInfo.project.name);
  await page.getByRole("button", { name: /^DOC Monitor/ }).click();
  await expect(page.locator(".topbar h1")).toHaveText("DOC Monitor");

  const principles = page.locator(".monitor-principles > div");
  await expect(principles).toHaveCount(3);

  for (let i = 0; i < 3; i += 1) {
    const card = principles.nth(i);
    await expect(card).toBeVisible();
    const styles = await card.evaluate((el) => {
      const cardStyle = getComputedStyle(el);
      const title = el.querySelector("strong");
      const description = el.querySelector("span");
      return {
        background: cardStyle.backgroundColor,
        titleColor: title ? getComputedStyle(title).color : "",
        descriptionColor: description ? getComputedStyle(description).color : "",
        descriptionOpacity: description ? getComputedStyle(description).opacity : "",
      };
    });
    expect(styles.background).not.toBe("rgb(248, 250, 255)");
    expect(styles.titleColor).toBe("rgb(255, 255, 255)");
    expect(styles.descriptionColor).not.toBe("rgb(23, 32, 51)");
    expect(styles.descriptionOpacity).toBe("1");
  }
});
