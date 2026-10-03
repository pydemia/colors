# 출시·복원 지적 한정 재검증

대상: `implementation-b`  
원 지적: `.worknotes/reviews/implementation-release.md`의 O1–O4  
범위: 장면 필수 데이터/정규화, 삭제 전 이행 백업, 400ms 지연 저장 경합,
editingSpace 저장·복원. 전체 구현을 재리뷰하지 않았고 다른 reviewer의
결과를 읽지 않았다. 원본 및 소스 수정은 없다.

## 고정 입력과 수행

- snapshot: `C:/Users/pydemia/AppData/Local/Temp/colors-implementation-b`.
- manifest: `.worknotes/reviews/implementation-b-manifest.json`, SHA-256
  `E8D46780F6B5D46B3646DDC826E7AEA60A67A3848FBBA660E73577C16030E694`.
  snapshot 파일 16/16의 hash가 manifest와 일치함을 확인했다.
- 읽은 변경 경로: `src/lib/project.ts:703`–`:779`, `src/lib/studio.ts`의
  editingSpace 선언/기본값/검증, `src/components/StudioPanels.tsx:173`–`:228`,
  `src/App.tsx:375`–`:395`, 관련 단위 테스트 `studio.test.ts:68`–`:85`와
  e2e `flows.spec.ts:29`–`:51`.
- 주요 파일 hash: project.ts
  `A0D118F7F59FDCA30A1BB0B5F904C253281E39489FE175A01C78F0966B35DB90`;
  studio.ts `6601B5780A973AF9491AF9E457F189237DF6545A19D69A7A9DD0E32AAE71B4CA`;
  StudioPanels.tsx
  `E521F34F15BB8D2CE890FC6F3B7DBCFD631191B084ADC2C4BE680574A48ED32C`;
  App.tsx `C757A57A60EB9D592CB5EB81B3E7276B2C7C39965FC49045BDFC284B5C4CB786`.
- 실행 artifact: `.worknotes/reviews/recheck-release-repro.mjs`, SHA-256
  `77F48A5DFAD2E8781BF830572D3272E60AC73471450E5374F7C45026AC78DCF3`.
  Node v24.21.0/culori 4.0.2에서 고정 snapshot의 순수 함수 모듈을 타입만
  제거해 별도 임시 디렉터리에서 실행했다.
- schema1 fixture: `.worknotes/examples/locked-base-color.json`, SHA-256
  `816664BA15A16B05420DF4B640116EB8F3FE423A99A86C3377105B54CD3B6562`.
- 실제 모델·effort metadata는 확인 불가이며 설정을 변경하지 않았다.

## 재판정

| 원 지적 | 판정 | 확인 근거와 실제 수행 | 잔존/한계 |
| --- | --- | --- | --- |
| O1 필수 장면 필드 누락 허용 | 해결 | project.ts:724–726이 swatches/roleSets/studio를 scene 자체의 필수 필드로 검사한다. :727–731은 정규화된 반환값을 실제 scene에 반영한다. 세 필드의 개별 누락과 끊어진 역할 참조가 거부되는 것을 실행했다. 소문자 scene 색·anchor 원색·수동 역할 override가 대문자로 복원되는 것도 확인했다. | 브라우저 crash 화면 전체를 다시 실행하지 않았다. 파서가 잘못된 scene을 수용하던 원인은 제거됐다. |
| O2 삭제 시 이행 백업 우회 | 해결 | deleteProject:767–768이 load/검증 뒤 backupStorage를 공통 호출하고 :769부터 본 저장값을 쓴다. schema1 두 프로젝트에서 하나를 삭제하여 원문 backup 생성·나머지 schema2 이행을 실행 확인했다. backup 쓰기를 quota 오류로 실패시키자 기존 원문 저장 키가 그대로 남았다. | 이 판정은 이행 전 백업 보존에 관한 것이다. 운영자가 그 백업으로 복구하는 실제 절차까지 수행한 결과는 아니다. |
| O3 400ms 저장 취소 경합 | 해결(지적한 지연 경로) | App.tsx:387–395는 project 변경 effect에서 saveProject를 바로 호출한다. 이전 400ms timer와 project 전환 시 clearTimeout하는 cleanup이 제거됐다. 따라서 원 지적의 ‘0–399ms 동안 전환하여 pending 저장을 취소’하는 경로는 남아 있지 않다. 저장 오류는 기존 알림으로 처리한다. | 이 reviewer는 빠른 A→B 전환을 브라우저에서 별도 실행하지 않았다. 모든 저장 실패/앱 종료 상황을 포괄 보증하는 판정은 아니다. |
| O4 선택 표색계 비영속 | 해결 | Studio에 editingSpace가 추가됐고 ColorAnalysis:177/228은 프로젝트 설정을 읽고 쓴다. project.ts:703–704는 이전 schema2 입력의 누락 필드를 OKLCH로 채운다. 제공 7종 각각의 JSON 왕복·기기 저장/불러오기에서 설정과 swatches가 보존됨을 실행 확인했다. schema1 및 해당 필드 없는 schema2의 기본값도 확인했다. | 실제 UI 재열기 결과는 조정자의 e2e 실행 증거를 사용한다. 이 reviewer의 직접 실행은 직렬화/저장 함수 경로다. |

O1/O2/O4는 별도 재현 스크립트의 assertion을 모두 통과했다. O3는 원래
문제였던 timer·취소 경로의 제거를 정적 검사로 확인했다. 원래 보고서의
관측을 수정하지 않고 변경본에 대한 판정을 이 파일에 분리했다.

## 완료 증거와 미검토

조정자는 변경본에서 단위 테스트 27개, e2e 16개, 빌드 통과를 확인했다고
전달했다. 이 reviewer가 전체 suite를 다시 실행한 것은 아니다. snapshot
e2e에는 Lab 선택 → JSON 필드 검사 → 재열기 후 Lab 및 저장 장면 복원이
포함되어 있음을 읽었다.

새 production 배포 전이라는 사실을 결함으로 세지 않는다. 이번 O1–O4
재검증은 완료됐으며, 최종 앱 완료 판정은 최종 commit/deployment/custom
domain에 연결된 실제 생성·복원·출력 흐름 증거를 조정자가 확인해야 한다.
다른 기능·형식·색채 연산·사용성의 전체 리뷰와 실제 대상 프로그램
가져오기는 이번 범위 밖이다.
