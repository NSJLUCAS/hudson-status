import { useMemo } from 'react';
import type { Node, NodeMeta } from '@/lib/nodeget-types';
import { remainingDays, remainingValue } from '@/lib/cost';
import type { DisplayCurrency } from '@/lib/billing-finance';
import {
  amountToUsd,
  detectCurrencyFromUnit,
  formatMoney,
  monthlyPriceInCurrency,
  usdToDisplayAmount,
} from '@/lib/billing-finance';
import { cn } from '@/lib/utils';
import { CountryFlag } from '@/components/CountryFlag';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { nodeDisplayName } from '@/lib/billing-utils';

/** 柔和暖色主题下的到期状态色（非荧光） */
function barTone(days: number | null): string {
  if (days == null) return 'bg-[#a89f93]/55';
  if (days < 0) return 'bg-[#7d6b62]';
  if (days < 7) return 'bg-[#b85440]';
  if (days <= 30) return 'bg-[#b8834a]';
  return 'bg-[#5c7a5e]';
}

type BillingTimelineProps = {
  nodes: Node[];
  currency: DisplayCurrency;
  /** 嵌入外层 Card 时不重复标题与双层边框 */
  embedded?: boolean;
  className?: string;
};

export function BillingTimeline({ nodes, currency, embedded = false, className }: BillingTimelineProps) {
  const maxDays = useMemo(() => {
    let m = 45;
    for (const n of nodes) {
      const d = remainingDays(n.meta.expireTime);
      if (d != null && d > 0) m = Math.max(m, d);
    }
    return Math.min(Math.max(m, 30), 730);
  }, [nodes]);

  return (
    <TooltipProvider delayDuration={180}>
      <div
        className={cn(
          embedded
            ? 'overflow-hidden bg-transparent'
            : 'overflow-hidden rounded-2xl border border-[#e5dcd0] bg-[#faf7f1] shadow-sm dark:border-[#3d3830] dark:bg-[#2a2620]',
          className
        )}
      >
        {!embedded && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e5dcd0] bg-[#f0e8dc]/80 px-4 py-3 dark:border-[#3d3830] dark:bg-[#322c26]">
            <div>
              <h3 className="text-sm font-semibold text-[#3d3429] dark:text-[#ebe4d9]">甘特时间轴 · Timeline</h3>
              <p className="mt-0.5 text-xs text-[#6b6158] dark:text-[#a89f93]">
                横条长度 ∝ 剩余天数（相对当前最长）；右侧为折算月费
              </p>
            </div>
            <div className="flex flex-wrap gap-3 text-[10px] text-[#6b6158] dark:text-[#a89f93]">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-4 rounded-sm bg-[#5c7a5e]" />
                &gt;30 天
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-4 rounded-sm bg-[#b8834a]" />
                7–30 天
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-4 rounded-sm bg-[#b85440]" />
                &lt;7 天
              </span>
            </div>
          </div>
        )}

        {embedded && (
          <div className="flex flex-wrap gap-3 border-b border-[#ebe4d8] px-1 py-2 text-[10px] text-[#8b8178] dark:border-[#3d3830]">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-3 rounded-sm bg-[#5c7a5e]" />
              &gt;30 天
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-3 rounded-sm bg-[#b8834a]" />
              7–30 天
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-3 rounded-sm bg-[#b85440]" />
              &lt;7 天
            </span>
          </div>
        )}

        <div className="max-h-[min(68vh,560px)] overflow-auto">
          {nodes.map((node) => {
            const meta = node.meta;
            const days = remainingDays(meta.expireTime);
            const rv = remainingValue(meta);
            const mo = monthlyPriceInCurrency(meta, currency);
            const pct =
              days != null && days > 0 ? Math.min(100, (days / maxDays) * 100) : days != null && days <= 0 ? 3 : 0;

            const daysText =
              days == null ? '未设置' : days < 0 ? `已过期 ${Math.abs(days)} 天` : `${days} 天`;
            const valueText =
              meta.price > 0 ? formatMoney(remainingValueDisplay(meta, rv, currency), currency) : '—';

            const tip = [
              nodeDisplayName(node),
              daysText,
              meta.price > 0 ? `剩余价值 ${valueText}` : '',
              mo > 0 ? `月费约 ${formatMoney(mo, currency)}` : '',
            ]
              .filter(Boolean)
              .join('\n');

            return (
              <div
                key={node.uuid}
                className="flex items-stretch border-b border-[#ebe4d8] last:border-0 dark:border-[#3a342e]"
              >
                <div className="flex w-[min(200px,38vw)] shrink-0 items-center gap-2 border-r border-[#ebe4d8] bg-[#f7f2ea]/90 px-3 py-2.5 dark:border-[#3d3830] dark:bg-[#2f2a24]">
                  <CountryFlag region={meta.region} size={18} />
                  <span className="truncate text-xs font-medium text-[#3d3429] dark:text-[#ebe4d9]">
                    {nodeDisplayName(node)}
                  </span>
                </div>

                <div className="relative min-w-0 flex-1 py-2.5 pl-3 pr-2">
                  <div className="flex h-8 items-center gap-3">
                    <div className="relative h-3 min-w-0 flex-1 overflow-hidden rounded-full bg-[#e8dfd4] dark:bg-[#3d3830]">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            className={cn(
                              'h-full rounded-full transition-[width] duration-500',
                              barTone(days),
                              days != null && days <= 0 && 'opacity-90'
                            )}
                            style={{ width: `${pct}%` }}
                          />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs whitespace-pre-line border-[#e5dcd0] bg-[#faf7f1] font-mono text-xs text-[#3d3429] dark:border-[#3d3830] dark:bg-[#2a2620] dark:text-[#ebe4d9]">
                          {tip}
                        </TooltipContent>
                      </Tooltip>
                    </div>

                    <div className="flex shrink-0 flex-col items-end justify-center gap-0.5 text-right sm:flex-row sm:items-center sm:gap-2">
                      <span
                        className={cn(
                          'font-mono text-[11px] tabular-nums',
                          days != null && days < 7 && days >= 0 && 'font-semibold text-[#9a3d2e] dark:text-[#d4877a]',
                          days != null && days >= 7 && days <= 30 && 'text-[#8b5c2e] dark:text-[#c9a574]',
                          days != null && days > 30 && 'text-[#4d6b50] dark:text-[#8faa92]'
                        )}
                      >
                        {daysText}
                      </span>
                      <span className="hidden h-3 w-px bg-[#d4c9bc] sm:block dark:bg-[#4a433c]" />
                      <span className="font-mono text-[11px] tabular-nums text-[#5c534a] dark:text-[#c4bbb0]">
                        {mo > 0 ? `${formatMoney(mo, currency)}/月` : '—'}
                      </span>
                      <span className="hidden font-mono text-[10px] tabular-nums text-[#8b8178] dark:text-[#8b8178] md:inline">
                        余 {valueText}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </TooltipProvider>
  );
}

function remainingValueDisplay(meta: NodeMeta, rv: number, target: DisplayCurrency): number {
  if (rv <= 0) return 0;
  const from = detectCurrencyFromUnit(meta.priceUnit || '$');
  const usd = amountToUsd(rv, from);
  return usdToDisplayAmount(usd, target);
}
