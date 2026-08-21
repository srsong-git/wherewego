# 오늘 어디가지? 👟

서울·수도권에서 아이와 함께 갈 만한 장소를 조건에 따라 추천하는 React + Vite 웹사이트입니다.

## 주요 기능

- 날씨, 아이 연령, 소요 시간, 비용, 테마 검색
- 100개 장소 데이터와 결과 내 필터
- 현재 위치 기준 직선거리 계산 및 가까운 순 정렬
- 장소 상세보기와 랜덤 추천
- 브라우저에 저장되는 찜하기
- 카카오 로그인과 장소별 가족 후기
- 우리 아이 반응, 재방문 의사, 아이 연령별 후기 요약

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

## 카카오 로그인과 후기 데이터베이스 설정

후기는 Supabase의 Auth와 PostgreSQL을 사용합니다. Supabase 프로젝트를 만든 뒤 SQL Editor에서 `supabase/migrations/202608210001_create_reviews.sql`을 실행합니다.

Supabase 프로젝트의 Authentication > Providers > Kakao에서 다음 값을 등록합니다.

- Client ID: 카카오 REST API 키
- Client Secret: 카카오 로그인 Client Secret
- Allow users without an email: 활성화

카카오 개발자 콘솔에서는 카카오 로그인을 켜고, REST API 키의 Redirect URI에 Supabase가 안내하는 Callback URL을 등록합니다. 동의항목은 닉네임만 사용하며 이메일은 필수가 아닙니다.

Supabase Authentication의 Redirect URL 허용 목록에는 다음 주소를 등록합니다.

```text
http://127.0.0.1:5173/
https://wherewego-zeta.vercel.app/
```

프로젝트 루트의 `.env.local`과 Vercel Environment Variables에 다음 값을 추가합니다.

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
```

`service_role` 키와 카카오 Client Secret은 프런트엔드 환경변수나 GitHub에 넣지 않습니다.
