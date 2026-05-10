import { useMemo } from 'react';
import type { Node, NodeMeta } from '@/lib/nodeget-types';
import { cycleProgress, remainingDays } from '@/lib/cost';
import type { DisplayCurrency } from '@/lib/billing-finance';
import { cyclePriceInCurrency, formatMoney } from '@/lib/billing-finance';
import { nodeDisplayName } from '@/lib/billing-utils';
import { cn } from '@/lib/utils';
import { CountryFlag } from '@/components/CountryFlag';
import { Progress } from '@/components/ui/progress';

function renewalLabel(meta: NodeMeta, currency: DisplayCurrency): string {
  if (meta.price > 0 && meta.priceCycle > 0) {
    return `${formatMoney(cyclePriceInCurrency(meta, currency), currency)} / ${meta.priceCycle}天`;
  }
  if (meta.price > 0) return formatMoney(cyclePriceInCurrency(meta, currency), currency);
  return '—';
}

function tierBucket(days: number | null): 't7' | 't14' | 't30' | null {
  if (days == null || days < 0) return null;
  if (days <= 7) return 't7';
  if (days <= 14) return 't14';
  if (days <= 30) return 't30';
  return null;
}

type BillingNodeListProps = {
  nodes: Node[];
  currency: DisplayCurrency;
  className?: string;
};

