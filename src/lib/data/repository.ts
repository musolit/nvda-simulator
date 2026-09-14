import { createClient } from "@/lib/supabase/client";
import { ADJUSTMENT_LOT, BROKER_PORTFOLIO_SETTINGS, CONFIRMED_BUY_LOTS } from "@/lib/seedData";
import { DEFAULT_ANNUAL_DEDUCTION_KRW, DEFAULT_TAX_RATE_PERCENT } from "@/lib/tax";
import type { BuyLot, PortfolioSettings, SellTransaction } from "@/lib/types";

export interface SimulationSettingsRow {
  annualDeductionKrw: number;
  taxRatePercent: number;
  priorRealizedGainKrw: number;
  lastPriceUsd: number | null;
  lastFxRate: number | null;
}

interface BuyLotDbRow {
  id: string;
  fill_date: string | null;
  quantity: number;
  price_per_share_usd: number;
  acquisition_fx_rate: number | null;
  is_adjustment: boolean;
  source: string;
  note: string | null;
}

interface SellTxDbRow {
  id: string;
  sell_date: string;
  quantity: number;
  price_per_share_usd: number;
  fx_rate: number;
  note: string | null;
}

function rowToBuyLot(row: BuyLotDbRow): BuyLot {
  return {
    id: row.id,
    date: row.fill_date,
    quantity: row.quantity,
    pricePerShareUsd: Number(row.price_per_share_usd),
    acquisitionFxRate: row.acquisition_fx_rate !== null ? Number(row.acquisition_fx_rate) : null,
    isAdjustment: row.is_adjustment,
    source: row.source as BuyLot["source"],
    note: row.note,
  };
}

function rowToSellTx(row: SellTxDbRow): SellTransaction {
  return {
    id: row.id,
    date: row.sell_date,
    quantity: row.quantity,
    pricePerShareUsd: Number(row.price_per_share_usd),
    fxRate: Number(row.fx_rate),
    note: row.note,
  };
}

/**
 * Ensures a fresh account has its rows: the known confirmed buy lots + the
 * clearly-flagged adjustment lot, plus default settings rows. Only runs
 * once per user (checks buy_lots is empty first) and never overwrites
 * existing data.
 */
export async function ensureSeeded(userId: string): Promise<void> {
  const supabase = createClient();

  const { count, error: countError } = await supabase
    .from("buy_lots")
    .select("id", { count: "exact", head: true });
  if (countError) throw countError;

  if (!count || count === 0) {
    const seedRows = [...CONFIRMED_BUY_LOTS, ...(ADJUSTMENT_LOT ? [ADJUSTMENT_LOT] : [])].map(
      (lot) => ({
        user_id: userId,
        fill_date: lot.date,
        quantity: lot.quantity,
        price_per_share_usd: lot.pricePerShareUsd,
        acquisition_fx_rate: lot.acquisitionFxRate,
        is_adjustment: lot.isAdjustment,
        source: lot.source,
        note: lot.note ?? null,
      })
    );
    const { error } = await supabase.from("buy_lots").insert(seedRows);
    if (error) throw error;
  }

  const { data: settingsData, error: settingsError } = await supabase
    .from("portfolio_settings")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (settingsError) throw settingsError;
  if (!settingsData) {
    const { error } = await supabase.from("portfolio_settings").insert({
      user_id: userId,
      broker_quantity: BROKER_PORTFOLIO_SETTINGS.brokerQuantity,
      broker_avg_price_usd: BROKER_PORTFOLIO_SETTINGS.brokerAvgPriceUsd,
    });
    if (error) throw error;
  }

  const { data: simData, error: simError } = await supabase
    .from("simulation_settings")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (simError) throw simError;
  if (!simData) {
    const { error } = await supabase.from("simulation_settings").insert({
      user_id: userId,
      annual_deduction_krw: DEFAULT_ANNUAL_DEDUCTION_KRW,
      tax_rate_percent: DEFAULT_TAX_RATE_PERCENT,
      prior_realized_gain_krw: 0,
    });
    if (error) throw error;
  }
}

export async function fetchBuyLots(): Promise<BuyLot[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("buy_lots")
    .select("id, fill_date, quantity, price_per_share_usd, acquisition_fx_rate, is_adjustment, source, note")
    .order("fill_date", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data as BuyLotDbRow[]).map(rowToBuyLot);
}

