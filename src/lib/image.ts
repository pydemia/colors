import { converter } from "culori";

export const IMAGE_ACCEPT = "image/png,image/jpeg,image/webp,image/gif,image/avif,image/bmp";
export const IMAGE_MAX_BYTES = 20 * 1024 * 1024;
const SAMPLE_EDGE = 256;
const toLab = converter("oklab");

export interface ImageColor {
  hex: string;
  share: number;
}

export interface DecodedImage {
  url: string;
  width: number;
  height: number;
  pixels: Uint8ClampedArray;
}

export function validateImageFile(file: Pick<File, "name" | "type" | "size">): void {
  const types = IMAGE_ACCEPT.split(",");
  const extension = /\.(png|jpe?g|webp|gif|avif|bmp)$/i;
  if (!(types.includes(file.type) || file.type === "image/x-ms-bmp" ||
    (!file.type && extension.test(file.name)))) {
    throw new Error("PNG·JPEG·WebP·GIF·AVIF·BMP 이미지를 선택하세요. HEIC·SVG는 PNG나 JPEG로 변환해 주세요.");
  }
  if (!file.size) throw new Error("비어 있는 이미지 파일입니다.");
  if (file.size > IMAGE_MAX_BYTES)
    throw new Error("이미지는 20MB 이하여야 합니다.");
}

export async function decodeImage(file: File): Promise<DecodedImage> {
  validateImageFile(file);
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    try {
      await image.decode();
    } catch {
      throw new Error("이미지를 읽지 못했습니다. 손상 여부를 확인하거나 PNG·JPEG로 변환해 주세요.");
    }
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    if (!width || !height || width * height > 64_000_000)
      throw new Error("이미지 크기는 6,400만 픽셀 이하여야 합니다.");
    const scale = Math.min(1, SAMPLE_EDGE / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("이 브라우저에서는 이미지 색을 읽을 수 없습니다.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    return { url, width, height, pixels };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

interface Sample {
  hex: string;
  weight: number;
  lab: [number, number, number];
}

function distance(a: number[], b: number[]): number {
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
}

// Deterministic weighted OKLab clustering; output actual sampled sRGB colors.
export function extractImageColors(
  pixels: Uint8ClampedArray, count: number,
): ImageColor[] {
  if (!Number.isInteger(count) || count < 1 || count > 12)
    throw new Error("추출할 색은 1~12개여야 합니다.");
  if (!pixels.length || pixels.length % 4)
    throw new Error("이미지 픽셀 데이터가 잘못되었습니다.");
  const histogram = new Map<number, number>();
  for (let i = 0; i < pixels.length; i += 4) {
    if (!pixels[i + 3]) continue;
    const key = pixels[i] * 65536 + pixels[i + 1] * 256 + pixels[i + 2];
    histogram.set(key, (histogram.get(key) ?? 0) + pixels[i + 3] / 255);
  }
  if (!histogram.size) throw new Error("보이는 색이 없는 투명 이미지입니다.");
  const samples = [...histogram].sort(([a], [b]) => a - b).map(([rgb, weight]) => {
    const hex = `#${rgb.toString(16).padStart(6, "0").toUpperCase()}`;
    const lab = toLab(hex)!;
    return { hex, weight, lab: [lab.l, lab.a, lab.b] as [number, number, number] };
  });
  const dominant = samples.reduce((best, sample) =>
    sample.weight > best.weight ? sample : best);
  const centers: number[][] = [[...dominant.lab]];
  // A minimum separation prevents JPEG noise from consuming extra swatches.
  const minimumDistance = 0.025 ** 2;
  while (centers.length < count) {
    let next: Sample | undefined;
    let score = 0;
    for (const sample of samples) {
      const nearest = Math.min(...centers.map(center => distance(sample.lab, center)));
      const weighted = nearest * Math.sqrt(sample.weight);
      if (nearest >= minimumDistance && weighted > score) {
        score = weighted;
        next = sample;
      }
    }
    if (!next) break;
    centers.push([...next.lab]);
  }
  const assignments = new Int16Array(samples.length).fill(-1);
  let weights = new Float64Array(centers.length);
  for (let pass = 0; pass < 12; pass++) {
    const sums = centers.map(() => [0, 0, 0]);
    weights = new Float64Array(centers.length);
    let changed = false;
    samples.forEach((sample, index) => {
      let nearest = 0;
      for (let c = 1; c < centers.length; c++)
        if (distance(sample.lab, centers[c]) < distance(sample.lab, centers[nearest])) nearest = c;
      if (assignments[index] !== nearest) changed = true;
      assignments[index] = nearest;
      weights[nearest] += sample.weight;
      for (let axis = 0; axis < 3; axis++)
        sums[nearest][axis] += sample.lab[axis] * sample.weight;
    });
    centers.forEach((center, c) => {
      if (weights[c]) centers[c] = sums[c].map(sum => sum / weights[c]);
      else centers[c] = center;
    });
    if (!changed) break;
  }
  const representatives: (Sample | undefined)[] = centers.map(() => undefined);
  samples.forEach((sample, index) => {
    const c = assignments[index];
    const best = representatives[c];
    if (!best || distance(sample.lab, centers[c]) < distance(best.lab, centers[c]))
      representatives[c] = sample;
  });
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const groups = representatives.flatMap((sample, c) => sample
    ? [{ ...sample, share: weights[c] / total }] : [])
    .sort((a, b) => b.share - a.share || a.hex.localeCompare(b.hex));
  const distinct: typeof groups = [];
  for (const group of groups) {
    const similar = distinct.find(other => distance(group.lab, other.lab) < minimumDistance);
    if (similar) similar.share += group.share;
    else distinct.push(group);
  }
  return distinct.map(({ hex, share }) => ({ hex, share }))
    .sort((a, b) => b.share - a.share || a.hex.localeCompare(b.hex));
}
