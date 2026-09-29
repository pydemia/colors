# Colors 제품 기획

상태: 기획 초안 · 2026-09-29

## 목표와 확정 요구

Colors는 기준색, 콘셉트, 사진에서 팔레트를 만들고 실제 사용처에 맞게
색의 역할을 배정하는 웹 도구다. 사용자는 결과를 사이트, 발행물,
PowerPoint, 코드 편집기, 터미널에서 미리 보고 가져갈 수 있어야 한다.

사용자가 요청한 범위는 다음과 같다.

- 테마와 추구하는 콘셉트에 따른 팔레트 생성
- 한 색상에서 단색, 유사색, 보색, 분할 보색, 삼각 배색 등 조화 유형 선택
- 사진 업로드와 인터넷에서 찾은 사진을 통한 팔레트 추출
- 사진의 지점을 직접 골라 색을 추출하고 자동 추출 결과를 수정
- 사이트, 발행물, PowerPoint의 색조와 색상 조합 설계
- VS Code, JetBrains IDE, Vim의 구문 강조 색상 설계
- iTerm2, Windows Terminal, PuTTY의 터미널 색상 설계
- 웹사이트에 게시하여 브라우저에서 사용

위 목록은 제품 범위다. 첫 공개 버전에 모두 포함할지와 출시 순서는
아직 정하지 않았다.

## 참고 제품과 적용 판단

| 참고 | 확인한 동작 | Colors에 반영할 점 |
| --- | --- | --- |
| Adobe Color | 색상환, 조화 유형, 사진 추출, 선택점 조정, 대비 확인 | 생성 규칙을 보여 주고 추출한 색을 직접 조정 |
| Coolors | 색상 고정·재생성, 사진 추출, 시안 미리보기 | 고정색을 보존하며 여러 후보를 빠르게 비교 |
| Realtime Colors | 텍스트·배경·주·보조·강조색을 실제 웹 화면에 배치 | HEX 목록 외에 역할별 실사용 미리보기 |

