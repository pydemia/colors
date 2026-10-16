import { useEffect, useRef, useState, type ClipboardEvent, type DragEvent } from "react";
import {
  decodeImage, extractImageColors, IMAGE_ACCEPT,
  type DecodedImage, type ImageColor,
} from "../lib/image";
import type { Source } from "../lib/project";
import type { Studio } from "../lib/studio";
import { SeedFields, StudioSettings } from "./StudioPanels";

type PhotoSource = Extract<Source, { kind: "photo" }>;
type Photo = DecodedImage & { source: PhotoSource; colors: ImageColor[] };

export function PhotoPanel({ value, onChange, onColors, onGenerate }: {
  value: Studio;
  onChange: (studio: Studio) => void;
  onColors: (colors: ImageColor[]) => void;
  onGenerate: (source: PhotoSource) => void;
}) {
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [count, setCount] = useState(5);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const pasteTarget = useRef<HTMLButtonElement>(null);
  const url = useRef<string | null>(null);
  const loadId = useRef(0);

  useEffect(() => () => {
    loadId.current++;
    if (url.current) URL.revokeObjectURL(url.current);
  }, []);

  async function read(file: File, acquisition: "upload" | "clipboard") {
    const current = ++loadId.current;
    setBusy(true);
    setError("");
    let decoded: DecodedImage | null = null;
    try {
      decoded = await decodeImage(file);
      if (current !== loadId.current) {
        URL.revokeObjectURL(decoded.url);
        return;
      }
      const colors = extractImageColors(decoded.pixels, count);
      if (url.current) URL.revokeObjectURL(url.current);
      url.current = decoded.url;
      setPhoto({ ...decoded, colors, source: { kind: "photo", image: {
        id: crypto.randomUUID(), acquisition,
        filename: acquisition === "clipboard" ? "붙여넣은 이미지" : file.name,
      } } });
      onColors(colors);
    } catch (cause) {
      if (decoded) URL.revokeObjectURL(decoded.url);
      if (current === loadId.current)
        setError(cause instanceof Error ? cause.message : "이미지를 읽지 못했습니다.");
    } finally {
      if (current === loadId.current) setBusy(false);
    }
  }

  function paste(event: ClipboardEvent<HTMLDivElement>) {
    const item = [...event.clipboardData.items].find(item => item.type.startsWith("image/"));
    const file = item?.getAsFile();
    if (file) {
      event.preventDefault();
      void read(file, "clipboard");
    } else if (event.target === pasteTarget.current) {
      setError("클립보드에 이미지가 없습니다. 이미지 자체를 복사한 뒤 붙여넣거나 파일을 선택하세요.");
    }
  }

  function drop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    const files = event.dataTransfer.files;
    if (files.length !== 1) {
      setError("이미지 파일 한 개를 놓아 주세요.");
      return;
    }
    void read(files[0], "upload");
  }

  return <div className={`photo-workspace ${dragging ? "is-dragging" : ""}`}
    onPaste={paste} onDrop={drop}
    onDragOver={event => {
      if (event.dataTransfer.types.includes("Files")) {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
        setDragging(true);
      }
    }}
    onDragLeave={event => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null))
        setDragging(false);
    }}>
    <div className="photo-input-head">
      <div><span className="field-kicker">PHOTO TO PALETTE</span>
        <h3>사진의 색을 나만의 조합으로.</h3>
        <p>파일을 선택하거나 이 영역에 놓으세요. 캡처한 이미지도 붙여넣을 수 있습니다.</p>
      </div>
      <div className="photo-input-actions">
        <input ref={input} hidden type="file" accept={IMAGE_ACCEPT}
          aria-label="사진 또는 이미지 파일" onChange={event => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void read(file, "upload");
          }} />
        <button type="button" onClick={() => input.current?.click()}>
          {photo ? "다른 이미지 선택" : "이미지 파일 선택 +"}</button>
        <button ref={pasteTarget} type="button" className="photo-paste-target"
          aria-describedby="photo-paste-help" onClick={() => pasteTarget.current?.focus()}>
          이미지 붙여넣기 영역</button>
      </div>
    </div>
    <p id="photo-paste-help" className="field-help">붙여넣기 영역을 선택하고 Ctrl+V / ⌘V를 누르세요.
      PNG·JPEG·WebP·GIF·AVIF·BMP, 최대 20MB. 애니메이션은 한 프레임을 분석합니다.</p>
    <p className="photo-privacy">이미지는 이 브라우저에서만 처리합니다. 원본은 새로고침하면 사라지고, 생성한 색만 프로젝트에 저장됩니다.</p>
    <p className="photo-status" aria-live="polite">{busy ? "이미지를 읽고 대표색을 추출하고 있습니다…" :
      photo ? `${photo.source.image.filename} · ${photo.width} × ${photo.height} · 대표색 ${photo.colors.length}개` :
        "이미지를 추가하면 대표색을 추출합니다."}</p>
    {error && <p className="photo-error" role="alert">{error}{photo && " 이전 이미지와 추출색은 유지했습니다."}</p>}
    {photo && <>
      <div className="photo-result">
        <figure className="photo-preview"><img src={photo.url} alt="색을 추출한 원본 이미지" />
          <figcaption>{photo.source.image.filename}</figcaption></figure>
        <div className="photo-extraction">
          <div className="photo-extract-actions"><label>추출할 대표색
            <select aria-label="추출할 대표색" value={count} disabled={busy}
              onChange={e => setCount(Number(e.target.value))}>
              {Array.from({ length: 10 }, (_, i) => i + 3).map(n =>
                <option key={n} value={n}>{n}색</option>)}
            </select></label>
            <button type="button" disabled={busy} onClick={() => {
              const colors = extractImageColors(photo.pixels, count);
              setPhoto({ ...photo, colors });
              setError("");
              onColors(colors);
            }}>대표색 다시 추출</button>
          </div>
          <ol className="image-colors" aria-label="이미지 대표색">
            {photo.colors.map(color => <li key={color.hex}>
              <i style={{ background: color.hex }} aria-hidden="true" />
              <code>{color.hex}</code><span>{(color.share * 100).toFixed(1)}%</span>
            </li>)}
          </ol>
          <p className="field-help">비율은 축소 이미지의 색 묶음 기준 근사치입니다. 투명 픽셀은 제외합니다.
            {photo.colors.length < count && ` 구별되는 색이 적어 ${photo.colors.length}개를 추출했습니다.`}
            다시 추출하면 아래 입력색과 고정 설정을 초기화합니다.</p>
          <button type="button" onClick={() => {
            loadId.current++;
            if (url.current) URL.revokeObjectURL(url.current);
            url.current = null;
            setPhoto(null);
            setError("");
            setBusy(false);
          }}>이미지 제거</button>
        </div>
      </div>
      <fieldset className="photo-generation" disabled={busy}>
        <legend>추출색으로 팔레트 만들기</legend>
        <SeedFields value={value} onChange={onChange} />
        <StudioSettings value={value} onChange={onChange} />
        <button type="button" className="primary-action" disabled={!value.anchors.length}
          onClick={() => onGenerate(photo.source)}>이미지 색으로 후보 만들기 <span>↗</span></button>
      </fieldset>
    </>}
  </div>;
}
