import type { NodeMeta } from '@/lib/nodeget-types';
import { remainingValue } from '@/lib/cost';

/** 展示用币种（静态汇率折算，仅作估算） */
export type DisplayCurrency = 'USD' | 'CNY' | 'EUR' | 'GBP';

/** 1 单位当地货币 ≈ 多少 USD（近似快照，便于横向对比） */
const UNIT_IN_USD: Record<DisplayCurrency, number> = {
  USD: 1,
  CNY: 0.138,
  EUR: 1.08,
  GBP: 1.27,
};

export function detectCurrencyFromUnit(priceUnit: string): DisplayCurrency {
  const u = (priceUnit || '').trim();
  if (/¥|￥|CNY|元/i.test(u)) return 'CNY';
  if (/€|EUR/i.test(u)) return 'EUR';
  if (/£|GBP/i.test(u)) return 'GBP';
  return 'USD';
}

export function amountToUsd(amount: number, from: DisplayCurrency): number {
  return amount * UNIT_IN_USD[from];
}

export function usdToDisplayAmount(usd: number, to: DisplayCurrency): number {
  if (to === 'USD') return usd;
  return usd / UNIT_IN_USD[to];
}

const SYMBOLS: Record<DisplayCurrency, string> = {
  USD: '$',
  CNY: '¥',
  EUR: '€',
  GBP: '£',
};

export function formatMoney(amount: number, currency: DisplayCurrency, fractionDigits = 2): string {
  const sym = SYMBOLS[currency];
  const n = amount.toFixed(fractionDigits);
  return `${sym}${n}`;
}

/** 折算到 USD 的月度等价费用（按 price / priceCycle 推到 30 天） */
export function monthlyPriceUsd(meta: NodeMeta): number {
  if (!meta.price || meta.price <= 0 || !meta.priceCycle || meta.priceCycle <= 0) return 0;
  const monthlyInUnit = meta.price * (30 / meta.priceCycle);
  const c = detectCurrencyFromUnit(meta.priceUnit || '$');
  return amountToUsd(monthlyInUnit, c);
}

export function yearlyPriceUsd(meta: NodeMeta): number {
  return monthlyPriceUsd(meta) * 12;
}

/** 单次计费周期标价（未摊销）折算 USD */
export function cyclePriceUsd(meta: NodeMeta): number {
  if (!meta.price || meta.price <= 0) return 0;
  return amountToUsd(meta.price, detectCurrencyFromUnit(meta.priceUnit || '$'));
}

export function cyclePriceInCurrency(meta: NodeMeta, target: DisplayCurrency): number {
  return usdToDisplayAmount(cyclePriceUsd(meta), target);
}

export function monthlyPriceInCurrency(meta: NodeMeta, target: DisplayCurrency): number {
  return usdToDisplayAmount(monthlyPriceUsd(meta), target);
}

export function yearlyPriceInCurrency(meta: NodeMeta, target: DisplayCurrency): number {
  return monthlyPriceInCurrency(meta, target) * 12;
}

/** 当前周期内剩余价值（本币标价 × 剩余比例）折算为 USD，便于汇总 */
export function remainingValueUsd(meta: NodeMeta): number {
  const raw = remainingValue(meta);
  if (raw <= 0) return 0;
  return amountToUsd(raw, detectCurrencyFromUnit(meta.priceUnit || '$'));
}
