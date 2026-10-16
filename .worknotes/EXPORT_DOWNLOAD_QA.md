# 색 파일 다운로드 고도화 v0.2.1

요청: CSS 변수와 프로그램별 색 파일을 생성해 내려받는 기능.
기준 코드: ec79fce. 기존 생성/고정/역할/저장 흐름을 유지한다.
사진 입력·클라우드 파일 저장소는 이번 변경 범위에 포함하지 않는다.

## 완료 기준

| 기준 | 구현·검증 |
| --- | --- |
| 현재 색 반영 | 원본색 CSS와 역할 override, 편집기/터미널 설정의 실제 색값 검사 |
| 형식 생성 | 문서화된 스키마/인코딩과 17가지 선택 형식, 생성 파일 미리보기·적용 안내 |
| 브라우저 다운로드 | 데스크톱 Chromium·모바일 WebKit에서 파일명·내용·XML·UTF-16·좁은 폭 검사 |
| 사이트 배포 | colors.pydemia.ai의 새 배포 SHA·asset와 실제 다운로드 흐름 확인 |

앞의 세 기준은 아래 명령·관측으로 확인했다. 배포 결과는 실제 관측 뒤 기록한다.
네 기준은 동일 가중치이며 구현·검증이 모두 끝난 항목만 완료로 센다.

## 변경

- 기존 CSS에 안정 ID별 `--colors-palette-sN` 추가, 역할 변수 이름 보존
- 기존 출력 11종 유지, 선택 목록에 CSS·VS Code 설정 조각·JetBrains·Vim·iTerm2·PuTTY 추가
- 미채택 후보가 아닌 현재 Project의 원본색/역할색으로 파일 생성
- 파일명, 프로그램 적용 안내·공식 링크, 선택적으로 생성하는 내용 미리보기 추가
- 텍스트 복사 추가, 복사 실패 시 파일 다운로드 안내
- ASE는 바이너리 앞부분, PuTTY는 UTF-16LE를 디코딩한 텍스트로 미리보기
- 큰 LUT 미리보기는 열었을 때 생성하고 화면은 100줄로 제한, 파일·복사 내용은 전체 유지
- 출력 버튼의 실제 CSS 충돌로 생긴 낮은 대비를 국소 수정, 계산된 전경/배경 대비 4.5:1 이상 검사

## 파일별 적용 범위

| 파일 | 출력·사용 방법 |
| --- | --- |
| colors-roles.css | 원본색 + 모든 사용처 역할 변수, CSS import 후 var() 사용 |
| colors-vscode-settings.json | 기존 settings.json에 workbench.colorCustomizations/editor.tokenColorCustomizations 병합 |
| colors-vscode.json | 테마 확장의 contributes.themes에서 참조, 설치용 VSIX 아님 |
| colors.icls | JetBrains Editor → Color Scheme → Import Scheme, IDE 전체 UI 테마 아님 |
| colors.vim | Vim/Neovim의 colors 디렉터리에 저장 후 :colorscheme colors |
| colors-terminal.json | Windows Terminal settings.json의 schemes 배열에 추가 후 프로필 colorScheme 지정 |
| colors.itermcolors | iTerm2 Profiles → Colors → Color Presets → Import |
| colors-putty.reg | UTF-16LE BOM·CRLF, HKCU의 PuTTY Sessions/Colors에 Colour0~21만 기록 |
| colors.clrScheme.xml | Office DrawingML 12색 구성, 전체 .thmx 패키지 아님 |

기존 토큰/Tailwind/SVG/ASE/CSV/LUT/장면 CSS는 같은 생성 함수를 계속 사용한다.
PuTTY의 같은 이름 세션은 색 설정이 갱신되며, 호스트·인증 설정을 출력하지 않는다.
Vim GUI/true color는 HEX, xterm-256은 ANSI 0~15의 사용자 설정 영향을 피한
16~255 고정 표에서 RGB 거리가 가장 가까운 근사색을 사용한다.

## 수행한 검사

- `pnpm test`: 5개 파일, 33개 통과. 마지막 1개는 설치된 Git for Windows의
  Vim을 -Nu NONE/-i NONE/--noplugin/-n/-es로 실행해 실제 색 구성 이름과
  Normal 전경/배경을 읽는 검사다. 사용자의 vimrc/viminfo는 변경하지 않는다.
- `pnpm build`: TypeScript + Vite 빌드 통과, JS gzip 약118kB.
- `pnpm test:e2e`: 기존 16개와 신규 다운로드 2개를 포함한 총18개 통과.
  최종 출력 버튼 대비 검사를 포함해 소스를 고정한 실행에서 확인했다.
- 신규 브라우저 검사는 CSS 원본/수동 역할, VS Code 설정, JetBrains XML,
  Vim 색, iTerm plist 23개 항목, PuTTY BOM·22색과 실제 다운로드 파일을 대조한다.
- 초기 Vim 검사의 Windows 경로 전달/HEX 대소문자 비교와 대비 검사의
  RGB→HEX 입력을 수정했다. 실패 실행을 통과로 계산하지 않는다.
- React 검토에서 기존 상태/저장 스키마 보존, 레이블·disabled·오류 안내,
  미리보기 지연 생성과 모바일 overflow를 확인했다.
- 작업 라우터의 Python 실행은 사용할 수 없어 지침의 local fallback으로
  현재 에이전트에서 처리했다. 모델·effort의 실제 metadata는 확인 불가다.

JetBrains·iTerm2·PuTTY·Office·Adobe·VS Code GUI의 실제 가져오기는 실행하지
않았다. 구조·색값·다운로드 검사를 각 제품의 전체 호환성 인증으로 바꾸지 않는다.
PuTTY .reg를 현재 사용자 registry에 적용하지 않았다.

## 근거

- [JetBrains import](https://www.jetbrains.com/help/idea/configuring-colors-and-fonts.html)
- [JetBrains 일반 속성](https://plugins.jetbrains.com/docs/intellij/color-scheme-management.html)
- [JetBrains 기본 색 구성 원문](https://github.com/JetBrains/intellij-community/blob/master/platform/platform-resources/src/DefaultColorSchemesManager.xml)
- [VS Code 색 테마](https://code.visualstudio.com/api/extension-guides/color-theme)
- [iTerm 색 구성](https://iterm2.com/documentation-preferences-profiles-colors.html)
- [iTerm plist 원문](https://github.com/gnachman/iTerm2/blob/master/plists/ColorPresets.plist)
- [Vim 기본 색 구성](https://github.com/vim/vim/blob/master/runtime/colors/default.vim)
- [PuTTY 설정](https://the.earth.li/~sgtatham/putty/latest/htmldoc/Chapter4.html#config-colours)
- [PuTTY 0.85 원본 배포](https://the.earth.li/~sgtatham/putty/0.85/putty-0.85.tar.gz): settings.c의 Colour0~21/RGB 저장과 기본 ANSI 순서 대조

## 출시 기록

배포 대기.
