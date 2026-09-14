-- NVDA 매도 시뮬레이터 데이터베이스 스키마
-- Supabase SQL Editor에서 그대로 실행하세요.
-- 모든 테이블은 auth.uid() 기준으로 Row Level Security(RLS)가 적용되어
-- 로그인한 본인의 데이터만 읽고 쓸 수 있습니다.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- buy_lots: 매수 lot (실제 확정 거래 + 키움 체결알림 가져오기 + 미확인 조정분)
-- ---------------------------------------------------------------------------
create table if not exists public.buy_lots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  fill_date date, -- null 허용: 미확인 조정분(is_adjustment=true)은 정확한 날짜를 알 수 없음
  quantity integer not null check (quantity > 0),
  price_per_share_usd numeric(12, 4) not null check (price_per_share_usd >= 0),
  -- 매수 시점 세법상 원화 환율. 아직 어떤 lot에도 확보되지 않아 항상 null이지만,
  -- 추후 정확한 세금 계산을 위해 추가할 수 있도록 미리 컬럼을 마련해 둔다.
  acquisition_fx_rate numeric(12, 4),
  is_adjustment boolean not null default false, -- true = "미확인 조정분" (실제 체결 내역 아님)
  source text not null default 'manual' check (source in ('confirmed', 'kakao_import', 'manual')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.buy_lots is 'NVDA 매수 lot. is_adjustment=true인 행은 실제 체결이 확인되지 않은 수량 보정용이다.';

-- ---------------------------------------------------------------------------
-- sell_transactions: 실제 확정 매도 기록 (시뮬레이션 결과는 절대 저장하지 않음)
-- ---------------------------------------------------------------------------
create table if not exists public.sell_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  sell_date date not null,
  quantity integer not null check (quantity > 0),
  price_per_share_usd numeric(12, 4) not null check (price_per_share_usd >= 0),
  fx_rate numeric(12, 4) not null check (fx_rate > 0),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- portfolio_settings: 계좌 기준값 (키움증권 표시값이 항상 최우선)
-- ---------------------------------------------------------------------------
create table if not exists public.portfolio_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  broker_quantity integer not null default 2631,
  broker_avg_price_usd numeric(12, 4) not null default 139.84,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- simulation_settings: 세금/공제 기본값 및 사용자가 직접 입력하는 현재가/환율
-- ---------------------------------------------------------------------------
create table if not exists public.simulation_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  annual_deduction_krw numeric(14, 0) not null default 2500000,
  tax_rate_percent numeric(5, 4) not null default 0.22,
  prior_realized_gain_krw numeric(14, 0) not null default 0, -- 올해 기실현 손익 (2026년 기본값 0)
  last_price_usd numeric(12, 4),
  last_fx_rate numeric(12, 4),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_at 자동 갱신 트리거
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_updated_at on public.buy_lots;
create trigger set_updated_at before update on public.buy_lots
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.sell_transactions;
create trigger set_updated_at before update on public.sell_transactions
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.portfolio_settings;
create trigger set_updated_at before update on public.portfolio_settings
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.simulation_settings;
create trigger set_updated_at before update on public.simulation_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security: 본인 데이터만 조회/수정 가능
-- ---------------------------------------------------------------------------
alter table public.buy_lots enable row level security;
alter table public.sell_transactions enable row level security;
alter table public.portfolio_settings enable row level security;
alter table public.simulation_settings enable row level security;

drop policy if exists "buy_lots_select_own" on public.buy_lots;
create policy "buy_lots_select_own" on public.buy_lots
  for select using (auth.uid() = user_id);
drop policy if exists "buy_lots_insert_own" on public.buy_lots;
create policy "buy_lots_insert_own" on public.buy_lots
  for insert with check (auth.uid() = user_id);
drop policy if exists "buy_lots_update_own" on public.buy_lots;
create policy "buy_lots_update_own" on public.buy_lots
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "buy_lots_delete_own" on public.buy_lots;
create policy "buy_lots_delete_own" on public.buy_lots
  for delete using (auth.uid() = user_id);

drop policy if exists "sell_tx_select_own" on public.sell_transactions;
create policy "sell_tx_select_own" on public.sell_transactions
  for select using (auth.uid() = user_id);
drop policy if exists "sell_tx_insert_own" on public.sell_transactions;
create policy "sell_tx_insert_own" on public.sell_transactions
  for insert with check (auth.uid() = user_id);
drop policy if exists "sell_tx_update_own" on public.sell_transactions;
create policy "sell_tx_update_own" on public.sell_transactions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "sell_tx_delete_own" on public.sell_transactions;
create policy "sell_tx_delete_own" on public.sell_transactions
  for delete using (auth.uid() = user_id);

drop policy if exists "portfolio_settings_select_own" on public.portfolio_settings;
create policy "portfolio_settings_select_own" on public.portfolio_settings
  for select using (auth.uid() = user_id);
drop policy if exists "portfolio_settings_insert_own" on public.portfolio_settings;
create policy "portfolio_settings_insert_own" on public.portfolio_settings
  for insert with check (auth.uid() = user_id);
drop policy if exists "portfolio_settings_update_own" on public.portfolio_settings;
create policy "portfolio_settings_update_own" on public.portfolio_settings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "portfolio_settings_delete_own" on public.portfolio_settings;
create policy "portfolio_settings_delete_own" on public.portfolio_settings
  for delete using (auth.uid() = user_id);

drop policy if exists "simulation_settings_select_own" on public.simulation_settings;
create policy "simulation_settings_select_own" on public.simulation_settings
  for select using (auth.uid() = user_id);
drop policy if exists "simulation_settings_insert_own" on public.simulation_settings;
create policy "simulation_settings_insert_own" on public.simulation_settings
  for insert with check (auth.uid() = user_id);
drop policy if exists "simulation_settings_update_own" on public.simulation_settings;
create policy "simulation_settings_update_own" on public.simulation_settings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "simulation_settings_delete_own" on public.simulation_settings;
create policy "simulation_settings_delete_own" on public.simulation_settings
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 인덱스
-- ---------------------------------------------------------------------------
create index if not exists buy_lots_user_id_idx on public.buy_lots (user_id, fill_date);
create index if not exists sell_tx_user_id_idx on public.sell_transactions (user_id, sell_date);
