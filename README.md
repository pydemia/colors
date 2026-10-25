# Colors

Colors는 콘셉트, 사진·이미지, 이야기 레시피, 하나 이상의 입력색에서 시작해
팔레트와 colormap을 만들고 사용처별 역할·시안을 검증하는 웹 앱입니다.

사용 주소: [colors.pydemia.ai](https://colors.pydemia.ai)

운영은 pydemia-server의 Caddy 사용자 서비스와 Cloudflare Tunnel을 사용합니다.
배치·재시작·업데이트·복구 방법은 [온프레미스 배포](deploy/on-premise/README.md)에
있습니다. Vercel Git 자동 배포는 중지하고 기존 배포는 복구용으로 보존합니다.

## 실행

Node.js 24와 pnpm 10.34.5를 사용합니다.

```bash
pnpm install --frozen-lockfile
pnpm dev
```

```bash
pnpm build
pnpm test
pnpm test:e2e
```

브라우저 테스트를 처음 실행할 때는 `pnpm exec playwright install chromium webkit`으로 테스트 브라우저를 설치합니다.
`COLORS_TEST_BASE_URL`을 지정하면 로컬 서버를 시작하지 않고 해당 배포에서 같은 테스트를 실행합니다.

## 기능

- 1~12개 입력색에서 5~16색 후보 세 가지 생성, 16종 서사 레시피
- 이미지 파일 선택·드래그 앤 드롭·클립보드 이미지 붙여넣기와 3~12개 대표색 추출
- 색별 고정 checkbox 및 원색 기준 ΔEOK/L/C/H 한계 안의 유연 보정·되돌리기
- Light/Dark, 의도·배색 구조, OKLCH/HSL/HSV/RYB 근사 색상환과 좌표 편집
- Warm/Cool·Tint, 명도·대비·주변 채도와 영화/포스터/공간/소재 디지털 시안
- 범주/순차/발산/순환 colormap, 색과 위치의 독립 잠금, 가색/감색 근사 선택
- 색 잠금·편집·순서 변경, 사용처별 역할 연결과 개별 HEX 수정
- 웹사이트·화면용 발행물·PowerPoint·코드 편집기·터미널 모사 시안
- 전경과 배경의 대비 확인 및 사용자가 선택하는 역할색 수정안
- 최대 5개 장면, 기기 자동 저장과 schema1/2 JSON 가져오기·복원
- CSS/DTCG 토큰/Tailwind 3·4/SVG/ASE/Office 색 구성 XML/VS Code/JetBrains/Vim·Neovim/Windows Terminal/iTerm2/PuTTY/colormap CSV/33³ LUT 출력
- 내보내기 파일명·내용 미리보기·텍스트 복사·형식별 적용 안내

추천 설정과 새 후보 생성은 초안이며, 후보 카드를 선택할 때 현재 결과에 적용합니다. 출력은 현재 채택된 프로젝트를 사용합니다. 고정색은 정확한 HEX를 유지하고, 유연색은 반복 추천에도 최초 입력색을 기준으로 제한합니다.

프로젝트는 현재 브라우저의 `localStorage`에 저장됩니다. 브라우저 데이터를 지우거나 다른 기기에서 열면 보이지 않으므로 JSON으로 백업할 수 있습니다. JSON과 CSS에는 사진 파일이 포함되지 않습니다.

내보내기 파일은 브라우저에서 생성하며 별도 클라우드 파일 저장소를 사용하지
않습니다. CSS에는 `--colors-palette-s1` 같은 원본색과 사용처별 역할색이
함께 들어갑니다. VS Code는 설정 병합용 JSON과 확장 개발용 테마 JSON을
구분합니다. 적용 방법과 검사 범위는
[색 파일 다운로드 검증](.worknotes/EXPORT_DOWNLOAD_QA.md)에 기록합니다.

## 이미지에서 시작하기

`사진·이미지`에서 파일을 선택하거나 드롭합니다. 캡처한 이미지는
`이미지 붙여넣기 영역`을 선택하고 Ctrl+V / ⌘V로 붙여넣습니다.
PNG·JPEG·WebP·GIF·AVIF·BMP 중 브라우저가 읽을 수 있는 형식을 지원하며
20MB·6,400만 픽셀까지 받습니다. HEIC·SVG는 PNG나 JPEG로 변환합니다.

브라우저가 이미지를 디코딩해 긴 변 256px 이하의 sRGB Canvas로 분석합니다.
OKLab에서 색을 묶고 각 묶음의 실제 표본색과 알파 가중 비율을 출력합니다.
비슷한 색은 합쳐 JPEG 압축 노이즈가 대표색을 중복 차지하는 것을 줄입니다.
투명 픽셀은 제외하며, 색이 적으면 요청한 개수보다 적게 추출합니다.
애니메이션은 분석 시점의 한 프레임을 사용합니다. EXIF 방향과 색 프로파일
해석은 브라우저 디코더에 따르므로 원본 픽셀의 정밀 측정 도구는 아닙니다.

추출색은 기본적으로 고정합니다. 고정을 끄면 기존 원색 기준 보정 한계를
적용하며, 출력 색 개수·배색·화면 테마와 같은 설정을 사용할 수 있습니다.
`대표색 다시 추출`은 입력색과 고정 설정을 초기화합니다. 생성한 결과는
기존 프로젝트 저장·JSON 복원·CSS 및 프로그램별 색 파일 출력에 연결됩니다.

이미지 원본과 축소 픽셀은 브라우저 메모리에만 남고 서버에 전송하지
않습니다. 새로고침하면 이미지 미리보기는 사라지며, 저장된 프로젝트에는
추출색·고정 상태·파일명 등 출처 정보만 남습니다. Blob Storage나 별도
업로드 API는 사용하지 않습니다. 온라인 사진 검색과 원본 보관은 제공하지
않습니다. 검증 범위는 [이미지 생성 검증](.worknotes/IMAGE_PALETTE_QA.md)에
기록합니다.

소재/RYB/감색은 디지털 근사이며 ICC 인쇄·물리적 안료·색온도 측정 기능은 제공하지 않습니다. 프로그램 시안은 모사 화면입니다. Office 출력은 12색 DrawingML 조각이며 `.thmx`가 아닙니다. ASE/Office/영상 도구의 실제 가져오기는 아직 검증하지 않았고, 파일 구조와 색값을 검사했습니다. LUT는 encoded sRGB D65 전체 RGB 룩 변환이며 카메라 LOG용 LUT가 아닙니다.

현재 명세는 [.worknotes/UPGRADE_SPEC.md](.worknotes/UPGRADE_SPEC.md), 검토 판정은 [.worknotes/reviews/DECISIONS.md](.worknotes/reviews/DECISIONS.md), 고도화 검증은 [.worknotes/UPGRADE_QA.md](.worknotes/UPGRADE_QA.md)에 기록합니다. 기존 RELEASE_SCOPE/DATA_CONTRACT/QA_REPORT는 v0.1.0 기록입니다.
