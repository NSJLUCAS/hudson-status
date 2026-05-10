import { Fragment, useMemo } from 'react';
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import type { Node } from '@/lib/nodeget-types';
import {
  monthlyPriceUsd,
  formatMoney,
  usdToDisplayAmount,
  type DisplayCurrency,
} from '@/lib/billing-finance';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/** 与全局 chart 色板一致（CSS 变量） */
const PIE_FILLS = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
  'var(--color-chart-4)',
  'var(--color-chart-5)',
  'var(--color-primary)',
  'var(--color-accent)',
];

const BR_AXIS = {
  tick: { fill: 'var(--color-muted-foreground)', fontSize: 11 },
  axisLine: { stroke: 'var(--color-border)' },
};

function expireMonthKey(expireTime: string): string | null {
  if (!expireTime) return null;
  const d = new Date(expireTime);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function rolling12MonthKeys(): string[] {
  const out: string[] = [];
  const d = new Date();
  for (let i = 0; i < 12; i++) {
    const x = new Date(d.getFullYear(), d.getMonth() + i, 1);
    out.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

function monthShortLabel(key: string): string {
  const m = Number(key.split('-')[1]);
  return `${m}月`;
}

type ChartProps = {
  nodes: Node[];
  currency: DisplayCurrency;
  className?: string;
  /** 右侧栏窄高度专用：环形图 + 图例横向紧凑排版 */
  compact?: boolean;
};

export function BillingYearCostTrendCard({ nodes, currency, className }: ChartProps) {
  const trendData = useMemo(() => {
    const keys = rolling12MonthKeys();
    const bucket: Record<string, number> = {};
    keys.forEach((k) => {
      bucket[k] = 0;
    });

    for (const n of nodes) {
      const k = expireMonthKey(n.meta.expireTime);
      if (k && bucket[k] !== undefined) {
        bucket[k] += monthlyPriceUsd(n.meta);
      }
    }

    return keys.map((k) => ({
      key: k,
      label: monthShortLabel(k),
      amount: usdToDisplayAmount(bucket[k], currency),
    }));
  }, [nodes, currency]);

  return (
    <Card
      className={cn(
        'flex h-full flex-col border-border/80 bg-card shadow-sm ring-1 ring-border/40 backdrop-blur-sm',
        className
      )}
    >
      <CardHeader className="space-y-0.5 pb-2 pt-3">
        <CardTitle className="text-sm">一年成本趋势</CardTitle>
        <CardDescription className="text-[10px]">按到期月份汇总月度等价（滚动 12 个月）</CardDescription>
      </CardHeader>
      <CardContent className="min-h-[220px] flex-1 pt-0">
        <div className="h-[min(260px,32vh)] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trendData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--color-border)"
                opacity={0.5}
                vertical={false}
              />
              <XAxis dataKey="label" tick={BR_AXIS.tick} axisLine={BR_AXIS.axisLine} />
              <YAxis
                tick={BR_AXIS.tick}
                axisLine={BR_AXIS.axisLine}
                tickFormatter={(v) => formatMoney(Number(v), currency, 0)}
              />
              <Tooltip
                formatter={(v: number) => [formatMoney(v, currency), '月度等价']}
                labelFormatter={(l) => `${l}（到期分布）`}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div className="rounded-lg border border-border bg-popover px-2.5 py-2 text-xs text-popover-foreground shadow-md">
                      <div className="text-muted-foreground">{label}</div>
                      <div className="mt-0.5 font-mono tabular-nums">{formatMoney(Number(payload[0].value), currency)}</div>
                    </div>
                  );
                }}
              />
              <Bar
                dataKey="amount"
                radius={[4, 4, 0, 0]}
                fill="var(--color-chart-1)"
                maxBarSize={40}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

export function BillingCostPieCard({ nodes, currency, className, compact }: ChartProps) {
  const pieData = useMemo(() => {
    const rows = nodes
      .map((n) => ({
        name: n.meta.name || n.uuid.slice(0, 8),
        usd: monthlyPriceUsd(n.meta),
      }))
      .filter((r) => r.usd > 0)
      .sort((a, b) => b.usd - a.usd);

    if (rows.length === 0) return [];

    const top = rows.slice(0, 7);
    const rest = rows.slice(7);
    const restSum = rest.reduce((s, r) => s + r.usd, 0);
    const data = [...top];
    if (restSum > 0) data.push({ name: `其他 (${rest.length})`, usd: restSum });

    const total = data.reduce((s, d) => s + d.usd, 0);
    return data.map((d, i) => ({
      name: d.name,
      value: usdToDisplayAmount(d.usd, currency),
      pct: total > 0 ? (d.usd / total) * 100 : 0,
      fill: PIE_FILLS[i % PIE_FILLS.length],
    }));
  }, [nodes, currency]);

  const totalMonthly = useMemo(
    () => pieData.reduce((s, p) => s + p.value, 0),
    [pieData]
  );

  const tooltipPie = (
    <Tooltip
      content={({ active, payload }) => {
        if (!active || !payload?.[0]) return null;
        const d = payload[0].payload as { name: string; value: number; pct: number };
        return (
          <div className="rounded-lg border border-border bg-popover px-2 py-1.5 text-[10px] text-popover-foreground shadow-md">
            <div className="font-medium">{d.name}</div>
            <div className="mt-0.5 font-mono tabular-nums">
              {formatMoney(d.value, currency)} · {d.pct.toFixed(1)}%
            </div>
          </div>
        );
      }}
    />
  );

  /** 侧栏紧凑：悬停/点击只展示折算价 */
  const tooltipPieCompact = (
    <Tooltip
      content={({ active, payload }) => {
        if (!active || !payload?.[0]) return null;
        const d = payload[0].payload as { value: number };
        return (
          <div className="rounded-md border border-border bg-popover px-2 py-1 font-mono text-[11px] tabular-nums text-popover-foreground shadow-md">
            {formatMoney(d.value, currency)}
          </div>
        );
      }}
    />
  );

  if (compact) {
    const piePx = 120;
    return (
      <Card
        className={cn(
          'flex w-full flex-col overflow-hidden bg-transparent',
          className
        )}
      >
        <CardHeader className="flex shrink-0 flex-row flex-wrap items-center justify-between gap-1.5 space-y-0 border-b border-border/50 px-2 py-1 pb-1.5 pt-1">
          <CardTitle className="text-xs font-bold leading-tight">成本明细</CardTitle>
          {pieData.length > 0 && (
            <span className="rounded border border-border/50 bg-muted/50 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-muted-foreground">
              R · {String(Math.min(pieData.length, 99)).padStart(2, '0')}
            </span>
          )}
        </CardHeader>
        <CardContent className="flex flex-col px-2 pb-2 pt-1.5">
          {pieData.length === 0 ? (
            <div className="flex items-center justify-center py-4 text-xs text-muted-foreground">暂无费用数据</div>
          ) : (
            <div className="flex flex-row items-start gap-4">
              <div className="relative shrink-0 self-center" style={{ width: piePx, height: piePx }}>
                <ResponsiveContainer width={piePx} height={piePx}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius="52%"
                      outerRadius="100%"
                      paddingAngle={1}
                      stroke="var(--color-card)"
                      strokeWidth={1}
                      isAnimationActive={false}
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    {tooltipPieCompact}
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-1">
                  <p className="text-center font-mono text-xs font-bold tabular-nums leading-tight text-foreground">
                    {formatMoney(totalMonthly, currency)}
                  </p>
                  <p className="mt-0.5 text-[10px] leading-none text-muted-foreground">月度</p>
                </div>
              </div>
              <div className="max-h-[min(32vh,260px)] min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain pr-0.5">
                <div className="grid w-full min-w-0 grid-cols-[minmax(0,max-content)_minmax(5rem,max-content)_2.75rem] items-center gap-x-2 gap-y-1 text-[10px] leading-snug sm:gap-x-2.5 sm:text-[11px]">
                  {pieData.map((row, i) => (
                    <Fragment key={`${row.name}-${i}`}>
                      <div className="flex min-w-0 max-w-[min(100%,18rem)] items-center gap-1.5">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-sm border border-border/30"
                          style={{ backgroundColor: row.fill }}
                          aria-hidden
                        />
                        <span className="min-w-0 truncate font-medium text-foreground">{row.name}</span>
                      </div>
                      <span className="text-right font-mono tabular-nums text-muted-foreground">
                        {formatMoney(row.value, currency)}
                      </span>
                      <span className="text-right font-mono tabular-nums text-muted-foreground">
                        {Math.round(row.pct)}%
                      </span>
                    </Fragment>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        'flex h-full flex-col overflow-hidden border-border/80 bg-card shadow-sm ring-1 ring-border/40 backdrop-blur-sm',
        className
      )}
    >
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 border-b border-border/60 pb-3 pt-3">
        <CardTitle className="text-sm font-bold">成本明细</CardTitle>
        {pieData.length > 0 && (
          <span className="rounded-md border border-border/60 bg-muted/60 px-2 py-0.5 font-mono text-[10px] tabular-nums text-muted-foreground">
            R · {String(Math.min(pieData.length, 99)).padStart(2, '0')}
          </span>
        )}
      </CardHeader>
      <CardContent className="flex min-h-[240px] flex-1 flex-col pt-4">
        {pieData.length === 0 ? (
          <div className="flex flex-1 items-center justify-center py-12 text-xs text-muted-foreground">
            暂无费用数据
          </div>
        ) : (
          <div className="flex min-h-0 flex-col gap-4 sm:flex-row sm:items-stretch">
            <div className="relative mx-auto flex w-full max-w-[240px] shrink-0 flex-col items-center justify-center sm:mx-0 sm:w-[46%] sm:max-w-none">
              <div className="relative aspect-square w-full max-w-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius="58%"
                      outerRadius="88%"
                      paddingAngle={1}
                      stroke="var(--color-card)"
                      strokeWidth={1}
                      isAnimationActive={false}
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    {tooltipPie}
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pt-1">
                  <p className="text-center font-mono text-base font-bold tabular-nums leading-tight text-foreground sm:text-lg">
                    {formatMoney(totalMonthly, currency)}
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">月度</p>
                </div>
              </div>
            </div>

            <div className="min-h-0 min-w-0 flex-1 space-y-2 overflow-y-auto pr-0.5 sm:max-h-[280px]">
              {pieData.map((row, i) => (
                <div
                  key={`${row.name}-${i}`}
                  className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-x-2 gap-y-0.5 text-[11px] leading-tight"
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-sm border border-border/40 shadow-sm"
                    style={{ backgroundColor: row.fill }}
                    aria-hidden
                  />
                  <span className="min-w-0 truncate font-medium text-foreground">{row.name}</span>
                  <span className="shrink-0 text-right font-mono tabular-nums text-muted-foreground">
                    {formatMoney(row.value, currency)}
                  </span>
                  <span className="w-9 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
                    {Math.round(row.pct)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
