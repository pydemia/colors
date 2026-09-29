# Colors 프로젝트 데이터 계약 초안

상태: schemaVersion 1 구현 기준 및 후속 확장 제안 · 2026-09-30

이 문서는 [제품 기획](PRODUCT_PLAN.md)의 첫 공개 범위를 저장 데이터와
편집 동작으로 옮긴 초안이다. [기준색 예제](examples/locked-base-color.json)는
구조 검토용 fixture이며 색값은 예시로 배정했다. 현재 앱은 이 파일의
잠금·역할 참조를 읽고 JSON 왕복을 테스트했다. 예제 색값의 품질이나
프로그램별 가져오기를 검증한 결과는 아니다.

이번 릴리스에서 `photo` 출처는 데이터 확장 자리만 유지한다. 사진 메뉴는
`준비 중`이며 사진 파일 선택·저장·검색·추출을 시작하지 않는다.

## 저장 단위

프로젝트 하나가 원본 팔레트와 사용처별 역할 색상을 가진다. 첫 공개에서는
브라우저 안에 저장하고 사용자가 JSON으로 백업한다. JSON에는 사진 원본,
인증 정보, API 키, 브라우저 파일 경로를 넣지 않는다.

| 필드 | 형태 | 의미 |
| --- | --- | --- |
| `schemaVersion` | 정수, 처음은 `1` | 읽기·마이그레이션 분기 |
| `projectId` | 문자열 UUID | 프로젝트 식별; 색상 순서와 무관 |
| `source` | 아래의 구분 객체 | 콘셉트·기준색·사진 중 시작 경로와 입력 |
| `generatorVersion` | 문자열 | 후보를 만든 규칙과 색 목록의 버전 |
| `swatches` | 순서 있는 객체 5개 | 사용자가 보는 원본 팔레트 |
| `roleSets` | 역할 객체 5개 | 웹·발행물·PowerPoint·편집기·터미널 |
| `updatedAt` | UTC ISO 8601 문자열 | 마지막 프로젝트 변경 시간 |

`source.kind`는 `concept`, `baseColor`, `photo` 중 하나다.

- `concept`: `useCases`, 순서 있는 `moods`, `hueDirection`, `lightness`,
  `saturation`, `avoidHexes`, `note`를 저장한다. 첫 공개에서 `note`는
  생성에 영향을 주지 않는다. 콘셉트의 초기 색 목록은
  `generatorVersion`으로 버전을 고정한다.
- `baseColor`: 정확한 `hex`와 `harmony`를 저장한다. 조화 유형은
  `monochromatic`, `analogous`, `complementary`, `splitComplementary`,
  `triadic`, `tetradic`으로 직렬화한다.
- `concept`와 `baseColor`의 `generationIndex`는 새 후보 생성 순서다.
  과거 예제처럼 이 필드가 없는 schemaVersion 1 JSON은 `0`으로 읽는다.
- `photo`: `image`에 `id`, `acquisition`(`upload` 또는 후속 단계의
  `search`), 파일명 또는 제공처·사진가·원본 페이지 URL·권리 정보를
  저장한다. 원본 픽셀을 저장하지 않으므로 재개 시 사진 재선택이
  필요할 수 있다. 외부 URL은 출처 정보일 뿐 자동으로 다시 요청하지 않는다.

사진 출처와 직접 선택한 색은 다음처럼 연결한다. 이 조각은 전체 프로젝트
파일이 아니며, 실제 이미지 추출 결과도 아니다.

```json
{
  "source": {
    "kind": "photo",
    "image": {
      "id": "image-1",
      "acquisition": "upload",
      "filename": "sample.jpg",
      "provider": null,
      "photographer": null,
      "pageUrl": null,
      "rightsNote": "사용자가 업로드한 이미지"
    }
  },
  "swatches": [
    { "id": "s1", "hex": "#336699", "origin": "autoExtracted", "locked": false, "imageSourceId": "image-1" },
    { "id": "s2", "hex": "#D9822B", "origin": "picked", "locked": true, "imageSourceId": "image-1", "point": { "x": 0.42, "y": 0.67 } }
  ]
}
```

## 원본색과 역할

swatch 하나의 최소 필드는 `id`, 대문자 `#RRGGBB` 형식의 `hex`,
`origin`, `locked`다. `origin`은 `input`, `generated`, `autoExtracted`,
`picked` 중 하나다. 사진에서 온 색은 `imageSourceId`와 좌표
`point: {x, y}`를 더 가진다. 좌표는 보정·회전 후 이미지의 너비와
높이를 각각 1로 놓은 0–1 범위다. 자동 추출색에는 대표 좌표가
없을 수 있으므로 `point`를 넣지 않는다.