export async function fetchSellTransactions(): Promise<SellTransaction[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("sell_transactions")
    .select("id, sell_date, quantity, price_per_share_usd, fx_rate, note")
    .order("sell_date", { ascending: true });
  if (error) throw error;
  return (data as SellTxDbRow[]).map(rowToSellTx);
}

export async function fetchPortfolioSettings(): Promise<PortfolioSettings> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("portfolio_settings")
    .select("broker_quantity, broker_avg_price_usd")
    .single();
  if (error) throw error;
  return {
    brokerQuantity: data.broker_quantity,
    brokerAvgPriceUsd: Number(data.broker_avg_price_usd),
  };
}

export async function updatePortfolioSettings(
  userId: string,
  patch: Partial<PortfolioSettings>
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("portfolio_settings")
    .update({
      ...(patch.brokerQuantity !== undefined ? { broker_quantity: patch.brokerQuantity } : {}),
      ...(patch.brokerAvgPriceUsd !== undefined
        ? { broker_avg_price_usd: patch.brokerAvgPriceUsd }
        : {}),
    })
    .eq("user_id", userId);
  if (error) throw error;
}

export async function fetchSimulationSettings(): Promise<SimulationSettingsRow> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("simulation_settings")
    .select("annual_deduction_krw, tax_rate_percent, prior_realized_gain_krw, last_price_usd, last_fx_rate")
    .single();
  if (error) throw error;
  return {
    annualDeductionKrw: Number(data.annual_deduction_krw),
    taxRatePercent: Number(data.tax_rate_percent),
    priorRealizedGainKrw: Number(data.prior_realized_gain_krw),
    lastPriceUsd: data.last_price_usd !== null ? Number(data.last_price_usd) : null,
    lastFxRate: data.last_fx_rate !== null ? Number(data.last_fx_rate) : null,
  };
}

export async function updateSimulationSettings(
  userId: string,
  patch: Partial<SimulationSettingsRow>
): Promise<void> {
  const supabase = createClient();
  const payload: Record<string, unknown> = {};
  if (patch.annualDeductionKrw !== undefined) payload.annual_deduction_krw = patch.annualDeductionKrw;
  if (patch.taxRatePercent !== undefined) payload.tax_rate_percent = patch.taxRatePercent;
  if (patch.priorRealizedGainKrw !== undefined)
    payload.prior_realized_gain_krw = patch.priorRealizedGainKrw;
  if (patch.lastPriceUsd !== undefined) payload.last_price_usd = patch.lastPriceUsd;
  if (patch.lastFxRate !== undefined) payload.last_fx_rate = patch.lastFxRate;

  const { error } = await supabase.from("simulation_settings").update(payload).eq("user_id", userId);
  if (error) throw error;
}

export interface NewBuyLotInput {
  date: string | null;
  quantity: number;
  pricePerShareUsd: number;
  source?: BuyLot["source"];
  note?: string | null;
}

export async function addBuyLot(userId: string, input: NewBuyLotInput): Promise<BuyLot> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("buy_lots")
    .insert({
      user_id: userId,
      fill_date: input.date,
      quantity: input.quantity,
      price_per_share_usd: input.pricePerShareUsd,
      is_adjustment: false,
      source: input.source ?? "manual",
      note: input.note ?? null,
    })
    .select("id, fill_date, quantity, price_per_share_usd, acquisition_fx_rate, is_adjustment, source, note")
    .single();
  if (error) throw error;
  return rowToBuyLot(data as BuyLotDbRow);
}

export async function updateBuyLot(
  id: string,
  patch: { date?: string | null; quantity?: number; pricePerShareUsd?: number; note?: string | null }
): Promise<void> {
  const supabase = createClient();
  const payload: Record<string, unknown> = {};
  if (patch.date !== undefined) payload.fill_date = patch.date;
  if (patch.quantity !== undefined) payload.quantity = patch.quantity;
  if (patch.pricePerShareUsd !== undefined) payload.price_per_share_usd = patch.pricePerShareUsd;
  if (patch.note !== undefined) payload.note = patch.note;
  const { error } = await supabase.from("buy_lots").update(payload).eq("id", id);
  if (error) throw error;
}

