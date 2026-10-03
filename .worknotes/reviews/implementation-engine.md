# 독립 구현 리뷰 — 엔진·파서·출력

기준 revision: `implementation-a`, 2026-10-04. 검토 원본은 `C:/Users/pydemia/AppData/Local/Temp/colors-implementation-a`의 고정 snapshot이다. 현재 작업 소스 및 다른 reviewer 결과는 읽지 않았다. 소스 수정 없음. `persona-cross-review` 절차를 적용하며 모델 설정을 유지했다. 실제 모델·effort metadata는 확인 불가다.

## 입력과 수행 범위

manifest: 저장소 `.worknotes/reviews/implementation-a-manifest.json`. 아래 hash를 고정 snapshot에서 다시 확인했다.

| snapshot 경로 | SHA256 | 읽은 범위 |
| --- | --- | --- |
| `UPGRADE_SPEC.md` | `C9FD50F342169759A139E2C1CD9C1D46C068F9197F339A22C3EEA72E4F7BF57D` | 이전 독립 검토에서 동일 원문 전체를 읽었고 hash 일치 확인 |
| `src/lib/studio.ts` | `7A8956DB499013F71C6EDA34B39B1876C6A33D6BBAE8BADD544821ACB6F00793` | 전체 |
| `src/lib/project.ts` | `CB299F9A4C33D048E6338D01D212910F4B8ED9E8535117655B8B217AF001C033` | 전체 |
| `src/lib/exports.ts` | `53A6B3E3992BAE3471F8A7E0EBE15B93A747F02DEAE008BA0B07BBE6198954CC` | 전체 |
| `src/components/StudioPanels.tsx` | `188DCF4150B3D97F8E269594D32F80F52C62411C7C20872630535473792303C0` | 엔진 호출 검색 및 112–258 / 296–340행 |

snapshot의 `studio.test.ts`, `project.test.ts`, `exports.test.ts`도 읽었다. 공통 요구사항은 위 명세 및 저장소 `.worknotes/COLOR_IMPROVEMENT_REVIEW.md`의 이전 검토와 동일한 원문이다. 이전 설계 리뷰의 추측을 구현 오류로 그대로 이월하지 않고 실제 보호 경로를 다시 확인했다.

관측 방법: Node의 `stripTypeScriptTypes`로 snapshot 모듈을 메모리에서만 변환해 `culori`를 사용하는 순수 함수를 호출했다. `recommend`, `createProject`, `parseProject`, `validateMap`의 최소 사례를 probe했다. 저장소 소스나 snapshot은 수정하지 않았다. 아래 관측은 이 probe의 결과이며, 전체 25개 단위 테스트·e2e·빌드·브라우저를 이 reviewer가 실행했다는 뜻이 아니다.

## 지적

### IE1 — 불완전한 장면을 import가 허용하여 렌더링 경로가 깨진다

- 중요도·요구: P1, 출시 전 수정. R13의 장면 복원 및 R15의 잘못된 입력 차단.
- 근거: `project.ts:715–720`. 장면은 id/name만 확인한 뒤 `parseProject({...value,...scene,sequence:[]})`로 검사한다. scene에 없는 swatches/roleSets/studio는 부모 프로젝트의 값으로 채워져 검사를 통과한다. 검증한 재귀 반환값도 저장하지 않고 원래 scene을 반환한다. 소비 경로 `StudioPanels.tsx:333–334`는 scene 자체의 `swatches.map`과 `studio/swatches/roleSets`를 사용한다.
- 최소 재현:

  ```ts
  const s = defaultStudio([createAnchor('#336699', 0)]);
  const p = createProject(
    {kind:'baseColor',hex:'#336699',harmony:'analogous',generationIndex:0},
    recommend(s)[0].colors, s);
  const malformed = {...p, sequence:[{id:'scene1',name:'missing snapshots'}]};
  const imported = parseProject(JSON.stringify(malformed));
  // 관측: 반환된 sequence[0]는 id/name만 있고 swatches/studio/roleSets가 없다.
  ```

