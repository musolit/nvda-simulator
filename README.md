# NVDA 매도 시뮬레이터

개인용 NVIDIA(NVDA) 보유 주식 매도 시뮬레이터. Next.js + TypeScript + Tailwind CSS +
Supabase(Auth/DB) 기반이며, Vercel에 그대로 배포할 수 있습니다.

## 기능

- 대시보드: 키움증권 계좌 기준 보유수량/평균매입가, 현재가·환율 입력 → 실시간 평가금액/손익/수익률
- 시뮬레이터: 매도수량 시뮬레이션(FIFO 취득원가/실현이익/세금/세후 확보금액), 목표현금 역산, 100/200/300/500/1000주 빠른 비교
- 거래내역: 실제 매수/매도 기록 CRUD, 키움 카카오톡 체결알림 텍스트 가져오기(파싱→미리보기→확인→저장)
- 설정: 세금/공제/계좌 기준값 설정, JSON 백업 다운로드/복구, CSV 내보내기
- Google 로그인(Supabase Auth) + `ADMIN_EMAILS` 환경변수 기반 허용 계정 제한
- 모든 데이터는 Supabase Postgres + Row Level Security로 사용자별로 분리 저장

## 처음 설정하기 (사용자가 직접 해야 하는 것)

### 1. Supabase 프로젝트 생성

1. https://supabase.com 에서 새 프로젝트를 만듭니다.
2. 프로젝트의 **SQL Editor**에서 `supabase/schema.sql` 파일 내용을 전체 실행합니다.
   (테이블, RLS 정책이 한 번에 생성됩니다.)
3. **Authentication → Providers → Google**을 켜고, Google Cloud Console에서 발급한
   OAuth Client ID/Secret을 입력합니다. Redirect URL은 Supabase가 알려주는 값
   (`https://<project>.supabase.co/auth/v1/callback`)을 Google Cloud Console의
   승인된 리디렉션 URI에 등록하세요.
4. **Authentication → URL Configuration**에서 Site URL과 Redirect URLs에 배포될
   앱 주소(`https://your-app.vercel.app`, 로컬 개발 시 `http://localhost:3000`)를
   추가합니다.
5. **Project Settings → API**에서 `Project URL`과 `anon public key`를 복사합니다.

### 2. 환경변수 설정

`.env.local.example`을 복사해 `.env.local`을 만들고 값을 채워주세요.

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
ADMIN_EMAILS=본인의구글이메일@gmail.com
```

`ADMIN_EMAILS`는 콤마로 여러 계정을 허용할 수 있고, 비워두면 로그인한 모든 계정을
허용합니다(개인용이므로 반드시 본인 이메일만 넣는 것을 권장합니다).

### 3. 로컬 실행

```
npm install
npm run dev
```

http://localhost:3000 접속 후 Google 로그인. 최초 로그인 시 확정 매수 lot(2,604주) +
미확인 조정분(27주)이 자동으로 계정에 시드됩니다.

### 4. Vercel 배포

Vercel에 이 저장소를 연결하고, 위 3개 환경변수(`NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `ADMIN_EMAILS`)를 Vercel 프로젝트 설정에도
동일하게 등록한 뒤 배포하면 됩니다. Supabase의 Redirect URLs에도 배포 도메인을
추가하는 것을 잊지 마세요.

## 데이터 기준

- 실제 키움증권 계좌 값(2,631주 / 평균매입가 $139.84)이 항상 최우선 표시 기준입니다.
- 카카오톡 체결알림에서 확인된 매수 lot 합계는 2,604주이며, 나머지 27주는 실제 체결
  내역을 확인할 수 없는 "미확인 조정분"으로 명확히 구분해 표시합니다. 이 조정분은
  FIFO 정렬상 항상 마지막에 위치하므로, 2,604주 이하를 매도하는 일반적인 시뮬레이션
  에는 영향을 주지 않습니다.
- 세금 계산은 실제 세무신고가 아닌 의사결정용 "예상치"입니다. 매수 시점의 세법상
  원화 환율 기록이 없어 사용자가 입력한 현재 환율을 일괄 적용하는 간편 추정 방식을
  사용합니다.

## 개발

```
npm run typecheck   # 타입 체크
npm run lint        # ESLint
npm test            # vitest (핵심 계산 로직 단위 테스트)
npm run build        # 프로덕션 빌드
```

핵심 계산 로직(FIFO, 세금, 목표현금 역산, 카카오 파서)은 `src/lib`에 UI와 분리되어
있고, `src/lib/**/__tests__`에 테스트가 있습니다.
