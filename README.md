# Colors

Colors는 콘셉트, 이야기 레시피, 하나 이상의 입력색에서 시작해 팔레트와 colormap을 만들고 사용처별 역할·시안을 검증하는 웹 앱입니다.

사용 주소: [colors.pydemia.ai](https://colors.pydemia.ai)

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
- 색별 고정 checkbox 및 원색 기준 ΔEOK/L/C/H 한계 안의 유연 보정·되돌리기
- Light/Dark, 의도·배색 구조, OKLCH/HSL/HSV/RYB 근사 색상환과 좌표 편집
- Warm/Cool·Tint, 명도·대비·주변 채도와 영화/포스터/공간/소재 디지털 시안
- 범주/순차/발산/순환 colormap, 색과 위치의 독립 잠금, 가색/감색 근사 선택
- 색 잠금·편집·순서 변경, 사용처별 역할 연결과 개별 HEX 수정
- 웹사이트·화면용 발행물·PowerPoint·코드 편집기·터미널 모사 시안
- 전경과 배경의 대비 확인 및 사용자가 선택하는 역할색 수정안
- 최대 5개 장면, 기기 자동 저장과 schema1/2 JSON 가져오기·복원
- CSS/DTCG 토큰/Tailwind 3·4/SVG/ASE/Office 색 구성 XML/VS Code/Windows Terminal/colormap CSV/33³ LUT 출력

추천 설정과 새 후보 생성은 초안이며, 후보 카드를 선택할 때 현재 결과에 적용합니다. 출력은 현재 채택된 프로젝트를 사용합니다. 고정색은 정확한 HEX를 유지하고, 유연색은 반복 추천에도 최초 입력색을 기준으로 제한합니다.

프로젝트는 현재 브라우저의 `localStorage`에 저장됩니다. 브라우저 데이터를 지우거나 다른 기기에서 열면 보이지 않으므로 JSON으로 백업할 수 있습니다. JSON과 CSS에는 사진 파일이 포함되지 않습니다.

사진 업로드·검색·추출은 `준비 중`입니다. 소재/RYB/감색은 디지털 근사이며 ICC 인쇄·물리적 안료·색온도 측정 기능은 제공하지 않습니다. 프로그램 시안은 모사 화면입니다. Office 출력은 12색 DrawingML 조각이며 `.thmx`가 아닙니다. ASE/Office/영상 도구의 실제 가져오기는 아직 검증하지 않았고, 파일 구조와 색값을 검사했습니다. LUT는 encoded sRGB D65 전체 RGB 룩 변환이며 카메라 LOG용 LUT가 아닙니다.

현재 명세는 [.worknotes/UPGRADE_SPEC.md](.worknotes/UPGRADE_SPEC.md), 검토 판정은 [.worknotes/reviews/DECISIONS.md](.worknotes/reviews/DECISIONS.md), 고도화 검증은 [.worknotes/UPGRADE_QA.md](.worknotes/UPGRADE_QA.md)에 기록합니다. 기존 RELEASE_SCOPE/DATA_CONTRACT/QA_REPORT는 v0.1.0 기록입니다.
