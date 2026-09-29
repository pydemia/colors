# Colors v0.1.0 QA 기록

작성일: 2026-09-30

## 확인한 사실

- `pnpm build`: TypeScript 검사와 Vite 프로덕션 빌드 통과.
- `pnpm test`: 색 생성·대비·잠금·출처·역할 참조·JSON/CSS·저장소 관련 9개 통과.
- `pnpm test:e2e`: 데스크톱 Chromium과 모바일 WebKit에서 각 5개, 총 10개 통과. 콘셉트 생성, 후보와 사용처 시안, TypeScript·Python 구문 시안, ANSI 16색, JSON/CSS 다운로드 내용, 예제 JSON 가져오기, 잠긴 기준색의 후보 교체·재생성, 브라우저 저장·재열기, 사진 비활성 메뉴, 입력 오류 안내를 확인했다.
- 데스크톱에서 키보드 Tab 이동을 확인했다. 모바일 WebKit 테스트 환경에서는 화면 폭·조작 흐름을 확인했다.
- 데스크톱·모바일 화면 캡처를 눈으로 검토했다. 모바일에서 요소가 한 열로 배치되고 가로 스크롤이 생기지 않음을 확인했다.
- `.worknotes/examples/locked-base-color.json`은 앱의 가져오기 함수로 읽히며 이전 예제의 누락된 `generationIndex`는 0으로 보정된다.

## 코드 리뷰에서 수정한 점

- 가져온 프로젝트의 출처·생성 순서·다섯 색 ID·역할 참조를 검증하여 잘못된 JSON이 후속 편집을 깨뜨리지 않게 했다.
- 잠긴 색은 후보 교체와 재생성에서 유지하고, 사용자가 수정한 역할색도 보존한다.
- 모바일에서 알림이 화면을 계속 가리는 문제를 발견해 5초 후 닫히도록 했다.
- 코드 편집기 시안에서 TypeScript와 Python을 선택해 구문 역할을 비교할 수 있게 했다.

## 미검증·후속 작업

- 프롬프트 결과의 품질 비교 실험을 하지 않았다. 콘셉트 생성은 현재 결정적 규칙이다.
- PowerPoint·VS Code·JetBrains·Vim·iTerm2·Windows Terminal·PuTTY에서 전용 파일 가져오기, 실제 화면, 되돌리기를 검증하지 않았다. 앱은 전용 파일 다운로드를 제공하지 않는다.
- 사진 파일 업로드·다운로드·저장소·검색·추출은 구현하지 않았다. 사진 출처 데이터 구조는 후속 확장 자리다.
- 인쇄용 CMYK·ICC와 실제 인쇄 결과는 검증하지 않았다. 발행물 시안은 화면용이다.

## 프로덕션 배포 확인

- GitHub Release: [Colors v0.1.0](https://github.com/pydemia/colors/releases/tag/v0.1.0). 태그는 병합 커밋 `0e8045f3`을 가리킨다.
- Vercel 프로젝트: `pydemia-7822/colors`, 배포 ID `dpl_3SJRpd3YqwJjCDZhM6j7omk7v9DP`.
- 공개 주소: https://colors-coral-six.vercel.app. 직접 HTTP 요청에서 200과 앱 제목을 확인했다.
- Vercel 원격 빌드는 Node.js 24.x, pnpm 10.34.5, `pnpm build`를 사용해 통과했고 배포는 `production / Ready`로 확인했다.
- 같은 공개 주소에서 Playwright 10개를 다시 실행해 데스크톱 Chromium·모바일 WebKit의 주요 흐름을 모두 통과했다. 이 검증은 브라우저 모사 시안과 앱의 저장·파일 흐름에 관한 것이며 대상 프로그램에서 전용 파일을 가져온 결과가 아니다.
