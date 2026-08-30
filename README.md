# 오늘 어디가지? 👟

서울·수도권에서 아이와 함께 갈 만한 장소를 조건에 따라 추천하는 React + Vite 웹사이트입니다.

## 주요 기능

- 날씨, 아이 연령, 소요 시간, 비용, 테마 검색
- 100개 장소 데이터와 결과 내 필터
- 현재 조건에서 바로 고르는 `오늘의 추천 TOP 3`
- 장소별 엄마 피로도와 추천·비추천 가족 안내
- 현재 위치 기준 직선거리 계산 및 가까운 순 정렬
- 장소 상세보기와 랜덤 추천
- 카카오맵 목적지 길찾기와 지도 바로가기
- 모바일 고정 검색 버튼, 접을 수 있는 빠른 필터, 전체 화면 상세보기
- 검색 결과 12곳씩 더 보기와 전체 조건 결과 수 안내
- 모달 포커스 이동·내부 순환·원래 버튼 복귀
- 장소 데이터 업데이트 일자와 최신 카카오맵 정보 확인 링크
- 브라우저에 저장되는 찜하기
- 카카오 로그인과 장소별 가족 후기
- 우리 아이 반응, 재방문 의사, 아이 연령별 후기 요약
- 주차·혼잡도·부모 피로도·힘들었던 점을 담는 가족 후기
- 공개 후기의 사용자 UUID 비공개 처리
- 후기 신고, 20초 저장 간격 제한, 개인정보 작성 경고
- 개인정보·이용 안내와 회원 탈퇴 요청
- favicon, 카카오톡·SNS 공유 메타데이터, WebSite·ItemList 구조화 데이터

## 로컬 실행

```bash
pnpm install
pnpm dev
```

## 빌드

```bash
pnpm build
```

## 카카오맵 설정

카카오 개발자 콘솔에서 앱을 만들고 카카오맵 사용 설정을 켠 뒤, JavaScript 키의 사이트 도메인에 로컬 주소와 배포 주소를 등록합니다.

프로젝트 루트에 `.env.local` 파일을 만들고 다음 값을 입력합니다.

```bash
VITE_KAKAO_MAP_KEY=발급받은_JavaScript_키
```

환경변수를 추가하거나 변경한 뒤에는 개발 서버를 다시 시작해야 합니다. 배포 환경에서는 Vercel 프로젝트의 Environment Variables에도 같은 이름으로 등록합니다.

### 카카오 장소 데이터 동기화

카카오 Local API에 사용하는 REST API 키는 `.env.local`에만 저장합니다. 이 키에는 `VITE_` 접두사를 붙이지 않으며 브라우저 코드에서 사용하지 않습니다. 배포 중에는 실행되지 않으므로 Vercel 환경변수에도 등록하지 않습니다.

```env
KAKAO_REST_API_KEY=발급받은_REST_API_키
```

```bash
pnpm sync:kakao
```

동기화가 끝나면 고신뢰 결과는 `src/data/kakao-places.json`에 반영되고, 후보 비교 자료는 `kakao-place-audit.json`과 `kakao-place-audit.csv`로 생성됩니다. 저신뢰 결과는 장소 ID를 자동 입력하지 않고 `kakaoNeedsReview: true`로 남깁니다.

## 카카오 로그인과 후기 데이터베이스 설정

후기는 Supabase의 Auth와 PostgreSQL을 사용합니다. Supabase 프로젝트를 만든 뒤 SQL Editor에서 다음 파일을 순서대로 실행합니다.

1. `supabase/migrations/202608210001_create_reviews.sql`
2. `supabase/migrations/202608210002_public_beta_safety.sql`
3. `supabase/migrations/202608240001_expand_family_reviews.sql`

Supabase 프로젝트의 Authentication > Providers > Kakao에서 다음 값을 등록합니다.

- Client ID: 카카오 REST API 키
- Client Secret: 카카오 로그인 Client Secret
- Allow users without an email: 활성화

카카오 개발자 콘솔에서는 카카오 로그인을 켜고, REST API 키의 Redirect URI에 Supabase가 안내하는 Callback URL을 등록합니다. 동의항목은 닉네임만 사용하며 이메일은 필수가 아닙니다.

Supabase Authentication의 Redirect URL 허용 목록에는 다음 주소를 등록합니다.

```text
http://127.0.0.1:5173/
http://localhost:5173/
https://oneulwhere.kr/
https://www.oneulwhere.kr/
https://oneulwhere.com/
https://www.oneulwhere.com/
https://wherewego-zeta.vercel.app/
```

