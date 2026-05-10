import type { NodeMeta } from '@/lib/nodeget-types';

const DAY_MS = 86400000;

/** 距离到期日的天数（可为负表示已过期）；无到期日返回 null */
export function remainingDays(expireTime: string): number | null {
  if (!expireTime) return null;
  const exp = new Date(expireTime).setHours(0, 0, 0, 0);
  if (!Number.isFinite(exp)) return null;
  const today = new Date().setHours(0, 0, 0, 0);
  return Math.round((exp - today) / DAY_MS);
}

/** 按剩余天数占计费周期的比例估算剩余价值（未过期且已配置价格时） */
export function remainingValue(meta: NodeMeta): number {
  if (!meta.price || meta.price <= 0) return 0;
  const cycle = meta.priceCycle;
  if (!cycle || cycle <= 0) return 0;
  const days = remainingDays(meta.expireTime);
  if (days == null || days <= 0) return 0;
  const ratio = Math.min(days / cycle, 1);
  return meta.price * ratio;
}

/** 当前计费周期内剩余进度 0–100（用于进度条） */
export function cycleProgress(meta: NodeMeta): number {
  const cycle = meta.priceCycle;
  if (!cycle || cycle <= 0) return 0;
  const days = remainingDays(meta.expireTime);
  if (days == null) return 0;
  if (days <= 0) return 0;
  if (days >= cycle) return 100;
  return Math.round((days / cycle) * 100);
}

export function hasCost(meta: NodeMeta): boolean {
  return meta.price > 0 || !!meta.expireTime;
}
