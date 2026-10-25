# colors.pydemia.ai 온프레미스 이관

요청일: 2026-10-26 Asia/Seoul.
목적: 기존 Vercel 서비스를 사용자가 구성한 pydemia-server와 Cloudflare로 이관.
출발 revision: `b666b258cb2e568c16cdd110197536736c784709`(v0.3.0).

## 현재 상태

초기 SSH 공개키 인증 실패는 사용자 설정 완료 후 해소했다.
서버는 Ubuntu 26.04.1 LTS x86_64이며 Docker·Nginx·Caddy·Node가 없었다.
관리자 권한이 필요한 전역 패키지 대신 공식 Caddy 2.11.7 바이너리의
SHA-512를 검증해 사용자 경로에 설치했다. 사용자 서비스와 linger를 활성화해
로그아웃·부팅 시에도 실행할 수 있게 했다. 시스템 cloudflared는 보존한다.
기존 `ubuntu-server` 터널에 Colors 경로를 추가하고 DNS를 전환했다.
초기 설정은 version 0이었으나 이관 중 다른 작업이 추가한 Atlas 경로를
다시 읽어 보존한 뒤 Colors 경로를 추가했다. 공유 터널을 재시작하지 않았다.
공개 HTTPS의 `X-Colors-Origin: pydemia-server`와 현재 앱의 bytes를 확인했다.
사이트 데이터는 사용자 소유 `~/workspaces/colors`에 두고 origin은
`127.0.0.1:4380`에만 바인딩한다. 인증 정보는 기록하지 않는다.

## 수용 조건과 증거

| ID | 조건 | 상태 | 증거·남은 작업 |
| --- | --- | --- | --- |
| MIG-01 | 현재 기능을 보존한 배포 산출물 준비 | 충족 | TypeScript/Vite build·단위 40개 통과, 운영과 같은 JS/CSS 자산명, 배포 archive·SHA-256 생성 |
| MIG-02 | pydemia-server에 독립 서비스 배치·지속 기동 | 충족 | 사용자 systemd active/running·enabled, linger=yes, loopback만 listen. 서비스 재시작·동일 payload의 두 release 전환/복귀, 잘못된 SHA 거부 확인 |
| MIG-03 | 기존 Cloudflare 터널에 Colors 경로 연결 | 충족 | colors.pydemia.ai → http://127.0.0.1:4380. 원래 다른 hostname 규칙·catch-all 보존 |
| MIG-04 | colors.pydemia.ai 연결 전환과 복구 보장 | 충족 | proxied CNAME을 기존 터널로 전환. 공개 응답의 origin header 확인, 기존 Vercel 배포와 DNS 복구 값 보존 |
| MIG-05 | 실제 도메인·기능·정적 파일·favicon 검증 | 부분 충족 | 새 origin 22개·최종 공개 HTTPS 22개 통과. 정적 4개 hash·형식·cache·404, favicon HTTP/DOM 정상. PC 잠금으로 네이티브 탭 아이콘 육안 미검증 |

각 조건은 동일 가중치이며 부분 검증은 완료 수에 넣지 않는다.
서버·도메인 전환과 운영 기능 검증은 끝났다. 전체 검증 기준은 4/5(80%)이며
MIG-05의 네이티브 탭 아이콘 확인만 남는다. 실제 재부팅은 수행하지 않았고
enabled·linger·서비스 재시작으로 자동 기동 구성을 확인했다.

## 준비한 파일

기기 내 `.worknotes/migration-artifacts/`는 Git에서 제외한다.

- `colors-b666b258.tar.gz`: dist의 index.html·JS·CSS·favicon만 포함.
- `manifest.json`: source revision, 파일별 크기·SHA-256, archive SHA-256.
- archive SHA-256:
  `2032dfa9e7332fb97272dac02e00b8f69edd0c38eefb9d0e2b79afb2475db87a`.
- JS: `/assets/index-B2dyOGW3.js`.
- CSS: `/assets/index-DC5DmbRs.css`.
- favicon SHA-256:
  `b2eb0d181b8066c525d426edf7ab27833eb90851c74161f7e43de821710a099e`.

기존 운영 favicon은 HTTP 200·image/svg+xml·build와 같은 hash를 확인했다.
이 결과는 전환 전 baseline이며 새 서버의 검증으로 사용하지 않는다.

## 최종 실행 결과

- `pnpm build`: TypeScript/Vite 통과. 앱 산출물은 출발 revision과 동일.
- `pnpm test`: 6개 파일·40개 통과.
- SSH 로컬 포워딩을 통한 실제 새 origin의 브라우저 검사: 22개 통과(44.3초).
- 최종 Cloudflare HTTPS의 데스크톱 Chromium·모바일 WebKit: 22개 통과(48.3초).
  이후 favicon 응답만 no-store로 보완했고 실제 HTTP·hash를 재검사했다.
  HTML·JS·CSS·앱 상태 로직이 같으므로 해당 기능 검사 결과를 재사용한다.
- 초기 공개 도메인 22개 통과 뒤 별도 trace 검사에서 RUM POST가 발생했다.
  trace의 응답 header로 실제 pydemia-server 경유를 확인했다. 실패한 실행은
  최종 성공 결과로 세지 않는다.