export async function deleteBuyLot(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("buy_lots").delete().eq("id", id);
  if (error) throw error;
}

export interface NewSellTxInput {
  date: string;
  quantity: number;
  pricePerShareUsd: number;
  fxRate: number;
  note?: string | null;
}

export async function addSellTransaction(
  userId: string,
  input: NewSellTxInput
): Promise<SellTransaction> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("sell_transactions")
    .insert({
      user_id: userId,
      sell_date: input.date,
      quantity: input.quantity,
      price_per_share_usd: input.pricePerShareUsd,
      fx_rate: input.fxRate,
      note: input.note ?? null,
    })
    .select("id, sell_date, quantity, price_per_share_usd, fx_rate, note")
    .single();
  if (error) throw error;
  return rowToSellTx(data as SellTxDbRow);
}

export async function updateSellTransaction(
  id: string,
  patch: {
    date?: string;
    quantity?: number;
    pricePerShareUsd?: number;
    fxRate?: number;
    note?: string | null;
  }
): Promise<void> {
  const supabase = createClient();
  const payload: Record<string, unknown> = {};
  if (patch.date !== undefined) payload.sell_date = patch.date;
  if (patch.quantity !== undefined) payload.quantity = patch.quantity;
  if (patch.pricePerShareUsd !== undefined) payload.price_per_share_usd = patch.pricePerShareUsd;
  if (patch.fxRate !== undefined) payload.fx_rate = patch.fxRate;
  if (patch.note !== undefined) payload.note = patch.note;
  const { error } = await supabase.from("sell_transactions").update(payload).eq("id", id);
  if (error) throw error;
}

export async function deleteSellTransaction(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("sell_transactions").delete().eq("id", id);
  if (error) throw error;
}

export interface BackupData {
  exportedAt: string;
  buyLots: BuyLot[];
  sellTransactions: SellTransaction[];
  portfolioSettings: PortfolioSettings;
  simulationSettings: SimulationSettingsRow;
}

export async function exportBackup(): Promise<BackupData> {
  const [buyLots, sellTransactions, portfolioSettings, simulationSettings] = await Promise.all([
    fetchBuyLots(),
    fetchSellTransactions(),
    fetchPortfolioSettings(),
    fetchSimulationSettings(),
  ]);
  return {
    exportedAt: new Date().toISOString(),
    buyLots,
    sellTransactions,
    portfolioSettings,
    simulationSettings,
  };
}

/**
 * Restores a backup by inserting buy lots / sell transactions that aren't
 * already present (matched by id) and upserting the settings rows. Does not
 * delete anything, so restoring is safe to run more than once.
 */
export async function importBackup(userId: string, backup: BackupData): Promise<void> {
  const supabase = createClient();

  const existingLots = await fetchBuyLots();
  const existingLotIds = new Set(existingLots.map((l) => l.id));
  const lotsToInsert = backup.buyLots
    .filter((lot) => !existingLotIds.has(lot.id))
    .map((lot) => ({
      user_id: userId,
      fill_date: lot.date,
      quantity: lot.quantity,
      price_per_share_usd: lot.pricePerShareUsd,
      acquisition_fx_rate: lot.acquisitionFxRate,
      is_adjustment: lot.isAdjustment,
      source: lot.source,
      note: lot.note ?? null,
    }));
  if (lotsToInsert.length > 0) {
    const { error } = await supabase.from("buy_lots").insert(lotsToInsert);
    if (error) throw error;
  }

  const existingSells = await fetchSellTransactions();
  const existingSellIds = new Set(existingSells.map((s) => s.id));
  const sellsToInsert = backup.sellTransactions
    .filter((tx) => !existingSellIds.has(tx.id))
    .map((tx) => ({
      user_id: userId,
      sell_date: tx.date,
      quantity: tx.quantity,
      price_per_share_usd: tx.pricePerShareUsd,
      fx_rate: tx.fxRate,
      note: tx.note ?? null,
    }));
  if (sellsToInsert.length > 0) {
    const { error } = await supabase.from("sell_transactions").insert(sellsToInsert);
    if (error) throw error;
  }

  await updatePortfolioSettings(userId, backup.portfolioSettings);
  await updateSimulationSettings(userId, backup.simulationSettings);
}
