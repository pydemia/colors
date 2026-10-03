# 독립 검토 판정과 수정 기록

기준 a: design-2026-10-04-a 및 implementation-a. 원본 보고서를 덮어쓰지 않는다.
현재 명세 b는 UPGRADE_SPEC.md에 기록한다. 세 reviewer의 실제 모델·effort는
확인 불가이며 설정을 바꾸지 않았다. 같은 모델의 동의는 정확성 증거로 세지 않는다.

| 원래 지적 | 판정·반증·적용 | 변경본 검증 |
| --- | --- | --- |
| 설계 U1/U2/U3 | 채택. 생성/채택 분리, 편집 시 후보 표시 해제, 지속 오류와 입력 aria-invalid | 후보 채택 E2E, 입력 오류 E2E |
| 설계 D1/D2 | 채택. schema1 reason:null 연결 보존, 가변 ID와 duplicate 입력 유지 | legacy import, 1/5/8/12색·생성색 재잠금 단위 |
| 설계 D3 | 채택. exact t·합집합 표본·순환/단조성 검사, 충돌 CSV 차단 | 순수 함수·브라우저 충돌 출력 |
| 설계 D4/D5 | 채택. 좌표 단위/백색점·혼합 모델 표기, 전체 RGB LUT 분리 | 혼합 끝점·평균/합/감색·LUT float-grid 단위 |
| 설계 O1/O2/O3/O4 | 채택. 저장소 백업, 출력 계약/미검증 표시, 범위 추적, 배포 SHA 증거 | migration·출력 테스트, UPGRADE_QA |
| IE1 + 출시 O1 | 같은 원인으로 병합·채택. scene 자체 필수 필드 검사와 정규화 반환, 허용 필드만 재귀 검사 | 누락 장면 단위 및 import E2E |
| IE2 | 채택. anchored 추천에도 Warm/Cool 목표 적용, 고정값 우선 | warm/cool 고정5+생성1 비교 단위 |
| IE3 | 채택. 주변 채도 모든 생성색에 적용, 중복/회피 재시도에도 유지 | 고정5+생성1 최종 C 감소 단위 |
| I-U1 | 채택. 재추천과 설정 후보 생성 모두 현재 결과 보존, 카드 선택 시 적용 | 유연색 채택→재추천→결과 유지 E2E |
| I-U2 | 채택. 현재 swatches 검사, 후보별 경고와 현재 경고 분리, 현재 경고는 접힌 분석 밖에도 표시 | 직접 편집 회피 충돌 E2E |
| I-U3 | 채택. fixedHex 목표와 최초 원색 차이를 항상 표시 | 원색 기준 유지 및 재잠금 exact 단위 |
| I-U4 | 채택. 복원/t/위치 잠금 이름에 안정 ID, 복원 알림에 대상 | 고유 레이블을 사용하는 위치 E2E |
| I-U5 | 채택. 실제 초점 가능한 시안 버튼과 프로젝트 focusRing CSS | focusable preview E2E 및 시각 확인 |
| 출시 O2 | 채택. 삭제 경로도 기존 원문 백업 후 schema2 목록 저장 | schema1 첫 삭제 백업 단위 |
| 출시 O3 | 채택. 400ms 지연 저장 제거, 변경 상태 즉시 저장 | 장면·표색계 변경 후 즉시 reload E2E |
| 출시 O4 | 채택. editingSpace를 Studio에 저장하고 초기 schema2 누락값 호환 | JSON/reload 표색계 복원 E2E |

React 검토: 명시적인 TypeScript 타입, label/fieldset/details, 순수 계산과 UI
분리, 훅의 고정 순서를 확인했다. 후보 추천·경고의 반복 렌더 계산을 useMemo로
합쳤다. 버전 있는 localStorage를 유지하며 새로운 서버·인증·외부 요청을 추가하지 않았다.

한정 후속 검증은 implementation-b manifest와 recheck-{engine,user,release}.md로
연결한다. b에서 남았던 무채색 monochromatic 자동 Warm/Cool tint와 재잠금 경고의
‘원색’ 표현을 implementation-c에서 수정했다. 두 문제의 원인은 조정자도
코드·경계 입력에서 확인했으며 고정 목표색 표현과 무채색 우선 계약을 채택했다.
최종 코드의 전체 원문은 출시 commit으로 보존한다.
엔진 c의 neutral warm/cool 경계도 독립 probe에서 해결됨을 확인했다.
사용자 재검증의 I-U3 잔여 ‘원색’ 경고 문구는 조정자가 c에서 ‘고정 목표색’으로
수정하고 실제 변경 행을 확인했다. 출시 재검증 O1~O4는 모두 해당 범위에서 해결됐다.

남은 조건: 실제 Adobe/Office/영상 도구 가져오기는 구조 검사와 다른 검증이다.
이를 출시 통과로 바꾸지 않는다. 프로덕션 배포/도메인 핵심 흐름은 UPGRADE_QA에
실제 관측 후 기입한다. 별도 사진 서비스·ICC·유료 색표·Figma 플러그인은 명세의 후속 범위다.
