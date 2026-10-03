# Colors v0.2.0 고도화 검증

날짜: 2026-10-04. 기준 명세 design-2026-10-04-b. 실제 모델/effort 확인 불가.
독립 1차 입력 implementation-a, 수정 확인 b/c는 reviews manifest와 원본 보고서 참조.

## 관측 결과

- 최종 소스 `pnpm test`: 4개 파일, 27개 통과.
- `pnpm test:e2e`: Chromium 데스크톱 + iPhone 13 WebKit 각각 8개, 총 16개 통과.
- `pnpm build`: TypeScript와 Vite 빌드 통과. JS 약 361kB, gzip 약 114kB.
- 소스/테스트/README/package의 `git diff 60f06e3 HEAD --check` 통과. 원본 검토 Markdown의 두 공백 줄바꿈과 원문 말미 빈 줄은 유지했다. Node 24.21.0, 실행 pnpm 11.19.0; 프로젝트의 지정 pnpm은 10.34.5.
- 실제 in-app 브라우저에서 두 입력색/고정·유연 추천/원색 차이 표시와 데스크톱 레이아웃을 확인했다.
- 한 번의 모바일 다운로드 테스트 실패는 실행 중 App 훅 수정으로 HMR이 프로젝트
  상태를 초기화한 실행이었다. 수정 중인 실행을 통과로 세지 않았고 소스 고정 후 전체 16개를 다시 통과했다.
- 마지막 c 변경은 순수 엔진의 무채색 자동 색 방향 경계와 고정 목표색 안내이며 단위/빌드를 재실행했다.

| 요구 | 검증 근거와 결과 |
| --- | --- |
| R01/R02 | 입력 1/5/8/12·duplicate ID·생성색 잠금·30회 원색 기준 한계, 전후/복원 E2E 통과 |
| R03 | 복수 moods/useCases, 고정 회피 경고, anchored warm/cool, 현재 직접 편집 회피 경고 통과 |
| R04 | 레시피 16개 exact HEX 정적 대조, 6종 우선/전체 노출, 레시피 생성 E2E 통과 |
| R05/R08 | 무채색 단색/tetradic 4축, 테마별 모든 자동 역할 대비, 5고정+1생성 주변 C 감소 단위 통과 |
| R06/R07 | CSS 색 파싱/좌표 D50·단위 표기, 표색계 변경·JSON/reload 유지 E2E, 혼합 4모델 끝점/차이 단위 통과 |
| R09/R10 | L/Y 구분, value 보기, 면적 조작/시안 정적·시각 검수; 5용도 UI와 코드언어/ANSI E2E 통과 |
| R11 | 실제 roleContrastPairs의 자동 대비 단위, 수동 연결 보존, 현재 역할/포커스 버튼 E2E 통과 |
| R12 | off-grid t exact·모든 ID CSV표본, 단조 역전/충돌 차단/발산중심/순환끝점 단위 및 브라우저 충돌 출력 통과 |
| R13/R15 | scene 자체 필수 데이터/정규화/복원·중복ID, schema1 이행/삭제백업, 즉시 저장 후 reload E2E 통과 |
| R14 | DTCG/CSS/Tailwind 색값, ASE 독립 decoder, Office XML DOMParser 12색, 대상 JSON 키, SVG/CSV/sequence CSS, float 33³ LUT 순서/identity 검사 통과 |
| R16 | 고유 ID별 접근 이름, 생성 후 heading focus, 키보드/좁은 폭 overflow E2E 통과; 모바일 캡처 검수 |
| R17 | 독립 설계/구현 리뷰·한정 재검증·수정 판정 완료, 프로덕션 배포와 핵심 6개 테스트 통과 |

## 출력 계약과 검증의 한계

ASE는 RGB 블록 binary, Office는 DrawingML clrScheme 12색 XML 조각,
VS Code는 색 테마 JSON, Windows Terminal은 색 구성 JSON이다. DTCG는 2025.10,
Tailwind는 v3 CJS/v4 CSS를 구분한다. 실제 Adobe/Office/영상 도구 import는 실행하지 않았다.
LUT는 full RGB encoded sRGB D65 창작 룩이며 33³, red-fastest 순서다.
팔레트의 고정색 포함 계약을 카메라 LOG 변환에 확대하지 않는다.

## 프로덕션

- 릴리스 소스 commit: `0cdbc2e096908f4eec17ac560c3a5967453401c6`, main push 완료.
- Vercel Git production: `dpl_9Xf21f9JMGMAQqNfVd3QqPFsAiEg`, READY, aliasError=null.
- 배포 주소: https://colors-kz6j9tntw-pydemia-7822.vercel.app
- 실제 도메인: https://colors.pydemia.ai, alias가 위 배포에 연결됨을 API로 확인.
- 도메인 HTML의 `/assets/index-DnDvdOQm.js`가 최종 로컬 빌드와 일치.
- 실제 브라우저: #336699 고정 + #E05566 유연으로 생성. 후보2 채택 시 유연색
  #E16E7B (화면 ΔEOK 0.0497), 재추천 생성만으로 이 값이 바뀌지 않았고 선택 표시가 해제됨.
- LAB D50, cyclic, linear RGB average, s1의 t=0.3, 장면1 저장 후 reload/재열기에서
  고정색·유연색·모델·위치·장면을 복원함. 실제 모바일 body/viewport 폭 모두375로 overflow 없음.
- 실제 도메인을 baseURL로 Chromium/WebKit에서 3개 핵심 흐름을 각각 실행해 6개 통과:
  다중 고정/유연·의도적 채택·JSON 내용/복원, 위치 충돌 출력 차단·Office XML12색,
  현재 회피색 경고·시안 focus·잘못된 장면 import 차단.
- in-app 브라우저의 다운로드 이벤트 대기는 도구 시간 제한에 걸려 통과로 세지 않았다.
  이후 실제 도메인 자동 브라우저 검증에서 다운로드 파일의 JSON/Office 내용을 직접 확인했다.
- in-app 브라우저 프로덕션 console error/warn 관측 없음.
- 캡처: screenshots/production-v0.2.0-desktop.jpg, screenshots/production-v0.2.0-mobile.jpg.
- 생산 테스트 재현: COLORS_TEST_BASE_URL=https://colors.pydemia.ai를 설정하고
  `pnpm exec playwright test --grep 'multiple fixed|recipe, off-grid|current avoidance'` 실행.

## 복구

Vercel에서 직전 READY production 배포를 재지정하면 이전 앱으로 복구할 수 있다.
schema2를 구버전이 읽을 수 없으므로 이행 전 원문을 colors.projects.v1.backup에
첫 저장/삭제 전 보존한다. 브라우저 전체 데이터 삭제는 백업도 지우므로
중요한 프로젝트는 JSON으로 받아 두어야 한다. 백업이 없으면 임의 데이터 복원을 주장하지 않는다.
schema2 JSON은 새 앱에서 복원하고, 구 앱에 필요한 schema1 원문은 백업 키의 원문을
colors.projects.v1에 복원한다. 자동 덮어쓰기·조용한 다운그레이드는 수행하지 않는다.