프로젝트 루트의 `.env.local`과 Vercel Environment Variables에 다음 값을 추가합니다.

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
```

`service_role` 키와 카카오 Client Secret은 프런트엔드 환경변수나 GitHub에 넣지 않습니다.

## 정식 도메인 연결 체크리스트

대표 공개 주소는 `https://oneulwhere.kr`입니다. canonical, Open Graph, Twitter Card, WebSite 구조화 데이터, `sitemap.xml`, `robots.txt`는 이 주소를 기준으로 설정되어 있습니다. `SITE_URL` 또는 `NEXT_PUBLIC_SITE_URL` 환경변수는 현재 Vite 앱에서 사용하지 않습니다.

### Vercel Domains

Vercel 프로젝트의 Settings > Domains에서 다음 도메인을 추가합니다.

```text
oneulwhere.kr
www.oneulwhere.kr
oneulwhere.com
www.oneulwhere.com
```

- `oneulwhere.kr`을 Production의 대표 도메인으로 사용합니다.
- 나머지 세 도메인은 Vercel Domains의 Redirect 설정에서 `https://oneulwhere.kr`로 영구 리다이렉트합니다.
- DNS 설정은 Vercel이 각 도메인에 안내하는 레코드를 도메인 구입처에 그대로 등록합니다.
- `wherewego-zeta.vercel.app`은 개발·복구 확인용 주소로만 남기고 공개 링크로 공유하지 않습니다. 이 주소로 접속해도 HTML의 canonical과 SNS 메타데이터는 `oneulwhere.kr`을 가리킵니다.

호스트별 리다이렉트는 `vercel.json`에 중복 작성하지 않고 Vercel의 Domains 설정에서 관리합니다. 도메인 연결 전에는 `oneulwhere.kr` DNS가 아직 열리지 않을 수 있습니다.

### Kakao Developers

앱 설정 > 플랫폼 키 > JavaScript 키의 JavaScript SDK 도메인에 다음 주소를 등록합니다.

```text
https://oneulwhere.kr
https://www.oneulwhere.kr
https://oneulwhere.com
https://www.oneulwhere.com
```

로컬 개발과 Vercel 백업 주소에서 지도를 계속 테스트하려면 기존 `http://localhost:5173`, `http://127.0.0.1:5173`, `https://wherewego-zeta.vercel.app`도 유지합니다. 카카오톡 공유 링크를 사용한다면 앱 설정 > 제품 링크 > 웹 도메인에도 위 네 개의 정식 도메인을 등록합니다.

Supabase로 카카오 로그인을 처리할 때 Kakao Developers의 Redirect URI에는 공개 사이트 주소가 아니라 Supabase Authentication > Providers > Kakao에 표시되는 Callback URL을 그대로 등록합니다. 키나 Callback URL을 코드에 하드코딩하지 않습니다.

### Supabase Auth

Supabase Dashboard의 Authentication > URL Configuration에서 다음을 설정합니다.

- Site URL: `https://oneulwhere.kr`
- Redirect URLs: 위의 `Supabase Authentication의 Redirect URL 허용 목록`에 적힌 주소

앱은 로그인 후 돌아갈 주소를 현재 접속 origin으로 계산합니다. 따라서 사용할 정식·보조·개발 주소는 Supabase Redirect URLs에 각각 정확히 등록해야 합니다.

### 공개 전 확인

1. `https://oneulwhere.kr`에서 홈 화면, 지도, 카카오 로그인, 후기 작성이 정상인지 확인합니다.
2. 세 보조 도메인이 `https://oneulwhere.kr`로 이동하는지 확인합니다.
3. `https://oneulwhere.kr/robots.txt`와 `https://oneulwhere.kr/sitemap.xml`이 열리는지 확인합니다.
4. 카카오톡에 대표 주소를 새로 공유해 제목·설명·이미지를 확인합니다.
5. GitHub와 Vercel에는 브라우저 공개를 전제로 한 Kakao JavaScript 키와 Supabase publishable 키만 두고, Supabase `service_role`, Kakao REST API 키, Kakao Client Secret은 올리지 않습니다.

## 공개 베타 운영

Supabase의 Table Editor에서 다음 항목을 주기적으로 확인합니다.

- `review_reports`: `status`가 `pending`인 신고를 확인하고, 필요한 경우 원본 `reviews` 행을 삭제한 뒤 `resolved` 또는 `dismissed`로 변경합니다.
- `account_deletion_requests`: `status`가 `pending`인 사용자를 Authentication > Users에서 삭제합니다. 사용자 삭제 후 요청 행도 외래 키 설정에 따라 함께 삭제됩니다.

관리자 작업은 Supabase Dashboard에서만 수행하고, 관리자용 키를 웹사이트 코드에 추가하지 않습니다. GitHub, Vercel, Supabase, Kakao Developers 계정에는 2단계 인증을 사용하는 것을 권장합니다.