- 관측 실패: 위 입력과 studio/roleSets만 있고 swatches가 없는 장면 모두 `parseProject`가 허용했다. snapshot의 렌더링 식 `saved.swatches.map(...)`에는 undefined가 들어간다. 브라우저 오류 자체를 실행 관측한 것은 아니지만 파서가 돌려주는 누락 값과 소비 식은 확인했다.
- 보호장치의 반증: 장면 개수 상한, ID 중복 검사, 재귀 호출은 존재한다. 하지만 필수 scene 데이터의 부재를 부모 데이터 상속이 가린다. 정상 scene의 JSON 왕복 및 sequence CSS 출력 테스트는 이 실패를 검사하지 않는다.
- 최소 수정: scene의 세 snapshot 필드가 직접 존재하는지 먼저 검증한다. 허용된 scene 필드만 사용해 프로젝트 검증 입력을 구성하고, 재귀 검증에서 반환한 정규화 swatches/roleSets/studio를 scene에 저장한다. schema/source 등 scene에 허용되지 않는 필드가 부모 검증 계약을 바꾸지 못하게 한다.
- 통과 기준: 각 필드 단독 누락과 세 필드 모두 누락을 import 단계에서 거절한다. 완전한 장면은 저장/재파싱/복원/sequence CSS 출력이 동일하고, 장면의 anchor·잠금·역할 참조 불일치도 거절한다. 잘못된 장면 때문에 앱 렌더링이 중단되지 않아야 한다.

### IE2 — 사용자색이 있으면 색 방향 warm/cool 조건이 추천에서 사라진다

- 중요도·요구: P2, 출시 전 수정. 입력 의도의 실제 반영(R03 및 검토 문서 2절·4A·9.2).
- 근거: `studio.ts:209–210`의 conceptHex는 전체 콘셉트로 계산하지만, 앵커가 하나라도 있으면 bases를 앵커 원색만으로 정한다. 이후 생성의 hue는 `243,252–254`에서 그 base만 회전시키며 hueDirection은 다시 사용하지 않는다. 사용자색의 soft target `230–238`에도 색 방향은 반영되지 않는다.
- 최소 재현:

  ```ts
  const base = defaultStudio([createAnchor('#336699', 0)]); // count=6, 고정 1 + 생성 5
  const warm = structuredClone(base); warm.concept.hueDirection = 'warm';
  const cool = structuredClone(base); cool.concept.hueDirection = 'cool';
  JSON.stringify(recommend(warm)) === JSON.stringify(recommend(cool));
  // 관측: true. 세 후보의 모든 색·변경 설명·경고가 같다.
  ```

- 영향: 추가 생성색으로 의도를 반영할 여지가 있어도 색 방향 선택이 효과가 없다. 콘셉트만으로 시작할 때는 작동하므로 다중 앵커 흐름에서만 드러난다.
- 보호장치의 반증: 앵커 고정과 원색 기준 soft 한계를 지키는 것은 올바르다. 이 사례에서는 5개의 추가 생성색이 있어 고정 때문이라는 설명으로 반증할 수 없다. 분위기/사용처의 chroma 가중치와 피할 색 검사도 있지만 색 방향을 처리하지 않는다.
- 최소 수정: 고정색을 바꾸지 않고 추가색 또는 허용된 soft target에 색 방향 목적을 적용한다. 조화/고정 조건 때문에 만족할 수 없으면 효과가 없다는 충돌을 설명한다. 단순히 입력색을 새 대표색으로 바꾸거나 first anchor 하나로 축약하지 않는다.
- 통과 기준: 위 사례에서 고정 #336699는 유지되고 warm/cool의 가능한 생성색 관계가 달라지거나 해당 목적의 명시적 충돌이 표시된다. 전체/부분 고정, 보정량 0 및 무채색 monochromatic 조건도 계속 지킨다.

### IE3 — 주변 채도 설정이 배열 슬롯에 묶여 일부 정상 입력에서 아무 효과가 없다

- 중요도·요구: P2, 출시 전 수정. R08의 주변 채도 감소 조작.
- 근거: `studio.ts:254`는 전체 팔레트 index가 3의 배수일 때만 surroundingChroma를 적용한다. `255–256`의 암부 tint 재구성, `258–260`의 중복 회피, `262–266`의 회피색 재생성은 해당 배율을 다시 사용하지 않는다. 원본/생성 여부나 실제 배경·강조 역할의 정책과 연결되지 않는다.
- 최소 재현:

  ```ts
  const colors=['#336699','#E05566','#228866','#553388','#C69944'];
  const base=defaultStudio(colors.map((hex,i)=>createAnchor(hex,i,5))); // count=6
  const full=structuredClone(base); full.surroundingChroma=1;
  const zero=structuredClone(base); zero.surroundingChroma=0;
  JSON.stringify(recommend(full)) === JSON.stringify(recommend(zero));
  // 관측: true. 고정 5개와 추가 생성색 1개의 모든 후보가 같다.
  ```