역할 값은 `{ "swatchId": "s1", "overrideHex": null, "reason": null }`
형태다. `swatchId`는 항상 존재하는 원본색을 가리킨다. 파생색이
필요할 때만 `overrideHex`를 채우고 `reason`을 `generated`,
`contrastAccepted`, `userEdit` 중 하나로 둔다. 화면과 내보내기에
쓰는 실제 색은 `overrideHex ?? swatch.hex`다. 덮어쓰기는 해당 역할에만
적용된다.

`roleSets`의 최상위 키는 `web`, `publication`, `powerPoint`, `editor`,
`terminal`이다. `editor`의 주석·키워드 등 구문 색과 `terminal`의 ANSI
16색은 별도 역할이며 자동 동기화하지 않는다. 첫 공개의 편집기·터미널
시안은 공통 역할값을 사용처별로 모사한다. 실제 프로그램의 렌더링과
동일하다는 뜻은 아니다.

| 역할 집합 | 첫 예제의 필수 키 |
| --- | --- |
| `web` | `background`, `text`, `primary`, `secondary`, `accent`, `link`, `success`, `warning`, `error` |
| `publication` | `cover`, `bodyBackground`, `bodyText`, `accent` |
| `powerPoint` | `dark1`, `light1`, `dark2`, `light2`, `accent1`–`accent6`, `hyperlink`, `followedHyperlink` |
| `editor` | `background`, `foreground`, `comment`, `keyword`, `string`, `number`, `type`, `function`, `variable`, `error`, `warning`, `selection` |
| `terminal` | `background`, `foreground`, `cursor`, `selection`, `black`, `red`, `green`, `yellow`, `blue`, `magenta`, `cyan`, `white`, 그리고 앞 여덟 색의 `bright*` |

역할 키는 Colors 내부 데이터 이름이다. 각 프로그램의 파일 필드나
색상 이름과 1:1로 일치한다고 가정하지 않는다. 내보내기 변환표는
실제 대상 프로그램에서 확인한 뒤 고정한다.

## 편집·재생성 규칙

1. 잠긴 swatch의 `hex`는 후보 재생성, 역할 자동 배정, 대비 제안,
   내보내기로 바뀌지 않는다. 사용자가 잠금을 해제하고 색을 편집할
   때만 변경한다.
2. swatch의 `id`는 순서를 바꿔도 유지한다. 원본색을 편집하면
   `overrideHex`가 없는 참조 역할만 새 색을 표시한다. 덮어쓴 역할은
   사용자가 `원본색 사용` 또는 `다시 맞추기`를 누르기 전까지 유지한다.
3. 참조 중인 swatch를 삭제하려면 새 swatch로 역할을 재지정하거나
   삭제를 취소한다. 끊어진 참조를 저장하지 않는다.
4. 대비 수정안은 미리 보여 주고 사용자가 채택할 때에만 역할의
   `overrideHex`와 `reason: contrastAccepted`를 기록한다.
5. JSON·CSS·프로그램별 출력은 현재 프로젝트에서 만드는 스냅샷이다.
   내보내기 자체는 `swatches`, `roleSets`, `updatedAt`을 바꾸지 않는다.

## 가져오기와 버전 처리

- JSON을 읽을 때 `schemaVersion`, 필수 키, 고유한 swatch `id`, 모든
  역할 참조, 색 형식, 좌표 범위를 확인한다. 오류 위치를 보여 주고
  기존 프로젝트를 덮어쓰지 않는다.
- 모르는 `schemaVersion`은 추측해서 읽지 않는다. 이후 버전에서
  변환 함수를 제공할 때만 마이그레이션한다.
- 사진 출처 URL은 메타데이터로만 표시하고 명시적 사용자 동작 없이
  네트워크에서 다시 읽지 않는다.
- 첫 CSS 출력은 `--colors-web-background`, `--colors-web-text`처럼
  `--colors-{역할 집합}-{역할}` 이름을 사용한다. JSON 프로젝트 백업과
  CSS 역할값 출력은 서로 다른 결과물이다.

## 검토가 필요한 경계

- 사진 색상 프로파일을 sRGB로 바꾸는 순서, EXIF 방향 보정,
  투명 픽셀 처리, 업로드 크기 상한은 실제 이미지 사례로 검증한다.
- 색이 부족할 때 자동으로 만든 파생색의 `reason`과 재생성 범위는
  첫 구현에서 예제를 바탕으로 확정한다.
- 이 계약은 형식 제안이다. JSON Schema와 파서, 저장·재열기,
  실제 프로그램 출력은 아직 구현하거나 검증하지 않았다.
