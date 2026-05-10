import { useMemo, type CSSProperties } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { format } from 'date-fns';
import type { BackendPool } from '@/lib/backend-pool';
import type { Node } from '@/lib/nodeget-types';
import { useNodePingData } from '@/hooks/useNodeLatency';
import { cn } from '@/lib/utils';
import { Activity } from 'lucide-react';

const TOOLTIP_STYLE: CSSProperties = {
  backgroundColor: 'var(--color-popover)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius)',
  fontSize: 11,
  color: 'var(--color-popover-foreground)',
};

function normalizeTs(ts: number) {
  return ts < 1_000_000_000_000 ? ts * 1000 : ts;
}

const WINDOW_DEFAULT_MS = 6 * 60 * 60 * 1000;

/**
 * 基于近期 ICMP Ping 任务结果绘制可达性阶梯图，并汇总探测可用率。
 * 与详情页「Ping · 近 6 小时」使用同一时间窗时可对照查看。
 */
export function NodeOnlineStatsChart({
  pool,
  node,
  windowMs = WINDOW_DEFAULT_MS,
  fillColumn = false,
  className,
}: {
  pool: BackendPool | null;
  node: Pick<Node, 'uuid' | 'source' | 'online'>;
  windowMs?: number;
  /** 在等高双列布局中占满剩余高度，图表区域随列拉伸 */
  fillColumn?: boolean;
  className?: string;
}) {
  const { pingData, loading } = useNodePingData(pool, node.source, node.uuid, windowMs);

  const { chartData, availability, samples } = useMemo(() => {
    const chartData = pingData
      .map((r) => ({
        t: normalizeTs(r.timestamp),
        online: r.success ? 100 : 0,
      }))
      .sort((a, b) => a.t - b.t);
    const ok = pingData.filter((r) => r.success).length;
    const availability =
      pingData.length > 0 ? Math.round((ok / pingData.length) * 1000) / 10 : null;
    return { chartData, availability, samples: pingData.length };
  }, [pingData]);

  const empty = chartData.length === 0;
  const hours = Math.round(windowMs / 3600000);

  if (!pool) {
    return (
      <div
        className={cn(
          'rounded-lg border border-dashed border-border bg-muted/15 px-3 py-6 text-center text-[11px] text-muted-foreground',
          fillColumn && 'flex flex-col justify-center lg:min-h-[120px] lg:flex-1',
          className
        )}
      >
        未连接后端池，无法展示在线探测记录
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-muted/20 p-3',
        fillColumn && 'flex min-h-0 flex-col lg:flex-1',
        className
      )}
    >
      <div className="mb-2 flex shrink-0 flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Activity className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              在线情况 · Ping 探测
            </div>
            <div className="text-[9px] text-muted-foreground/90">
              成功视为可达（100），失败视为不可达（0），近 {hours} 小时
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 text-[10px]">
          <span
            className={cn(
              'rounded-full px-2 py-0.5 font-semibold',
              node.online
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                : 'bg-slate-500/15 text-muted-foreground'
            )}
          >
            面板：{node.online ? '在线' : '离线'}
          </span>
          {!empty && availability != null && (
            <span className="font-mono tabular-nums text-muted-foreground">
              探测可用率{' '}
              <span className="font-semibold text-foreground">{availability}%</span>
              <span className="text-muted-foreground/80">（{samples} 次）</span>
            </span>
          )}
        </div>
      </div>

      <div
        className={cn(
          'relative w-full',
          fillColumn ? 'min-h-[140px] lg:min-h-[120px] lg:flex-1' : 'h-[140px]'
        )}
      >
        {loading && empty && (
          <div className="absolute inset-0 flex items-center justify-center text-[10px] text-muted-foreground">
            加载中…
          </div>
        )}
        {!loading && empty && (
          <div className="absolute inset-0 flex items-center justify-center text-[10px] text-muted-foreground">
            暂无 Ping 探测数据（请确认后端已写入 ping 任务）
          </div>
        )}
        {!empty && (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 6, right: 6, left: 0, bottom: 2 }}>
              <defs>
                <linearGradient id="onlineProbeFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgb(66 185 131)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="rgb(66 185 131)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.25} vertical={false} />
              <XAxis
                dataKey="t"
                type="number"
                domain={['dataMin', 'dataMax']}
                scale="time"
                tickFormatter={(t) => format(new Date(Number(t)), 'HH:mm')}
                tick={{ fontSize: 9 }}
                stroke="var(--color-muted-foreground)"
                height={22}
              />
              <YAxis
                domain={[0, 100]}
                ticks={[0, 100]}
                tickFormatter={(v) => (Number(v) >= 50 ? '可达' : '不可达')}
                width={48}
                tick={{ fontSize: 9 }}
                stroke="var(--color-muted-foreground)"
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                labelFormatter={(label) =>
                  label != null ? format(new Date(Number(label)), 'yyyy-MM-dd HH:mm:ss') : ''
                }
                formatter={(value: number) => [
                  Number(value) >= 50 ? '探测成功（可达）' : '探测失败（不可达）',
                  'Ping',
                ]}
              />
              <Area
                type="stepAfter"
                dataKey="online"
                stroke="rgb(66 185 131)"
                strokeWidth={2}
                fill="url(#onlineProbeFill)"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