- 영향: 이 사례의 유일한 생성색 index=5에는 배율이 적용되지 않는다. 사용자가 주변 채도를 100%에서 0%로 낮춰도 결과와 이유가 그대로이며, “모두 고정” 경고도 없다. 첫 추가색은 밝은 배경 후보로 쓰이므로 조작의 자연스러운 대상이 될 수 있다.
- 보호장치의 반증: 고정 앵커를 조정하지 않는 것은 올바르다. 하지만 추가색은 고정되지 않았고 이 사례에는 중복/회피 조건도 없다. 고정색 한계 때문에 효과가 없다는 반증은 성립하지 않는다.
- 최소 수정: 주변/강조의 대상 정책을 명시하고 전체 index의 나머지 대신 그 정책으로 배율을 적용한다. 후보의 회피·중복 해결 경로 뒤에도 같은 목표를 유지하거나 충돌 사유를 표시한다. 고정 앵커에는 적용하지 않고 soft 앵커에 적용할 경우 원색 상한을 유지한다.
- 통과 기준: 위 사례에서 적어도 조정 가능한 주변 생성색의 최종 chroma가 감소한다. 입력색 개수 1/3/5/8 변경만으로 배율이 무시되지 않고, 고정색 보존·원색 기준 ΔE/L/C/H 한계·최종 회피 검사는 계속 통과한다.

## 보호장치 확인과 제외

- 기존 schema1 `reason:null` 연결을 `userBinding`으로 보수적으로 이행하는 `project.ts:697–701`을 확인했다. 새 수동 연결도 별도 reason을 사용하며 refreshRoles에서 보존한다. 이전 설계 D1의 핵심 실패를 다시 지적하지 않는다.
- 가변 5~16 swatches와 안정 s-ID, 앵커 대응, 최종 결과의 bounds 검증을 확인했다. 고정 1/5/8/12개 및 duplicate HEX에 대한 의미 있는 테스트가 있어 이전 설계 D2를 미구현이라는 이유로 유지하지 않는다.
- cyclic 끝점 충돌, 같은 t의 다른 HEX, sequential/diverging의 샘플 L 역전 검사가 있다. probe에서 cyclic 끝점 #FFFFFF/#000000은 경고로 검출되었다. `sampleMap`은 경고 상태의 CSV 출력을 거절하고, exact anchor/합집합 표본/복수 anchor ID를 지원한다.
- malformed anchor 잠금 불일치는 probe에서 거절되었다. 무채색 monochromatic probe는 회색 생성색을 유지했다. bounds의 양자화 후 검증과 반복 원색 기준은 구현되어 있다.
- 좌표 편집은 새 입력 기준을 정한다고 UI에 명시되어 있어, 명시적 직접 편집의 originalHex 갱신을 자동 추천 누적 이동으로 오인하지 않는다. Lab D50과 혼합 공식/클리핑 조건도 표시한다.
- LUT의 전체 RGB 함수, 입력/출력 encoded sRGB D65, red-fastest 33³ 순서 및 팔레트 잠금 계약과의 구분을 확인했다. ASE는 big-endian block 구조, DTCG/Tailwind/프로그램 출력은 같은 getRoleHex 경로를 사용한다. 읽은 tests에는 ASE 독립 파싱 및 identity cube가 있지만 reviewer가 전체 export suite를 실행한 것은 아니다.

## 남은 미검증

전체 회귀 suite의 현재 결과, 실제 브라우저에서 IE1의 오류 화면, 실제 Adobe/Office/VSCode/Windows Terminal/영상 도구 import, 프로덕션 배포는 실행하지 않았다. 25개 단위 통과 및 진행 중 e2e는 조정자 제공 상태이며 이 독립 리뷰의 실행 결과로 표시하지 않는다. 현 snapshot의 엔진·출력에서 이외의 검증된 결함은 추가하지 않는다.
