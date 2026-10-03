# 엔진 지적 한정 재검증 — implementation-b / c

2026-10-04. 이전 독립 보고서 `implementation-engine.md`의 IE1·IE2·IE3만 재검증했다. 다른 reviewer 결과와 현재 작업 소스는 읽지 않았고, 원본·소스를 수정하지 않았다. 모델 설정을 유지했으며 실제 모델·effort metadata는 확인 불가다.

## 고정 입력과 실제 수행

- b snapshot: `C:/Users/pydemia/AppData/Local/Temp/colors-implementation-b`, manifest `.worknotes/reviews/implementation-b-manifest.json`.
- b 명세 `UPGRADE_SPEC.md`: design-2026-10-04-b, SHA256 `C2A534D4DFE27BB4A6D365B39A108C04874655010A9D89C3A00CE61922FA86D5`.
- b `src/lib/project.ts`: SHA256 `A0D118F7F59FDCA30A1BB0B5F904C253281E39489FE175A01C78F0966B35DB90`.
- b `src/lib/studio.ts`: SHA256 `6601B5780A973AF9491AF9E457F189237DF6545A19D69A7A9DD0E32AAE71B4CA`.
- c snapshot: `C:/Users/pydemia/AppData/Local/Temp/colors-implementation-c`.
- c `src/lib/studio.ts`: SHA256 `52D4A7D3BE26CA56C23AB822EF8F3E6C9318BB89A0185F6172D2FDD2EE112D7E`.

hash는 각 snapshot에서 다시 확인했다. b의 관련 함수 및 c의 neutral 보정 한 줄을 읽고 Node `stripTypeScriptTypes`로 snapshot 모듈을 메모리에서만 변환하여 최소 순수 함수 probe를 실행했다. c에서는 IE2의 회색 monochromatic + warm/cool 경계만 재probe했다. 전체 단위/e2e/build 또는 브라우저를 실행하지 않았다.

## 지적별 판정

| 지적 | b 결과 | c에서 추가 수행 | 최종 판정 |
| --- | --- | --- | --- |
| IE1 장면 필드 누락 허용 | 필드 누락 거절 및 자체 데이터 정규화 확인 | 없음 | 해결 — b의 한정 검증 근거 |
| IE2 앵커가 있으면 warm/cool 무효 | 유채색 앵커는 해결, 회색 monochromatic 경계 발견 | 회색 + warm/cool 각각 재probe | 해결 — 유채색은 b, 무채색 경계는 c 근거 |
| IE3 배열 슬롯에 묶인 주변 채도 | 생성색 전체 적용 및 입력 개수별 효과 확인 | 없음 | 해결 — b의 한정 검증 근거 |

### IE1 — 해결

b `project.ts:723–731`은 scene 자체의 swatches/roleSets/studio를 요구하고, 부모와 병합할 때 허용된 세 필드만 사용한다. 재귀 검증의 정규화 결과를 scene에 저장한다.

실제 probe:

1. 완전한 장면에서 swatches, roleSets, studio를 각각 하나씩 삭제한 세 입력과 세 필드를 모두 삭제한 입력을 `parseProject`가 거절했다.
2. 정상 장면의 swatch HEX, anchor originalHex 및 역할 override HEX를 소문자로 넣어 import했다. 반환 scene의 세 HEX가 대문자로 정규화되었다.
3. 해당 정상 장면의 sequence CSS에 `.colors-scene-1` 선택자가 출력되는 것을 확인했다.

이전처럼 부모 snapshot을 물려받아 필수 누락을 가리는 실패는 재현되지 않았다. 브라우저 렌더링 자체를 재실행한 것은 아니다.

### IE2 — 해결, b에서 발견한 경계는 c에서 보완 확인

b `studio.ts:227–230,240–242,256–270`은 색 방향에 따라 창작 Warm/Cool 보정을 조정 가능한 색에 전달한다.

b의 실제 probe:

- `#336699` 한 개 고정, count=6에서 warm/cool 세 후보가 달랐고 모든 후보의 첫 색은 정확히 `#336699`였다. 첫 후보의 추가색은 warm `#E1F7F7/#0E0F25/#527598/#70ACBD/#F2F1F7`, cool `#E3F5FF/#10101E/#52759A/#6CACC3/#EEF1FF`였다.
- 같은 앵커를 유연색으로 바꾸되 maxDelta=0으로 설정했을 때 세 후보 모두 원색을 정확히 유지하고 withinBounds가 true였다.
- `#808080` + monochromatic + warm에서는 생성색 chroma가 최대 0.012356으로 올라갔다. 이전 보고서의 무채색 단색 유지 경계가 남아 조정자에게 전달했다. 이 관측을 b의 통과로 덮지 않는다.

c `studio.ts:229–230`은 neutral monochromatic이면 concept hueDirection에 의한 자동 Warm/Cool 추가량을 0으로 둔다. c의 해당 경계만 실제 재probe했다.

- warm과 cool 각각에서 세 후보의 모든 색이 C < 0.001이었다.
- 고정 원색 `#808080`가 두 방향의 모든 후보에서 정확히 보존되었다.
- 두 방향의 첫 후보는 `#808080/#F2F2F2/#121212/#717171/#A1A1A1/#E9E9E9`였다.

IE2의 원래 실패와 재검증 과정에서 드러난 무채색 경계가 모두 해결되었다. 사용자가 직접 설정한 별도의 Warm/Cool·Tint 조작 조합 전체를 이 한정 재검증에서 평가한 것은 아니다.

### IE3 — 해결

b `studio.ts:255–270`은 surroundingChroma를 모든 생성색의 generatedC에 곱하고, 암부 미색·중복 회피·회피색 재생성에도 그 generatedC를 유지한다.

실제 probe:

- 입력 `#336699/#E05566/#228866/#553388/#C69944` 다섯 개 고정, count=6에서 주변 채도를 1→0으로 바꿨다. 세 후보의 유일한 생성색 C는 각각 약 0.028295→0으로 감소했고 다섯 고정색은 그대로였다.
- 고정 입력 개수 1/3/5/8과 추가 생성색을 가진 프로젝트에서 같은 조작을 확인했다. 각 경우 첫 추가 생성색의 최종 chroma가 감소했다.

배열의 index % 3 때문에 조작이 무시되던 재현은 사라졌다. 모든 가능한 회피/중복/톤 조작 조합을 전체 탐색한 것은 아니다.

## 실행 근거의 한계

27 unit/16 e2e/build 통과와 c의 27 unit/build 통과는 조정자 제공 결과다. 이 reviewer의 실행 결과는 위 최소 probe와 snapshot 읽기/hash 확인이다. 새 전체 리뷰·외부 프로그램 import·프로덕션·브라우저 확인을 완료했다고 주장하지 않는다. IE1–IE3에 대한 한정 재검증에서 추가 잔존 지적은 없다.
