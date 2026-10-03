import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

test("multiple fixed and flexible inputs, deliberate adoption and export round trip", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.getByRole("button", { name: /기준색/ }).first().click();
  await page.getByLabel("1번째 입력색", { exact: true }).fill("#336699");
  await page.getByRole("button", { name: "입력색 추가 +" }).click();
  await page.getByLabel("2번째 입력색", { exact: true }).fill("#E05566");
  await page.getByLabel("색 고정 2", { exact: true }).uncheck();
  await page.getByRole("button", { name: /기준색으로 후보 만들기/ }).click();
  await expect(page.getByLabel("1번째 원본색 HEX")).toHaveValue("#336699");
  await expect(page.locator(".color-change")).toHaveCount(2);
  const before = await page.getByLabel("2번째 원본색 HEX").inputValue();
  await page.getByLabel("화면 테마", { exact: true }).last().selectOption("dark");
  await expect(page.getByLabel("2번째 원본색 HEX")).toHaveValue(before);
  await page.getByRole("button", { name: "설정으로 후보 만들기 ↗" }).click();
  await expect(page.getByLabel("2번째 원본색 HEX")).toHaveValue(before);
  await expect(page.getByLabel("1번째 원본색 HEX")).toHaveValue("#336699");
  await page.locator(".candidate-card").nth(1).click();
  const adopted = await page.getByLabel("2번째 원본색 HEX").inputValue();
  await page.getByRole("button", { name: "새 후보 만들기 ↗" }).click();
  await expect(page.getByLabel("2번째 원본색 HEX")).toHaveValue(adopted);
  await expect(page.locator(".candidate-selected")).toHaveCount(0);
  await page.getByRole("button", { name: "유연색 모두 되돌리기" }).click();
  await expect(page.getByLabel("2번째 원본색 HEX")).toHaveValue("#E05566");
  await expect(page.locator(".candidate-selected")).toHaveCount(0);
  await page.locator(".color-analysis > summary").click();
  await page.getByLabel("표색계", { exact: true }).selectOption("lab");
  await expect(page.getByLabel("1번째 원본색 HEX")).toHaveValue("#336699");
  await page.getByLabel("colormap 유형").selectOption("cyclic");
  await page.locator(".context-scenes > summary").click();
  await page.getByRole("button", { name: "현재 색을 장면으로 저장 +" }).click();
  await expect(page.locator(".sequence-list li")).toHaveCount(1);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSON 백업 ↓" }).click();
  const downloaded = await downloadPromise;
  const data = JSON.parse(await readFile(await downloaded.path(), "utf8"));
  expect(data.schemaVersion).toBe(2);
  expect(data.studio.anchors[0].originalHex).toBe("#336699");
  expect(data.studio.anchors[1].originalHex).toBe("#E05566");
  expect(data.sequence).toHaveLength(1);
  expect(data.studio.editingSpace).toBe("lab");
  await page.reload();
  await page.getByRole("button", { name: /내 프로젝트/ }).click();
  await page.getByRole("button", { name: /#336699에서 시작한 팔레트/ }).first().click();
  await page.locator(".color-analysis > summary").click();
  await expect(page.getByLabel("표색계", { exact: true })).toHaveValue("lab");
  await page.locator(".context-scenes > summary").click();
  await expect(page.locator(".sequence-list li")).toHaveCount(1);
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", await page.evaluate(() => document.body.clientWidth));
  await page.locator(".refinement-panel").scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("multi-anchor.png") });
});

test("recipe, off-grid stops, persistent conflicts and XML export parsing", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /서늘한 미스터리/ }).click();
  await expect(page.getByLabel("1번째 입력색", { exact: true })).toHaveValue("#9CAF88");
  await page.getByRole("button", { name: /기준색으로 후보 만들기/ }).click();
  await page.locator(".color-analysis > summary").click();
  await page.getByLabel("colormap 유형").selectOption("cyclic");
  await page.getByLabel("s1 위치 t", { exact: true }).fill("0.3");
  await page.getByLabel("s2 위치 t", { exact: true }).fill("0.3");
  await expect(page.locator(".constraint-feedback")).toContainText("같은 위치");
  await page.getByLabel("내보내기 형식").selectOption("colormap");
  await page.getByRole("button", { name: "선택한 형식 받기 ↓" }).click();
  await expect(page.getByRole("status")).toContainText("같은 위치");
  await page.getByLabel("내보내기 형식").selectOption("office");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "선택한 형식 받기 ↓" }).click();
  const downloaded = await downloadPromise;
  const xml = await readFile(await downloaded.path(), "utf8");
  const parsed = await page.evaluate(xml => {
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    return { errors: doc.getElementsByTagName("parsererror").length,
      colors: doc.getElementsByTagNameNS("http://schemas.openxmlformats.org/drawingml/2006/main", "srgbClr").length };
  }, xml);
  expect(parsed).toEqual({ errors: 0, colors: 12 });
});

test("current avoidance warning, focus preview and malformed scene import", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel(/피할 색/).fill("#FF0000");
  await page.getByRole("button", { name: /콘셉트로 후보 만들기/ }).click();
  await page.getByLabel("6번째 원본색 HEX").fill("#FF0000");
  await page.getByLabel("6번째 원본색 HEX").press("Tab");
  await expect(page.locator(".current-constraints")).toContainText("6번 색이 회피 범위");
  await page.getByRole("button", { name: "시안 버튼 · 포커스 색 확인" }).focus();
  await expect(page.getByRole("button", { name: "시안 버튼 · 포커스 색 확인" })).toBeFocused();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSON 백업 ↓" }).click();
  const downloaded = await downloadPromise;
  const data = JSON.parse(await readFile(await downloaded.path(), "utf8"));
  data.sequence = [{ id: "bad", name: "missing fields" }];
  await page.locator('input[type=file][accept*="json"]').setInputFiles({
    name: "invalid-scene.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(data)),
  });
  await expect(page.getByRole("status")).toContainText("장면 데이터");
  await expect(page.getByLabel("6번째 원본색 HEX")).toHaveValue("#FF0000");
});

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
  await expect(page.locator(".contrast-card")).toHaveCount(10);

  const jsonDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSON 백업 ↓" }).click();
  const json = await jsonDownload;
  expect(json.suggestedFilename()).toBe("colors-project.json");
  expect(
    JSON.parse(await readFile(await json.path(), "utf8")).swatches,
  ).toHaveLength(6);
  const cssDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "CSS 받기 ↓" }).click();
  const css = await cssDownload;
  expect(css.suggestedFilename()).toBe("colors-roles.css");
  expect(await readFile(await css.path(), "utf8")).toContain(
    "--colors-web-background:",
  );
  await page.screenshot({
    path: testInfo.outputPath("studio.png"),
    fullPage: testInfo.project.name === "desktop",
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
  await page.getByLabel("1번째 입력색", { exact: true }).fill("#336699");
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
  await page.getByLabel("1번째 입력색", { exact: true }).fill("not-a-color");
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
