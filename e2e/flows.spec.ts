import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { contrastRatio } from "../src/lib/color";
import { parseColor } from "../src/lib/studio";

const imageColors = ["#234D4A", "#E2A46D", "#336699", "#F2E9DA", "#943D52"];

async function imageFixture(page: Page, transparent = false) {
  const base64 = await page.evaluate(({ colors, transparent }) => {
    const canvas = document.createElement("canvas");
    canvas.width = 250;
    canvas.height = 100;
    const context = canvas.getContext("2d")!;
    if (!transparent) colors.forEach((color, index) => {
      context.fillStyle = color;
      context.fillRect(index * 50, 0, 50, 100);
    });
    return canvas.toDataURL("image/png").split(",")[1];
  }, { colors: imageColors, transparent });
  return { name: transparent ? "transparent.png" : "color-study.png",
    mimeType: "image/png", buffer: Buffer.from(base64, "base64") };
}

test("photo upload, fixed and flexible colors, exports and saved restoration", async ({ page }, testInfo) => {
  await page.goto("/#photo");
  const transmissions: string[] = [];
  page.on("request", request => {
    if (["POST", "PUT", "PATCH"].includes(request.method()))
      transmissions.push(request.url());
  });
  await page.getByLabel("사진 또는 이미지 파일").setInputFiles(await imageFixture(page));
  await expect(page.locator(".image-colors li")).toHaveCount(5);
  for (const hex of imageColors) await expect(page.locator(".image-colors")).toContainText(hex);
  await expect(page.locator(".photo-status")).toContainText("250 × 100");
  await page.getByLabel("추출할 대표색", { exact: true }).selectOption("3");
  await page.getByRole("button", { name: "대표색 다시 추출", exact: true }).click();
  await expect(page.locator(".image-colors li")).toHaveCount(3);
  await page.getByLabel("추출할 대표색", { exact: true }).selectOption("5");
  await page.getByRole("button", { name: "대표색 다시 추출", exact: true }).click();
  const original = await page.getByLabel("1번째 입력색", { exact: true }).inputValue();
  const flexible = await page.getByLabel("2번째 입력색", { exact: true }).inputValue();
  await page.getByLabel("색 고정 2", { exact: true }).uncheck();
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", await page.evaluate(() => document.body.clientWidth));
  await page.locator(".photo-result").scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("image-extraction.png") });
  await page.getByRole("button", { name: /이미지 색으로 후보 만들기/ }).click();
  await expect(page.locator(".candidate-card")).toHaveCount(3);
  await expect(page.getByLabel("1번째 원본색 HEX")).toHaveValue(original);
  await expect(page.getByLabel("1번째 원본색 HEX")).toBeDisabled();
  await page.locator(".candidate-card").nth(1).click();
  await expect(page.getByLabel("1번째 원본색 HEX")).toHaveValue(original);
  const jsonPending = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSON 백업 ↓" }).click();
  const jsonFile = await jsonPending;
  const bytes = await readFile(await jsonFile.path(), "utf8");
  const data = JSON.parse(bytes);
  expect(data.source).toMatchObject({ kind: "photo", image: {
    acquisition: "upload", filename: "color-study.png",
  } });
  expect(data.studio.anchors[1]).toMatchObject({ originalHex: flexible, locked: false });
  expect(data.swatches[0]).toMatchObject({ hex: original, origin: "autoExtracted" });
  expect(data.swatches[0].imageSourceId).toBe(data.source.image.id);
  expect(bytes).not.toMatch(/data:image|blob:|base64|pixels/);
  const cssPending = page.waitForEvent("download");
  await page.getByRole("button", { name: "CSS 받기 ↓" }).click();
  const cssFile = await cssPending;
  expect(await readFile(await cssFile.path(), "utf8")).toContain(`--colors-palette-s1: ${original};`);
  await page.reload();
  await expect(page.getByAltText("색을 추출한 원본 이미지")).toHaveCount(0);
  await page.getByRole("button", { name: /내 프로젝트/ }).click();
  await page.getByRole("button", { name: /사진에서 시작한 팔레트/ }).first().click();
  await expect(page.getByLabel("1번째 원본색 HEX")).toHaveValue(original);
  page.once("dialog", dialog => dialog.accept());
  await page.locator('input[type=file][accept*="json"]').setInputFiles({
    name: "photo-project.json", mimeType: "application/json", buffer: Buffer.from(bytes),
  });
  await expect(page.getByRole("status")).toContainText("프로젝트를 가져왔습니다");
  expect(transmissions).toEqual([]);
});

