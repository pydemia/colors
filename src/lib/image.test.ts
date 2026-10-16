import { describe, expect, it } from "vitest";
import { extractImageColors, IMAGE_MAX_BYTES, validateImageFile } from "./image";
import { createProject, exportProject, parseProject, regenerate } from "./project";
import { createAnchor, defaultStudio, recommend } from "./studio";

function pixels(...colors: number[][]) {
  return new Uint8ClampedArray(colors.flat());
}

describe("local image palette", () => {
  it("preserves dominant sample colors and alpha-weighted proportions", () => {
    const result = extractImageColors(pixels(
      [255, 0, 0, 255], [255, 0, 0, 255],
      [0, 0, 255, 128], [0, 255, 0, 0],
    ), 5);
    expect(result.map(color => color.hex)).toEqual(["#FF0000", "#0000FF"]);
    expect(result[0].share).toBeCloseTo(2 / (2 + 128 / 255));
    expect(result.reduce((sum, color) => sum + color.share, 0)).toBeCloseTo(1);
  });

  it("clusters deterministically and returns sampled colors", () => {
    const samples = Array.from({ length: 1600 }, (_, i) =>
      [i * 71 % 256, i * 29 % 256, i * 11 % 256, 255]);
    const forward = extractImageColors(pixels(...samples), 6);
    expect(extractImageColors(pixels(...samples.reverse()), 6)).toEqual(forward);
    expect(forward).toHaveLength(6);
    const available = new Set(samples.map(rgb => "#" + rgb.slice(0, 3)
      .map(channel => channel.toString(16).padStart(2, "0")).join("").toUpperCase()));
    expect(forward.every(color => available.has(color.hex))).toBe(true);
  });

  it("handles a single color without inventing extracted colors", () => {
    expect(extractImageColors(pixels([18, 52, 86, 255]), 12))
      .toEqual([{ hex: "#123456", share: 1 }]);
  });

  it("groups compression noise while retaining a small contrasting color", () => {
    const samples = Array.from({ length: 1000 }, (_, i) =>
      [35 + i % 3, 77 + i % 4, 74 + i % 3, 255]);
    samples.push(...Array.from({ length: 20 }, () => [242, 233, 218, 255]));
    const colors = extractImageColors(pixels(...samples), 5);
    expect(colors).toHaveLength(2);
    expect(colors[0].share).toBeCloseTo(1000 / 1020);
    expect(colors[1].hex).toBe("#F2E9DA");
  });

  it("rejects empty, transparent, malformed pixels and invalid counts", () => {
    expect(() => extractImageColors(pixels([1, 2, 3, 0]), 5)).toThrow("투명");
    expect(() => extractImageColors(pixels(), 5)).toThrow("픽셀");
    expect(() => extractImageColors(new Uint8ClampedArray([1, 2]), 5)).toThrow("픽셀");
    for (const count of [0, 13, 1.5, NaN])
      expect(() => extractImageColors(pixels([1, 2, 3, 255]), count)).toThrow("1~12");
  });

  it("checks type and size before decoding", () => {
    expect(() => validateImageFile({ name: "photo.JPG", type: "", size: 100 })).not.toThrow();
    expect(() => validateImageFile({ name: "clip.png", type: "image/png", size: IMAGE_MAX_BYTES })).not.toThrow();
    expect(() => validateImageFile({ name: "a.svg", type: "image/svg+xml", size: 100 })).toThrow("SVG");
    expect(() => validateImageFile({ name: "a.heic", type: "image/heic", size: 100 })).toThrow("HEIC");
    expect(() => validateImageFile({ name: "a.png", type: "image/png", size: 0 })).toThrow("비어");
    expect(() => validateImageFile({ name: "a.png", type: "image/png", size: IMAGE_MAX_BYTES + 1 })).toThrow("20MB");
  });

  it("round-trips photo metadata and preserves fixed colors on regeneration", () => {
    const studio = defaultStudio([createAnchor("#123456", 0)]);
    const source = { kind: "photo" as const, image: {
      id: "photo-test", acquisition: "clipboard" as const, filename: "붙여넣은 이미지",
    } };
    const project = createProject(source, recommend(studio)[0].colors, studio);
    expect(project.swatches[0]).toMatchObject({
      origin: "autoExtracted", imageSourceId: "photo-test", locked: true,
    });
    const restored = parseProject(exportProject(project));
    expect(restored.source).toEqual(source);
    expect(regenerate(restored).project.swatches[0].hex).toBe("#123456");
    expect(regenerate(restored).project.source).toEqual(source);
  });
});