참고 자료:
[Adobe Color](https://color.adobe.com/kr/create/color-wheel),
[Adobe 이미지 추출](https://color.adobe.com/create/image),
[Coolors](https://coolors.co/),
[Realtime Colors](https://www.realtimecolors.com/).

Adobe의 프롬프트 자료는 색의 이름만이 아니라 비중, 배치, 분위기,
스타일을 명시하라고 안내한다. 이를 콘셉트 입력 항목에 반영한다.
프롬프트별 생성 결과를 실제로 비교한 실험은 아직 하지 않았다.
참고: [Adobe 프롬프트 자료](https://www.adobe.com/products/firefly/features/ai-art-generator/composition-with-red-blue-and-yellow.html).

## 사용자 흐름 제안

세 가지 시작 경로를 같은 편집 화면으로 모은다.

1. 콘셉트: 사용처, 분위기, 명도, 채도, 피할 색을 입력한다.
2. 기준색: HEX 또는 색상 선택기로 입력하고 조화 유형을 고른다.
3. 사진: 업로드하거나 검색 결과를 선택한다. 자동 추출 색과
   사용자가 찍은 지점의 색을 함께 편집한다.

이후 후보 팔레트 비교 → 색상 고정·교체·순서 조정 → 용도별 역할 배정
→ 시안·대비 확인 → 저장·공유·내보내기 순서로 진행한다. 사진의
자동 추출색과 직접 고른 색은 출처를 구분해서 표시한다.

사진 URL을 불러올 수 없는 경우를 빈 팔레트로 처리하지 않는다.
접근 실패, 허용되지 않은 형식, 이미지 해독 실패를 구분해 안내한다.
인터넷 이미지 검색의 제공처, 이용 조건, 원본 보관 정책은 미정이다.

## 팔레트와 생성 규칙 제안

원본 팔레트에는 사용자가 입력하거나 고정한 색, 추출 출처,
조화 유형, 조정 이력을 남긴다. 사이트·문서·코드·터미널의
역할 색상은 원본에서 파생한다. 파생색을 바꿔도 원본의 고정색이
조용히 바뀌지 않도록 한다.

- 조화 유형: 단색, 유사색, 보색, 분할 보색, 삼각, 사각 배색
- 명도·채도 조정: OKLCH 기반 후보를 만들되 출력 색역을 확인
- 후보 정렬: 동일 입력에 안정적인 순서를 사용하고 동점 기준을 명시
- 충돌 검사: 비슷해서 구분하기 어려운 색과 낮은 대비를 표시
- AI의 역할: 자유 문장에서 조건을 추출하거나 후보 설명을 돕는
  방안을 검토한다. 최종 HEX 값은 사용자가 확인·수정할 수 있어야 한다.

색상 수, 조화 각도, 평가 가중치, 생성 모델 사용 여부는 실험 후
정한다. 검증되지 않은 생성 품질을 보장하지 않는다.

## 용도별 색상 역할

| 용도 | 필요한 역할과 미리보기 |
| --- | --- |
| 웹사이트 | 텍스트, 배경, 주·보조·강조색, 링크, 상태색; 실제 페이지 시안 |
| 문서·PowerPoint | 텍스트·배경·강조·하이퍼링크; 표·도형·슬라이드 시안 |
| 발행물 | 표지·본문·강조색; 인쇄를 요구하면 출력 조건별 색상 검토 |
| 코드 편집기 | 배경, 기본 텍스트, 주석, 키워드, 문자열, 수, 타입, 함수, 변수, 오류, 경고, 선택 영역 |
| 터미널 | 전경·배경, 커서·선택 영역, ANSI 기본 8색과 밝은 8색 |

PowerPoint 테마에는 텍스트·배경 4색, 강조 6색, 하이퍼링크
2색이 있다.
[Microsoft PowerPoint 문서](https://support.microsoft.com/en-us/powerpoint/create-your-own-theme-in-powerpoint).

iTerm2·Windows Terminal·PuTTY는 터미널 색상을 설정한다. Vim의
구문 강조는 Vim 색상 설정과 터미널의 색상 처리 능력에 따라
보이는 결과가 달라질 수 있다. 따라서 터미널 시안에는 Vim 실행
예시와 ANSI 색상표를 함께 둔다.

인쇄 결과는 화면의 HEX만으로 보장하지 않는다. 인쇄 출력까지
제공하려면 대상 인쇄 조건과 ICC 프로파일을 정해야 한다.
[Adobe 색상 관리 문서](https://helpx.adobe.com/photoshop/using/color-managing-documents--printing.html).

## 내보내기 목표

| 대상 | 계획한 결과물 | 확정 전 확인 |
| --- | --- | --- |
| 범용 | 팔레트 JSON, CSS 변수 | 저장 데이터 버전과 역할 이름 |
| PowerPoint | Office 테마 색상 파일 | 대상 버전에서 가져오기 |
| VS Code | 색상·구문 토큰 테마 JSON | 토큰·semantic token 적용 |
| JetBrains | .icls 편집기 color scheme | IDE별 가져오기; 창 전체 테마와 구분 |
| Vim | colors/<이름>.vim | highlight group, truecolor·제한 색상 대응 |
| iTerm2 | .itermcolors | 프로필 가져오기와 모드별 색상 |
| Windows Terminal | settings.json용 color scheme | 기존 설정을 덮지 않는 적용 절차 |
| PuTTY | 세션별 RGB 설정 안내 | 가져오기 파일은 실제 세션에서 검증 후 확정 |

형식 참고:
[VS Code](https://code.visualstudio.com/api/extension-guides/color-theme),
[JetBrains](https://www.jetbrains.com/help/idea/configuring-colors-and-fonts.html),
[Vim](https://vimhelp.org/syntax.txt.html),
[iTerm2](https://iterm2.com/documentation-preferences-profiles-colors.html),
[Windows Terminal](https://learn.microsoft.com/en-us/windows/terminal/customize-settings/color-schemes),
[PuTTY](https://the.earth.li/~sgtatham/putty/0.84/htmldoc/Chapter4.html#config-colours).

## 품질과 검증 기준

- 고정한 기준색은 생성·역할 배정·내보내기 과정에서 정확히 유지한다.
- 자동 추출색, 직접 찍은 색, 생성한 색의 출처를 구분한다.
- 텍스트와 실제 배경의 대비를 계산하고 미달 조합을 표시한다.
  웹의 일반 텍스트 WCAG AA 기준은 4.5:1이다.
- 색각 차이를 고려한 미리보기와 색상 외 구분 수단을 검토한다.
- 사용자 파일은 형식 검사뿐 아니라 대상 프로그램에서 가져와 확인한다.
- 인터넷 사진의 접근 실패나 권한 문제를 명시하고 임의 색상으로
  성공한 듯 대체하지 않는다.
- 같은 입력·설정에서 순서가 안정적인 후보를 생성한다. AI를 사용해
  비결정성이 생긴다면 그 경계를 사용자에게 드러낸다.

접근성 참고:
[WCAG 2.2](https://www.w3.org/TR/wcag/).

## 리뷰 결과와 미결정 사항

방향과 대상 범위는 확인했다. 아래 결정을 끝내고 결과물 가져오기
검증을 해야 구현 가능한 상세 명세가 된다.

1. 첫 공개 버전의 기능·출력 범위와 이후 출시 순서
2. 원본 팔레트와 용도별 파생색의 저장·수정 규칙
3. 콘셉트 입력 항목, 프롬프트 평가 사례, 생성 방식
4. 이미지 검색 제공처·이용 조건·원본 보관 기간
5. 로그인, 비공개 저장, 공개 링크, 갤러리 제공 범위
6. 대비 미달 시 경고·수정 제안·자동 조정 중 허용할 동작
7. 발행물의 화면용 색상과 인쇄용 색상 관리 범위
8. PuTTY 적용 파일을 포함한 내보내기 형식·지원 버전
9. 호스팅, 도메인, 이미지 처리·데이터 저장 위치

실제 구현, UI 시안, 프롬프트 비교 실험, 파일 가져오기 검증,
사이트 게시·배포는 아직 하지 않았다.