test("image paste and drop events, validation and recovery", async ({ page }) => {
  await page.goto("/#photo");
  const fixture = await imageFixture(page);
  const dispatchImage = async (kind: "paste" | "drop", base64: string, name = "color-study.png") => {
    await page.locator(".photo-workspace").evaluate((element, { kind, base64, name }) => {
      const bytes = Uint8Array.from(atob(base64), char => char.charCodeAt(0));
      const data = new DataTransfer();
      data.items.add(new File([bytes], name, { type: "image/png" }));
      const event = kind === "paste"
        ? new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: data })
        : new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: data });
      element.dispatchEvent(event);
    }, { kind, base64, name });
  };
  await dispatchImage("paste", fixture.buffer.toString("base64"));
  await expect(page.locator(".photo-status")).toContainText("붙여넣은 이미지");
  await expect(page.locator(".image-colors li")).toHaveCount(5);
  await page.getByRole("button", { name: /이미지 색으로 후보 만들기/ }).click();
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSON 백업 ↓" }).click();
  const file = await pending;
  expect(JSON.parse(await readFile(await file.path(), "utf8")).source.image.acquisition).toBe("clipboard");
  await page.getByRole("button", { name: /사진·이미지/ }).click();
  await dispatchImage("drop", fixture.buffer.toString("base64"), "dropped.png");
  await expect(page.locator(".photo-status")).toContainText("dropped.png");
  const input = page.getByLabel("사진 또는 이미지 파일");
  await input.setInputFiles({ name: "bad.png", mimeType: "image/png", buffer: Buffer.from("broken") });
  await expect(page.getByRole("alert")).toContainText("이미지를 읽지 못했습니다");
  await expect(page.locator(".photo-status")).toContainText("dropped.png");
  await input.setInputFiles(await imageFixture(page, true));
  await expect(page.getByRole("alert")).toContainText("투명 이미지");
  await input.setInputFiles({ name: "vector.svg", mimeType: "image/svg+xml", buffer: Buffer.from("<svg/>") });
  await expect(page.getByRole("alert")).toContainText("SVG");
  await input.setInputFiles(fixture);
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.getByRole("button", { name: "이미지 제거", exact: true }).click();
  await expect(page.getByAltText("색을 추출한 원본 이미지")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /이미지 색으로 후보 만들기/ })).toHaveCount(0);
});

test("export center downloads current CSS and native program files", async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  await page.goto("/");
  await expect(page.getByRole("button", { name: "선택한 형식 받기 ↓" })).toBeDisabled();
  await page.getByRole("button", { name: /기준색/ }).first().click();
  await page.getByLabel("1번째 입력색", { exact: true }).fill("#123456");
  await page.getByRole("button", { name: /기준색으로 후보 만들기/ }).click();
  await page.getByLabel("주색 HEX", { exact: true }).fill("#ABCDEF");
  await page.getByLabel("주색 HEX", { exact: true }).press("Tab");
  const buttonColors = await page.getByRole("button", { name: "선택한 형식 받기 ↓" }).evaluate(button => {
    const style = getComputedStyle(button);
    return { foreground: style.color, background: style.backgroundColor };
  });
  expect(contrastRatio(parseColor(buttonColors.foreground)!, parseColor(buttonColors.background)!)).toBeGreaterThanOrEqual(4.5);
  await page.locator(".export-preview > summary").click();
  await expect(page.getByLabel("생성 파일 미리보기")).toContainText("--colors-palette-s1: #123456;");
  await expect(page.getByLabel("생성 파일 미리보기")).toContainText("--colors-web-primary: #ABCDEF;");
  const download = async (button: string) => {
    const pending = page.waitForEvent("download");
    await page.getByRole("button", { name: button, exact: true }).click();
    const file = await pending;
    return { name: file.suggestedFilename(), bytes: await readFile(await file.path()) };
  };
  const css = await download("선택한 형식 받기 ↓");
  expect(css.name).toBe("colors-roles.css");
  expect(css.bytes.toString()).toContain("--colors-palette-s1: #123456;");
  expect(css.bytes.toString()).toContain("--colors-web-primary: #ABCDEF;");
  const project = JSON.parse((await download("JSON 백업 ↓")).bytes.toString());
  const color = (set: string, role: string) => {
    const binding = project.roleSets[set][role];
    return binding.overrideHex ?? project.swatches.find((s: { id: string }) => s.id === binding.swatchId).hex;
  };
  const formats = [
    ["vscodeSettings", "colors-vscode-settings.json"], ["jetbrains", "colors.icls"],
    ["vim", "colors.vim"], ["iterm", "colors.itermcolors"], ["putty", "colors-putty.reg"],
  ];
  for (const [format, name] of formats) {
    await page.getByLabel("내보내기 형식").selectOption(format);
    await expect(page.locator(".export-filename")).toContainText(name);
    await expect(page.locator(".export-guide")).not.toBeEmpty();
    const file = await download("선택한 형식 받기 ↓");
    expect(file.name).toBe(name);
    expect(file.bytes.length).toBeGreaterThan(100);
    const text = file.bytes.toString(format === "putty" ? "utf16le" : "utf8");
    if (format === "vscodeSettings") {
      expect(JSON.parse(text)["workbench.colorCustomizations"]["editor.foreground"])
        .toBe(color("editor", "foreground"));
    } else if (format === "vim") {
      expect(text).toContain(`highlight Normal guifg=${color("editor", "foreground")}`);
    } else if (format === "putty") {
      expect([...file.bytes.slice(0, 2)]).toEqual([255, 254]);
      expect([...text.matchAll(/"Colour\d+"=/g)]).toHaveLength(22);
      const hex = color("terminal", "foreground").slice(1);
      const rgb = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16)).join(",");
      expect(text).toContain(`"Colour0"="${rgb}"`);
    } else {
      const parsed = await page.evaluate(xml => {
        const doc = new DOMParser().parseFromString(xml, "application/xml");
        return { errors: doc.getElementsByTagName("parsererror").length,
          root: doc.documentElement.nodeName,
          foreground: doc.querySelector('attributes > option[name="TEXT"] option[name="FOREGROUND"]')?.getAttribute("value"),
          itermEntries: doc.querySelectorAll("plist > dict > key").length };
      }, text);
      expect(parsed.errors).toBe(0);
      expect(parsed.root).toBe(format === "jetbrains" ? "scheme" : "plist");
      if (format === "jetbrains") expect(parsed.foreground).toBe(color("editor", "foreground").slice(1));
      else expect(parsed.itermEntries).toBe(23);
    }
  }
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", await page.evaluate(() => document.body.clientWidth));
  await page.locator(".extended-exports").scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("export-center.png") });
});

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

test("invalid seed input has feedback", async ({
  page,
}) => {
  await page.goto("/");
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
