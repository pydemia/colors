# Colors

Colors는 콘셉트나 기준색에서 시작해 다섯 가지 색을 만들고, 사용처별 역할과 시안을 살펴보는 웹 앱입니다.

사용 주소: [colors.pydemia.ai](https://colors.pydemia.ai)

## 실행

Node.js 22 이상과 pnpm을 사용합니다.

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

## 첫 공개 기능

- 콘셉트·HEX 기준색으로 팔레트 후보 세 가지 생성
- 색 잠금·편집·순서 변경, 사용처별 역할 연결과 개별 HEX 수정
- 웹사이트·화면용 발행물·PowerPoint·코드 편집기·터미널 모사 시안
- 전경과 배경의 대비 확인 및 사용자가 선택하는 역할색 수정안
- 브라우저 안 자동 저장과 프로젝트 JSON 가져오기·내보내기, CSS 변수 내보내기

프로젝트는 현재 브라우저의 `localStorage`에 저장됩니다. 브라우저 데이터를 지우거나 다른 기기에서 열면 보이지 않으므로 JSON으로 백업할 수 있습니다. JSON과 CSS에는 사진 파일이 포함되지 않습니다.

사진 업로드·다운로드·검색·추출과 파일 저장소는 메뉴에 `준비 중`으로 표시합니다. PowerPoint, VS Code, JetBrains, Vim, iTerm2, Windows Terminal, PuTTY의 전용 테마 파일은 실제 가져오기 검증을 마친 뒤 제공합니다. 현재 시안은 각 프로그램의 렌더링을 모사한 화면입니다.

기획 범위는 [.worknotes/RELEASE_SCOPE.md](.worknotes/RELEASE_SCOPE.md), 데이터 규칙은 [.worknotes/DATA_CONTRACT.md](.worknotes/DATA_CONTRACT.md), 검증 결과는 [.worknotes/QA_REPORT.md](.worknotes/QA_REPORT.md)에 기록합니다.
