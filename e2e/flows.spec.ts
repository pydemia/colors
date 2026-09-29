import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

test("concept creation, roles, contrast, and both downloads", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /색을 고르는 순간/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: /콘셉트로 후보 만들기/ }).click();
  await expect(
    page.getByRole("heading", { name: "나만의 팔레트 스튜디오" }),
  ).toBeVisible();
  await expect(page.locator(".candidate-card")).toHaveCount(3);
  await page
    .getByRole("button", { name: /코드 편집기/ })
    .last()
    .click();
  await expect(
    page.getByLabel("코드 편집기 구문 색상 모사 시안"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Python" }).click();
  await expect(
    page.getByLabel("코드 편집기 구문 색상 모사 시안"),
  ).toContainText("dataclass");
  await page
    .getByRole("button", { name: /터미널/ })
    .last()
    .click();
  await expect(page.locator(".ansi-grid div")).toHaveCount(16);
  await page
    .getByRole("button", { name: /웹사이트/ })
    .last()
    .click();
  await expect(page.locator(".contrast-card")).toHaveCount(2);

  const jsonDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSON 백업 ↓" }).click();
  const json = await jsonDownload;
  expect(json.suggestedFilename()).toBe("colors-project.json");
  expect(
    JSON.parse(await readFile(await json.path(), "utf8")).swatches,
  ).toHaveLength(5);
  const cssDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "CSS 받기 ↓" }).click();
  const css = await cssDownload;
  expect(css.suggestedFilename()).toBe("colors-roles.css");
  expect(await readFile(await css.path(), "utf8")).toContain(
    "--colors-web-background:",
  );
  await page.screenshot({
    path: testInfo.outputPath("studio.png"),
    fullPage: true,
  });
});

test("documented JSON project imports through the browser control", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .locator('input[type=file][accept*="json"]')
    .setInputFiles(resolve(".worknotes/examples/locked-base-color.json"));
  await expect(
    page.getByRole("heading", { name: "나만의 팔레트 스튜디오" }),
  ).toBeVisible();
  await expect(page.getByLabel("1번째 원본색 HEX")).toHaveValue("#336699");
  await expect(page.getByLabel("1번째 원본색 HEX")).toBeDisabled();
});

test("base color remains locked through a new candidate and saved project survives reload", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: /기준색/ })
    .first()
    .click();
  await page.getByLabel("기준색 HEX").fill("#336699");
  await page.getByRole("button", { name: /기준색으로 후보 만들기/ }).click();
  await expect(page.getByLabel("1번째 원본색 HEX")).toHaveValue("#336699");
  await expect(page.getByLabel("1번째 원본색 HEX")).toBeDisabled();
  await page.locator(".candidate-card").nth(1).click();
  await expect(page.getByLabel("1번째 원본색 HEX")).toHaveValue("#336699");
  await page.getByRole("button", { name: "새 후보 만들기 ↗" }).click();
  await expect(page.getByLabel("1번째 원본색 HEX")).toHaveValue("#336699");
  await page.getByRole("button", { name: "이 기기에 저장" }).click();
  await page.reload();
  await page.getByRole("button", { name: /내 프로젝트/ }).click();
  await page
    .getByRole("button", { name: /#336699에서 시작한 팔레트/ })
    .first()
    .click();
  await expect(page.getByLabel("1번째 원본색 HEX")).toHaveValue("#336699");
});

test("photo functions are visibly pending and invalid input has feedback", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /사진 준비 중/ }).click();
  await expect(
    page.getByRole("button", { name: /사진 업로드 · 준비 중/ }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: /사진 다운로드 · 준비 중/ }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: /기준색/ })
    .first()
    .click();
  await page.getByLabel("기준색 HEX").fill("#bad");
  await page.getByRole("button", { name: /기준색으로 후보 만들기/ }).click();
  await expect(page.getByRole("status")).toContainText("형식");
});

test("keyboard navigation and narrow layout remain usable", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  if (testInfo.project.name === "mobile") {
    await page.screenshot({ path: testInfo.outputPath("mobile-home.png") });
  }
  if (testInfo.project.name === "desktop") {
    await page.getByRole("link", { name: "Colors 처음으로" }).focus();
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("link", { name: "팔레트 만들기" }),
    ).toBeFocused();
  }
  await page.getByRole("button", { name: /콘셉트로 후보 만들기/ }).click();
  await expect(page.locator("body")).toHaveJSProperty(
    "scrollWidth",
    await page.evaluate(() => document.body.clientWidth),
  );
  if (testInfo.project.name === "mobile") {
    await page.screenshot({ path: testInfo.outputPath("mobile-studio.png") });
  }
});