- 원인은 Cloudflare의 Web Analytics 자동 script 주입. 테스트의 외부 전송
  단언을 유지하고 Colors 응답에 `no-transform`을 추가해 주입을 방지했다.
  같은 이미지 검사와 전체 22개를 다시 통과했고 브라우저 DOM의 외부 분석
  script가 없음을 확인했다. 도메인 전체의 분석 설정은 변경하지 않았다.
- HTML은 `public, no-cache, no-transform`, favicon은 `no-store, no-transform`,
  기존 hashed JS/CSS는 1년 immutable, 404는 원 상태·no-store를 유지한다.
  Cloudflare의 기본 최소 cache TTL이 favicon에 적용되는 것을 관측한 뒤
  favicon만 no-store로 보완했다. Colors의 지정 URL만 CDN purge했다.
- 공개 HTML·favicon·JS·CSS 4개 모두 build와 SHA-256 일치.
  MIME은 text/html·image/svg+xml·text/javascript·text/css이며 HTML fallback 없음.
- Edge 제어 브라우저에서 실제 공개 화면·기존 프로젝트 개수 보존 확인,
  warning/error 0개·분석 script 0개. head의 favicon은 도구가 자체 badge를
  덧씌우므로 원래 네이티브 탭 표시와 구분한다. Windows native 캡처는 잠금
  화면으로 확인되어 입력을 중단했으며 잠금 해제를 시도하지 않았다.
- [이관 후 공개 화면](screenshots/on-premise-2026-10-26-home.jpg).
- 설정 원본·서버 runtime과 운영·복구 명령은
  [온프레미스 배포](../deploy/on-premise/README.md)에 기록했다.
- Vercel 프로젝트와 기존 배포는 삭제하지 않았다. `vercel.json`은 Git 자동
  배포를 끄고, 온프레미스 업데이트는 명시적 build·전송·deploy.sh로 수행한다.

## 재현 가능한 배치

`deploy/on-premise/setup.sh`는 고정 공식 Caddy 배포물을 SHA-512 검증해
사용자 경로에 atomic 설치하고 설정 검증·서비스 enable을 수행한다.
실행 중인 바이너리를 제자리에서 덮어쓰지 않아 setup 재실행도 확인했다.
`deploy.sh`는 archive SHA-256 확인 → 불변 release 전개 → hashed asset 대조 →
current atomic 전환 → systemd restart → 실제 index bytes 검사 순서다.
실패 시 이전 current가 있으면 복귀하고 첫 설치 실패면 서비스를 중지한다.
정상 release·shared asset·다른 서비스는 자동 삭제하지 않는다.

`~/workspaces/colors/current`:
`releases/b666b258cb2e568c16cdd110197536736c784709`.
`previous`는 같은 payload로 전환·복귀를 시험한 `releases/b666b258`이다.
이는 이전 버전의 앱 호환성 인증이 아닌 배치 경로 복구 검사다.

## 이관·복구 순서

1. SSH 접속을 확인하고 서버의 지침·기존 서비스·포트·배포 관례를 조회한다.
2. 검증한 archive만 새 release 디렉터리로 전송하고 서버에서 hash를 대조한다.
   기존 proxy를 재사용하거나 별도 정적 서비스로 기동하되 기존 앱을 보존한다.
3. cloudflared가 host 서비스인지 container인지 확인해 접근 가능한 origin을
   선택한다. 기존 터널 설정을 다시 읽고 해당 hostname 경로만 추가한다.
4. 공개 DNS 전환 전에 origin에서 HTML·JS·CSS·favicon의 bytes·Content-Type·
   cache와 실제 기능을 검증한다. 알려진 hashed asset이 없으면 404를 반환한다.
5. 검증 후 기존 CNAME 레코드를 tunnel 대상으로 변경한다. 같은 HTTPS 도메인을
   유지해 브라우저 localStorage와 입력 이미지의 로컬 처리 방식을 보존한다.
6. 실제 도메인에서 기능·정적 파일·favicon을 검증한다. 실패하면 CNAME을
   아래 baseline으로 복구하고 기존 Vercel 서비스를 유지한다.
7. 배치 위치·서비스명·origin·release SHA·재배포/복구 절차와 검사 결과를
   이 문서와 운영 문서에 기록하고 관련 변경을 commit·push한다.

기존 CNAME baseline: `078c9c2ec479ca79.vercel-dns-017.com`, proxied=false,
TTL=automatic. 계정 전체의 TLS·다른 DNS·다른 앱의 터널 규칙은 변경하지 않는다.
새 서비스의 검증 전 Vercel 프로젝트·도메인·배포를 삭제하지 않는다.

현재 앱에는 서버 DB·업로드 API가 없다. 기존 사용자의 팔레트는 브라우저
localStorage에 있고 원본 이미지는 메모리에서만 처리되므로 서버 DB나 원본
이미지를 복사할 작업은 없다. 이번 이관에 클라우드 파일 보관 기능을 추가하지 않는다.

## 근거

- [Caddy Linux 서비스](https://caddyserver.com/docs/running#linux-service)
- [Caddy 정적 파일](https://caddyserver.com/docs/caddyfile/directives/file_server)
- [Caddy 오류 응답](https://caddyserver.com/docs/caddyfile/directives/handle_errors)
- [systemd user linger](https://www.freedesktop.org/software/systemd/man/latest/loginctl.html)
- [Cloudflare Web Analytics와 no-transform](https://developers.cloudflare.com/web-analytics/get-started/)
- [Vercel Git 배포 중지](https://vercel.com/docs/project-configuration/git-configuration#git.deploymentenabled)
