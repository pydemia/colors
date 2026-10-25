# 온프레미스 배포

운영 경로: `colors.pydemia.ai` → Cloudflare Tunnel → pydemia-server의
`127.0.0.1:4380` → 사용자 systemd `colors.service` → Caddy 정적 파일.
원본 이미지와 팔레트 저장 방식은 브라우저 로컬 처리를 유지한다.

## 서버 구성

- 앱: `~/workspaces/colors`.
- 현재/이전 release: `current`, `previous` 심볼릭 링크.
- 정적 release: `releases/<app-source-revision>`.
- 기존 브라우저 캐시의 hashed asset 유지: `shared/assets`.
- Caddy: `~/.local/share/colors/runtime/caddy-2.11.7/caddy`.
- 설정: `~/workspaces/colors/Caddyfile`.
- 서비스: `~/.config/systemd/user/colors.service`.
- 사용자 linger 활성화, 서비스 자동 시작·실패 시 재시작.

HTML은 재검증하고 favicon은 저장하지 않으며, 존재하는 hashed asset만
1년 immutable 캐시한다. no-transform으로 CDN의 분석 script 주입을 막는다.
없는 asset은 HTML fallback 없이 404를 반환한다. 서비스는 loopback에만
바인딩하며 외부 HTTPS는 기존 cloudflared와 Cloudflare가 처리한다.
오류 응답은 원래 상태 코드를 유지하고 no-store로 음성 캐시를 방지한다.

## 최초 설치

SSH 사용자의 Linux x86_64 환경에서 이 폴더를 전송한 뒤 실행한다.
`setup.sh`는 공식 Caddy 2.11.7 배포물의 고정 SHA-512를 확인하고 사용자
경로에 설치한다. 전역 apt 패키지·Docker·방화벽 변경은 하지 않는다.

```sh
bash setup.sh
```

setup은 서비스만 enable하고, 첫 release의 배치·검증은 deploy.sh가 수행한다.
사용자 linger가 정책상 거부되면 그 단계에서 중단한다.

## 업데이트

Windows 저장소에서 변경한 revision을 먼저 build·검사한다.
아래 명령의 revision과 경로는 해당 작업의 실제 값으로 설정한다.

```powershell
pnpm build
pnpm test
$releaseId = git rev-parse HEAD
$archive = Join-Path $env:TEMP "colors-$releaseId.tar.gz"
tar -czf $archive -C dist .
$archiveSha = (Get-FileHash $archive -Algorithm SHA256).Hash.ToLowerInvariant()
scp $archive pydemia-server:/home/pydemia/.cache/colors/
```

서버에서 파일명·revision·SHA-256을 대조해 배치한다.

```sh
bash ~/.cache/colors/deploy-config/deploy.sh ARCHIVE RELEASE_ID ARCHIVE_SHA256
```

같은 release ID는 불변 파일을 재사용한다. 앱 내용이 달라졌으면 새 revision을
사용한다. 기존 shared asset은 이름과 bytes가 같아야 재사용하며, 충돌 시 중단한다.
배치 후 current를 atomic 교체하고 실제 index 응답을 검사한다. 실패 시
이전 링크·서비스로 복귀한다. 자동으로 오래된 release나 asset을 삭제하지 않는다.

운영 도메인에서 응답의 `X-Colors-Origin: pydemia-server`, 정적 파일 hash,
다운로드·저장/복원·이미지 생성과 favicon을 확인한다. 전체 회귀 검사는:

```powershell
$env:COLORS_TEST_BASE_URL = "https://colors.pydemia.ai"
pnpm test:e2e
Remove-Item Env:COLORS_TEST_BASE_URL
```

## 운영과 복구

```sh
systemctl --user status colors.service
journalctl --user -u colors.service -n 50 --no-pager
systemctl --user restart colors.service
readlink ~/workspaces/colors/current
readlink ~/workspaces/colors/previous
loginctl show-user "$(id -un)" -p Linger
```

이전 release로 복구할 때 그 release ID와 원 archive/hash를 deploy.sh에
전달한다. 기존 Vercel 배포는 별도 fallback으로 보존하되 Git 자동 배포는
`vercel.json`의 `git.deploymentEnabled=false`로 중지한다. 온프레미스 업데이트는
위 배치 절차로 실행하며 Git push만으로 자동 배포되지는 않는다.
Cloudflare DNS 복구 값과 이관 검사는
[이관 기록](../../.worknotes/MIGRATION_ON_PREMISE.md)에 둔다.
