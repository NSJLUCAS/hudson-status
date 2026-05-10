import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { BackendPool } from '@/lib/backend-pool';
import type { Node } from '@/lib/nodeget-types';
import { buildLatencyChart, computeLatencyStats, type LatencyStats } from '@/lib/latency';
import { useNodePingData } from '@/hooks/useNodeLatency';
import { cn } from '@/lib/utils';

const TOOLTIP_STYLE: CSSProperties = {
  backgroundColor: 'var(--color-popover)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius)',
  fontSize: 12,
  color: 'var(--color-popover-foreground)',
};

const ms = (v: number) => `${v.toFixed(1)} ms`;

const ONE_HOUR_MS = 60 * 60 * 1000;

function useMinWidthSm() {
  const [sm, setSm] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 640px)');
    const apply = () => setSm(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);
  return sm;
}

export function NodePingSection({
  pool,
  node,
  windowMs = ONE_HOUR_MS,
  title = 'Ping · 近 1 小时',
  chartHeightClass = 'h-36',
  hideTitle = false,
  variant = 'card',
  hideStats = false,
}: {
  pool: BackendPool | null;
  node: Pick<Node, 'uuid' | 'source'>;
  windowMs?: number;
  title?: string;
  chartHeightClass?: string;
  hideTitle?: boolean;
  variant?: 'card' | 'plain';
  hideStats?: boolean;
}) {
  const { pingData, loading } = useNodePingData(pool, node.source, node.uuid, windowMs);
  const type = 'ping' as const;

  const { data, series } = useMemo(() => buildLatencyChart(pingData, type), [pingData]);
  const stats = useMemo(() => computeLatencyStats(pingData, type), [pingData]);
  const smUp = useMinWidthSm();
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const empty = data.length === 0;
  const visibleSeries = series.filter((s) => !hidden.has(s.name));

  const toggle = (name: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  if (!pool) return null;

  return (
    <div
      className={cn(
        variant === 'card' && 'border-t border-dashed border-border pt-3'
      )}
    >
      {!hideTitle && (
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground sm:text-xs">
            {title}
          </span>
          {!empty && loading && (
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary animate-pulse" />
          )}
        </div>
      )}
      <div className={cn('relative', chartHeightClass)}>
        {hideTitle && !empty && loading && (
          <div className="pointer-events-none absolute top-1 right-1 z-10 h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
        )}
        {empty && (
          <div className="absolute inset-0 flex items-center justify-center px-2 text-center text-xs text-muted-foreground sm:text-sm">
            {loading ? '加载中…' : '暂无 ping 数据'}
          </div>
        )}
        {!empty && (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{
                top: 6,
                right: smUp ? 6 : 2,
                left: 0,
                bottom: smUp ? 4 : 10,
              }}
            >
              <XAxis
                dataKey="t"
                type="number"
                domain={['dataMin', 'dataMax']}
                scale="time"
                tickFormatter={(t) => {
                  const d = new Date(Number(t));
                  return smUp
                    ? d.toLocaleTimeString()
                    : d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
                }}
                tick={{ fontSize: smUp ? 11 : 10 }}
                stroke="var(--color-muted-foreground)"
                interval="preserveStartEnd"
              />
              <YAxis
                tickFormatter={(v) => `${v}ms`}
                tick={{ fontSize: smUp ? 11 : 10 }}
                stroke="var(--color-muted-foreground)"
                width={smUp ? 44 : 42}
                domain={['auto', 'auto']}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                labelFormatter={(t) => new Date(Number(t)).toLocaleTimeString()}
                formatter={(v: number) => ms(Number(v))}
              />
              {visibleSeries.map((s) => (
                <Line
                  key={s.name}
                  type="monotone"
                  dataKey={s.name}
                  stroke={s.color}
                  strokeWidth={1.25}
                  dot={false}
                  connectNulls
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {!hideStats && stats.length > 0 && (
        <div className="mt-2 max-h-[min(40vh,8.5rem)] overflow-y-auto overflow-x-auto border-t border-border/60 pt-2 [scrollbar-width:thin] sm:max-h-[5.5rem]">
          <div className="flex min-w-[260px] items-center px-1 pb-1 text-[10px] text-muted-foreground sm:min-w-0 sm:text-[11px]">
            <span className="flex-1">来源</span>
            <span className="w-[3.5rem] shrink-0 text-right sm:w-[3.25rem]">平均</span>
            <span className="w-[3.25rem] shrink-0 text-right sm:w-12">抖动</span>
            <span className="w-12 shrink-0 text-right sm:w-11">丢包</span>
          </div>
          <div className="min-w-[260px] space-y-0.5 sm:min-w-0">
            {stats.map((s) => (
              <LatencyStatsRow key={s.name} stat={s} hidden={hidden.has(s.name)} onToggle={() => toggle(s.name)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LatencyStatsRow({
  stat,
  hidden,
  onToggle,
}: {
  stat: LatencyStats;
  hidden: boolean;
  onToggle: () => void;
}) {
  const { name, color, avg, jitter, lossRate } = stat;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          onToggle();
        }
      }}
      className={cn(
        'flex touch-manipulation cursor-pointer select-none items-center rounded px-1 py-1.5 text-[10px] transition-colors hover:bg-muted/60 active:bg-muted/70 sm:py-0.5 sm:text-[11px]',
        hidden && 'opacity-35'
      )}
    >
      <span className="flex min-w-0 flex-1 items-center gap-1.5">
        <span className="inline-block h-0.5 w-3 shrink-0 rounded-full" style={{ background: color }} />
        <span className="truncate">{name}</span>
      </span>
      <span className="w-[3.5rem] shrink-0 text-right font-mono tabular-nums sm:w-[3.25rem]">
        {avg != null ? ms(avg) : '—'}
      </span>
      <span className="w-[3.25rem] shrink-0 text-right font-mono tabular-nums sm:w-12">
        {jitter != null ? ms(jitter) : '—'}
      </span>
      <span className={cn('w-12 shrink-0 text-right font-mono tabular-nums sm:w-11', lossRate >= 5 && 'font-medium text-red-500')}>
        {lossRate.toFixed(1)}%
      </span>
    </div>
  );
}
