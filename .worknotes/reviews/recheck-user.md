# 사용자 구현 리뷰 재검증 — implementation-b

범위는 이전 독립 리뷰 I-U1~I-U5와 그 수정 경로에 한정했다. 고정 스냅샷
`C:\Users\pydemia\AppData\Local\Temp\colors-implementation-b`를 읽었다.
다른 reviewer 결과, 수정 중인 앱 소스 및 프로덕션은 검토하지 않았다.
앱 소스·스냅샷을 수정하지 않았다.

읽은 파일의 SHA-256을 직접 계산해 implementation-b manifest와 대조했다.

| 파일 | SHA-256 |
| --- | --- |
| src/App.tsx | C757A57A60EB9D592CB5EB81B3E7276B2C7C39965FC49045BDFC284B5C4CB786 |
| src/components/StudioPanels.tsx | E521F34F15BB8D2CE890FC6F3B7DBCFD631191B084ADC2C4BE680574A48ED32C |
| src/components/UsagePreview.tsx | C223207E7E474C6FF69A8C45F3B508EA008D79E5ABED7978B0C7B28C6C9B3F78 |
| src/styles.css | FB83C81D19F3901C40E6E5A7A34CCD2772858DB84D141D841ECB2595002E55D0 |
| src/lib/studio.ts | 6601B5780A973AF9491AF9E457F189237DF6545A19D69A7A9DD0E32AAE71B4CA |
| e2e/flows.spec.ts | 4F06517CDD11A105B5BF9CA0EE2C857DE21D81A271C1F383F0D94E5F8CEBC291 |

## 항목별 판정

| ID | 판정 | 재검증 근거 |
| --- | --- | --- |
| I-U1 | 해결 | App.tsx:501–509는 candidateStudio와 후보 배열·선택 표시만 갱신하고 Project를 바꾸지 않는다. choose():486–498에서만 후보와 그 설정을 Project에 적용한다. 재추천 버튼은 후보가 없는 상태에도 표시된다(1030–1038). RefinementPanel:129–134/158–159도 후보 생성과 카드 채택을 분리했다. |
| I-U2 | 해결 | studio.ts:293–305의 paletteWarnings는 전달된 실제 색 배열의 회피 범위와 anchor 불변 조건을 검사한다. App.tsx:1157–1159는 현재 swatches를 ID 순으로 전달하고 접힌 분석 밖에 ‘현재 팔레트’ 경고를 표시한다. 후보 경고는 App.tsx:1071–1072에서 후보별로 표시한다. ColorAnalysis:187–188도 현재 색을 검사한다. |
| I-U3 | 원래 비교 UI 결함 해결; 경고 문구의 작은 잔존 | StudioPanels.tsx:166–167은 잠금 여부와 무관하게 최초 원색 대비 ΔE를 표시하며, fixedHex가 다르면 고정 목표와 ‘추천된 현재 색을 고정’을 설명한다. 그러나 studio.ts:303의 명도 범위 경고에는 ‘원색을 우선 보존했습니다’라는 문구가 남아 있다. 아래 잔존 항목 참고. |
| I-U4 | 해결 | StudioPanels.tsx:168의 개별 복원 이름에 ID가 포함되고, 246/248의 t·위치 고정 이름도 ID를 포함한다. 145행의 복원 결과 안내에 개별 ID 또는 유연색 전체를 구분해 전달한다. |
| I-U5 | 해결 | UsagePreview.tsx:52의 type=button 제어는 실제 초점이 가능하며 --preview-focus를 전달한다. styles.css:1705–1707은 그 버튼의 focus-visible 테두리에 이 변수를 사용한다. offset 4px의 인접 영역은 해당 시안 background이며 기존 검사 focusRing/background와 연결된다. |

## I-U3의 경미한 문구 잔존

P3 문구 · `src/lib/studio.ts:303` · SHA-256은 위 표와 같다.

현재 추천색을 고정해 `fixedHex !== originalHex`이고 고정값 L이 설정 범위
밖일 때, 비교 UI는 현재 색 고정을 정확히 설명하지만 현재 팔레트 경고는
‘원색을 우선 보존했습니다’라고 한다. 고정 목표를 보존하는 연산과 대비
표시는 수정됐으므로 원래 결함의 핵심인 보존 대상·ΔE 은폐는 해결됐다.
여기서는 경고 문구만 ‘고정 목표색을 우선 보존했습니다’로 통일하면 된다.
동일 조건에서 실제 fixedHex와 안내 대상이 일치하는 것이 수용 기준이다.

## 검증 자료와 수행 한계

신규 E2E 21–25행은 다른 후보를 채택한 뒤 새 후보를 생성해도 유연색이
유지되고 선택된 후보가 없음을 확인한다. 83–91행은 직접 편집한 6번 색의
현재 회피 경고와 실제 시안 버튼의 초점 가능성을 확인한다. 테스트 코드를
읽었으며 직접 브라우저를 실행하거나 테스트를 재실행하지 않았다.

조정자가 단위 27개·E2E 16개·빌드 통과를 관측했다는 전달을 받았다.
이는 조정자의 실행 관측이며 이 재검증자가 독립 실행한 결과는 아니다.
역할·출력 값의 실제 브라우저 전후 비교, 스크린리더 발화, computed outline
색, 실제 모바일 화면 및 배포 확인은 조정자의 검증 범위에 남는다.

이 다섯 지적의 변경 경로에서는 위 문구 외 잔존을 확인하지 않았다.
이 판정은 전체 앱의 신규 리뷰나 프로덕션 완료 선언이 아니다.