export function BillingNodeList({ nodes, currency, className }: BillingNodeListProps) {
  return (
    <div
      className={cn(
        'flex min-h-[min(62vh,520px)] flex-col overflow-hidden rounded-xl border border-border/60 bg-card/80 shadow-sm ring-1 ring-border/40 backdrop-blur-sm',
        className
      )}
    >
      <div className="border-b border-border bg-muted/40 px-3 py-2">
        <h2 className="text-xs font-bold text-foreground">节点列表</h2>
        <p className="text-[10px] text-muted-foreground">续费价格为当前计费周期标价（折算展示币种）</p>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="min-w-[720px]">
          <div className="sticky top-0 z-10 grid grid-cols-[minmax(0,1.2fr)_minmax(0,0.65fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.85fr)] gap-2 border-b border-border bg-card/95 px-3 py-1.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur-sm">
            <span>节点名称</span>
            <span>地区</span>
            <span>续费价格</span>
            <span>本周期剩余</span>
            <span className="text-right">到期日期</span>
          </div>

          {nodes.map((node) => {
            const meta = node.meta;
            const days = remainingDays(meta.expireTime);
            const pct = cycleProgress(meta);
            return (
              <div
                key={node.uuid}
                className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,0.65fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.85fr)] gap-2 border-b border-border/60 px-3 py-2 text-[11px] transition-colors last:border-0 hover:bg-muted/30"
              >
                <div className="flex min-w-0 items-center gap-2 font-medium text-foreground">
                  <CountryFlag region={meta.region} size={16} />
                  <span className="truncate">{nodeDisplayName(node)}</span>
                </div>
                <span className="truncate text-muted-foreground">{meta.region || '—'}</span>
                <span className="truncate font-mono tabular-nums text-foreground/90">{renewalLabel(meta, currency)}</span>
                <div className="min-w-0 space-y-1">
                  <Progress value={pct} className="h-2 bg-muted" />
                  <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                    {days == null ? '—' : days < 0 ? `已过期 ${Math.abs(days)}天` : `${days} 天后`}
                  </span>
                </div>
                <span className="text-right font-mono tabular-nums text-muted-foreground">{meta.expireTime || '—'}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** 续费时间线列表列宽（与表头一致） */
const EXPIRY_LINE_GRID =
  'grid grid-cols-[minmax(0,1fr)_minmax(0,4.5rem)_minmax(0,6.5rem)_3.5rem] gap-2 items-center';

type TierAccent = 'urgent' | 'soon' | 'later';

const TIER_ACCENTS: Record<TierAccent, { section: string; title: string; days: string }> = {
  urgent: {
    section: 'bg-destructive/[0.07]',
    title: 'text-destructive',
    days: 'text-destructive',
  },
  soon: {
    section: 'bg-amber-500/[0.09]',
    title: 'text-amber-800 dark:text-amber-300',
    days: 'text-amber-800 dark:text-amber-300',
  },
  later: {
    section: 'bg-emerald-600/[0.06]',
    title: 'text-emerald-800 dark:text-emerald-400',
    days: 'text-emerald-800 dark:text-emerald-400',
  },
};

type ExpiryTierBlockProps = {
  title: string;
  subtitle: string;
  accent: TierAccent;
  nodes: Node[];
  /** 为 true 时占满父容器剩余高度，列表区域可滚动（用于最后一个分层） */
  absorbRemainder?: boolean;
};

function ExpiryTierBlock({ title, subtitle, accent, nodes, absorbRemainder }: ExpiryTierBlockProps) {
  const a = TIER_ACCENTS[accent];
  return (
    <section
      className={cn(
        'flex min-h-0 flex-col border-b border-border last:border-b-0',
        absorbRemainder ? 'min-h-[7rem] flex-1' : 'shrink-0',
        a.section
      )}
    >
      <div className="shrink-0 border-b border-border/60 px-3 py-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className={cn('text-[11px] font-bold', a.title)}>{title}</span>
          <span className={cn('font-mono text-[10px] tabular-nums', a.title)}>{nodes.length}</span>
        </div>
        <p className="mt-0.5 text-[9px] text-muted-foreground">{subtitle}</p>
      </div>
      <ul
        className={cn(
          'divide-y divide-border/35',
          absorbRemainder ? 'min-h-0 flex-1 overflow-auto' : 'max-h-52 overflow-y-auto'
        )}
      >
        {nodes.length === 0 ? (
          <li className="px-3 py-4 text-center text-[10px] text-muted-foreground">暂无</li>
        ) : (
          nodes.map((node) => {
            const meta = node.meta;
            const days = remainingDays(meta.expireTime);
            return (
              <li key={node.uuid} className={cn(EXPIRY_LINE_GRID, 'px-2 py-1.5 text-[11px] sm:px-3')}>
                <div className="flex min-w-0 items-center gap-1.5">
                  <CountryFlag region={meta.region} size={14} />
                  <span className="truncate font-medium text-foreground">{nodeDisplayName(node)}</span>
                </div>
                <span className="truncate text-muted-foreground">{meta.region?.trim() || '—'}</span>
                <span className="truncate font-mono text-[10px] tabular-nums text-muted-foreground">
                  {meta.expireTime?.trim() || '—'}
                </span>
                <span className={cn('text-right font-mono text-[10px] font-semibold tabular-nums', a.days)}>
                  {days == null ? '—' : days < 0 ? `已过期 ${Math.abs(days)}天` : `${days} 天`}
                </span>
              </li>
            );
          })
        )}
      </ul>
    </section>
  );
}

type BillingExpiryTiersProps = {
  nodes: Node[];
  className?: string;
};

export function BillingExpiryTiers({ nodes, className }: BillingExpiryTiersProps) {
  const buckets = useMemo(() => {
    const t7: Node[] = [];
    const t14: Node[] = [];
    const t30: Node[] = [];
    for (const n of nodes) {
      const d = remainingDays(n.meta.expireTime);
      const b = tierBucket(d);
      if (b === 't7') t7.push(n);
      else if (b === 't14') t14.push(n);
      else if (b === 't30') t30.push(n);
    }
    const sortSoon = (a: Node, b: Node) => {
      const da = remainingDays(a.meta.expireTime) ?? 9999;
      const db = remainingDays(b.meta.expireTime) ?? 9999;
      return da - db;
    };
    t7.sort(sortSoon);
    t14.sort(sortSoon);
    t30.sort(sortSoon);
    return { t7, t14, t30 };
  }, [nodes]);

  return (
    <div
      className={cn(
        'flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border/60 bg-card/90 shadow-sm ring-1 ring-border/40',
        className
      )}
    >
      <div
        className={cn(
          EXPIRY_LINE_GRID,
          'border-b border-border bg-muted/25 px-3 py-1 text-[9px] font-semibold tracking-wide text-muted-foreground'
        )}
      >
        <span>节点名称</span>
        <span>区域</span>
        <span>到期日</span>
        <span className="text-right">剩余天数</span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <ExpiryTierBlock
          accent="urgent"
          title="7 天内到期"
          subtitle="剩余 1–7 天"
          nodes={buckets.t7}
        />
        <ExpiryTierBlock
          accent="soon"
          title="14 天内到期"
          subtitle="剩余 8–14 天"
          nodes={buckets.t14}
        />
        <ExpiryTierBlock
          accent="later"
          title="30 天内到期"
          subtitle="剩余 15–30 天"
          nodes={buckets.t30}
          absorbRemainder
        />
      </div>
    </div>
  );
}
