# 이미지에서 팔레트 생성 v0.3.0

요청: 사진 또는 클립보드 이미지로부터 colormap을 생성하고 기존 편집·출력과 연결.
기준 코드: `9e803b7`. 서버 이전·Blob Storage·업로드 API 없이 브라우저에서 처리.

## 완료 기준

| 동일 가중치 기준 | 확인 방법 |
| --- | --- |
| 이미지 입력 | 파일 선택, drop/paste 이벤트, 오류 후 이전 이미지 보존·재시도 |
| 대표색 추출 | 결정적 OKLab 분할, 실제 표본색, 비중·투명·단색·형식·크기 검사 |
| 기존 흐름 연결 | 고정/유연색, 후보 채택, 출처·색값 저장/복원, JSON/CSS 다운로드 |
| 화면·회귀 검증 | 데스크톱 Chromium·모바일 WebKit, 폭·키보드·실제 배포 흐름 |

이미지 생성 범위의 완료 기준 4/4(100%). 아래 실행 결과와 실제 배포로 확인.
OS 앱별 클립보드 형식과 모든 이미지 포맷·프로파일의 인증을 뜻하지 않음.

## 처리와 상태

- 이미지 파일 선택·드롭은 `acquisition: upload`, 이미지 paste는 `clipboard`.
  schema2 구조를 유지하고 photo 출처의 acquisition 허용값에 clipboard 추가.
- 사진 작업 영역은 시작 탭을 바꿔도 마운트를 유지해 이미지 미리보기를 보존.
- HTMLImageElement.decode → 긴 변 256px 이하 Canvas → sRGB RGBA 표본.
  브라우저 디코더가 프로파일·방향을 처리하며 EXIF/ICC를 따로 구현하지 않음.
- 기본 대표색 5개, 3~12개 선택. 알파 가중 histogram을 OKLab에서
  결정적 초기 중심·최대 12회 가중 군집화로 나누고 중심에 가까운 실제 HEX 선택.
  ΔEOK 0.025 미만의 비슷한 색을 합쳐 JPEG 노이즈의 중복 대표색을 억제.
  동률 순서 고정, 투명 픽셀 제외, 구별되는 색이 적으면 적은 개수로 안내.
- 추출색은 기본 고정. 고정을 끄면 기존 원색 기준 ΔEOK/L/C/H 한계 적용.
  다시 추출할 때 입력색·고정 설정 초기화를 화면에 안내.
- source에는 ID·파일명·입력 경로, swatch에는 autoExtracted·imageSourceId 기록.
  JSON/localStorage에는 URL·원본·base64·축소 픽셀을 기록하지 않음.
- 새 파일 선택·제거·unmount는 이전 object URL을 해제. 비동기 완료 순서가
  바뀌면 마지막 선택만 수용하고 폐기된 디코딩 결과의 URL도 해제.
- PNG/JPEG/WebP/GIF/AVIF/BMP 중 브라우저가 디코딩할 수 있는 형식,
  20MB·6,400만 픽셀 제한. HEIC/SVG는 PNG/JPEG 변환 안내.
- 입력 오류는 이전 정상 이미지·색을 유지. 투명 이미지나 디코딩 실패를
  정상 팔레트로 대체하지 않음. 애니메이션은 분석 시점의 한 프레임 사용.

## 검증

- 단위 검사는 비중·알파·결정성·실제 표본·단색·오류·크기·photo 복원/재생성,
  압축 노이즈와 작은 대비색의 보존을 확인.
- 최종 `pnpm test`: 6개 파일, 40개 통과.
- 최종 `pnpm test:e2e`: 데스크톱·모바일 총22개 통과(41.0초).
- 신규 브라우저 검사 4개 통과. PNG 실제 디코딩 → 3/5색 재추출 → 고정/유연색
  → 후보 채택 → JSON/CSS 파일 → 새로고침/가져오기 복원 확인.
- paste/drop은 브라우저의 실제 DataTransfer/File을 담은 합성 이벤트로 검사.
  OS 클립보드 앱별 이미지 형식과 모든 모바일 붙여넣기 UI를 인증하지 않음.
- 손상 PNG·완전 투명 PNG·SVG 오류와 정상 파일 재시도 확인.
- 이미지 처리부터 다운로드·복원까지 POST/PUT/PATCH 전송 요청 0개 관측.
- `pnpm build`: TypeScript·Vite 빌드 통과. JS gzip 약121kB.
- 초기 대표색 선택 검사는 label의 option 텍스트 포함으로 exact 조회가 실패.
  select의 명시적 접근성 이름을 추가한 뒤 신규 4개 검사를 통과.
- 기존 TS/TSX 형식을 보존. 새 의존성·인증·환경변수·원격 저장소 추가 없음.
- React 검토: 비동기 요청 ID·cleanup, 원본 메모리 수명, 함수형 상태 갱신,
  hidden file input의 중복 Tab 정지 제거, label·fieldset·live/alert 유지 확인.
- Edge의 파일 선택 버튼으로 동봉 JPEG(800×500)를 실제 디코딩·추출.
  붙여넣기 영역 → Tab → 대표색 선택으로 키보드 이동 확인. 가로 overflow 없음,
  관측된 warning/error console 기록 0개. 모바일 PNG 결과 화면 별도 검토.
- router helper는 Python 실행 실패로 local fallback 적용. 현재 모델·effort
  metadata는 unavailable. 기존 다른 요청의 reviewer agent는 재사용하지 않음.

JPEG 수동 검토에서 압축 노이즈가 비슷한 대표색 두 칸을 차지하는 것을 관측.
초기 분할을 최소 지각 거리와 가중 군집화로 보완해 작은 대비색을 보존하고
유사색 중복을 줄였다.

## 근거

- [브라우저 이미지 디코딩](https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/decode)
- [paste 이벤트 데이터](https://developer.mozilla.org/en-US/docs/Web/API/ClipboardEvent/clipboardData)
- [Canvas 픽셀 읽기](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/getImageData)

## 출시 기록

- 기능 코드 SHA: `61c169e3dc44faffb3e3f34fc72f597277657b55`.
- Vercel 배포 `dpl_2Ho2w3SqJBRNRKixJHVBzxGgd8tj`: READY, 해당 SHA 일치.
- 배포 URL: `colors-ga2b5mxyi-pydemia-7822.vercel.app`.
- `colors.pydemia.ai` alias 적용·aliasError 없음 확인.
- 실제 도메인 JS `/assets/index-B2dyOGW3.js`와 CSS
  `/assets/index-DC5DmbRs.css`가 검증한 로컬 빌드와 일치.
- 실제 도메인 대상 이미지 생성 검사: 데스크톱·모바일 4개 통과(8.9초).
  파일 선택·paste/drop 이벤트·고정/유연색·채택·저장/복원·CSS 다운로드 확인.
- Edge 실제 도메인에서 동봉 JPEG를 파일 선택 버튼으로 읽어 5색 추출 확인.
  warning/error console 기록 0개.
- [배포된 이미지 추출 화면](screenshots/production-v0.3.0-image.jpg).
- 후속 검증 기록·증빙 커밋은 런타임 코드를 변경하지 않음.
