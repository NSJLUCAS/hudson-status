/**
 * 首页：地图、节点卡片、详情弹窗与侧栏统计。
 */
import { useState, useEffect, useCallback, useMemo, type ComponentProps } from 'react';
import { useConfig } from '@/hooks/useConfig';
import { useNodes } from '@/hooks/useNodes';
import { Node, DynamicSummary, HistorySample } from '@/lib/nodeget-types';
import { formatBytes, formatTraffic, formatUptime, cpuLabel, osLabel, kernelLabel, hostNameLabel, virtLabel, getStatusLevel } from '@/lib/nodeget-utils';
import { ThemeToggle } from '@/components/ThemeToggle';
import { SiteBrandIcon } from '@/components/SiteBrandIcon';
import { Clock, AlertTriangle, Wifi, Server, Cpu, HardDrive, MemoryStick, Globe, Activity, X, ArrowDown, ArrowUp, List, Radio, Receipt, Home, Calculator } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ResourceRing } from '@/components/ResourceRing';
import { WorldMap } from '@/components/WorldMap';
import { CountryFlag } from '@/components/CountryFlag';
import { NodePingSection } from '@/components/NodePingSection';
import { NodeOnlineStatsChart } from '@/components/NodeOnlineStatsChart';
import type { BackendPool } from '@/lib/backend-pool';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Link, useLocation } from 'react-router-dom';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { DisplayCurrency } from '@/lib/billing-finance';
import {
  cyclePriceUsd,
  remainingValueUsd,
  formatMoney,
  usdToDisplayAmount,
  cyclePriceInCurrency,
} from '@/lib/billing-finance';
import { hasCost } from '@/lib/cost';
import {
  siteHeaderInner,
  siteMainContent,
  siteHeaderShell,
  siteHeaderTitle,
  siteNavBilling,
  siteNavHome,
  siteNavNodehub,
} from '@/lib/site-header';

function tsToMs(ts: number): number {
  return ts < 1e12 ? ts * 1000 : ts;
}

function getMemUsage(d: DynamicSummary | null): number {
  if (!d?.total_memory) return 0;
  return ((d.used_memory ?? 0) / d.total_memory) * 100;
}

function getDiskUsage(d: DynamicSummary | null): number {
  if (!d?.total_space) return 0;
  return ((d.total_space - (d.available_space ?? 0)) / d.total_space) * 100;
}

function getSwapUsage(d: DynamicSummary | null): number {
  if (!d?.total_swap) return 0;
  return ((d.used_swap ?? 0) / d.total_swap) * 100;
}

type ServerListFilter = 'all' | 'online' | 'offline';
type ServerListSort = 'order' | 'load' | 'uptime' | 'memory' | 'name';

const SERVER_LIST_SORT_TABS: { value: ServerListSort; label: string }[] = [
  { value: 'order', label: '默认' },
  { value: 'load', label: '负载' },
  { value: 'uptime', label: '时长' },
  { value: 'memory', label: '内存' },
  { value: 'name', label: '名称' },
];

function loadSortKey(n: Node): number {
  if (!n.online || !n.dynamic) return -1;
  return n.dynamic.load_one ?? 0;
}

function uptimeSortKey(n: Node): number {
  if (!n.online || !n.dynamic) return -1;
  return n.dynamic.uptime ?? 0;
}

function compareNodesForList(a: Node, b: Node, sort: ServerListSort): number {
  let c = 0;
  switch (sort) {
    case 'name':
      return (a.meta.name || a.uuid).localeCompare(b.meta.name || b.uuid, 'zh-CN');
    case 'load':
      c = loadSortKey(b) - loadSortKey(a);
      break;
    case 'uptime':
      c = uptimeSortKey(b) - uptimeSortKey(a);
      break;
    case 'memory':
      c = getMemUsage(b.dynamic) - getMemUsage(a.dynamic);
      break;
    case 'order':
    default: {
      const oa = a.meta.order ?? 0;
      const ob = b.meta.order ?? 0;
      c = oa - ob;
      if (c !== 0) return c;
      return (a.meta.name || a.uuid).localeCompare(b.meta.name || b.uuid, 'zh-CN');
    }
  }
  if (c !== 0) return c;
  return a.uuid.localeCompare(b.uuid);
}

function SegmentGroup({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      role="group"
      className={cn(
        'inline-flex min-w-0 max-w-full flex-wrap items-center gap-0.5 rounded-lg border border-border bg-muted/25 p-0.5',
        className
      )}
    >
      {children}
    </div>
  );
}

function SegmentTab({ active, className, children, ...rest }: ComponentProps<'button'> & { active: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        'rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors',
        active
          ? 'bg-background text-primary shadow-sm'
          : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
        className
      )}
      aria-pressed={active}
      {...rest}
    >
      {children}
    </button>
  );
}

function StatusIndicator({ status, size = 'md' }: { status: 'operational' | 'degraded' | 'down'; size?: 'sm' | 'md' | 'lg' }) {
  const sizeMap = { sm: 'w-2 h-2', md: 'w-2.5 h-2.5', lg: 'w-3 h-3' };
  const colorMap = {
    operational: 'bg-emerald-500',
    degraded: 'bg-amber-500',
    down: 'bg-red-500',
  };
  const labelMap = { operational: '运行中', degraded: '性能降级', down: '离线' };

  return (
    <div className="inline-flex items-center gap-2">
      <div className="relative flex items-center justify-center">
        {status !== 'down' && (
          <div className={cn('absolute rounded-full animate-pulse-ring opacity-75', sizeMap[size], colorMap[status])} />
        )}
        <div className={cn('relative rounded-full animate-pulse-dot', sizeMap[size], colorMap[status])} />
      </div>
      {size !== 'sm' && (
        <span className={cn('text-sm font-medium',
          status === 'operational' && 'text-emerald-600 dark:text-emerald-400',
          status === 'degraded' && 'text-amber-600 dark:text-amber-400',
          status === 'down' && 'text-red-600 dark:text-red-400'
        )}>{labelMap[status]}</span>
      )}
    </div>
  );
}

function ProgressBar({ value, max = 100, label, detail, size = 'md' }: {
  value: number; max?: number; label?: string; detail?: string; size?: 'sm' | 'md';
}) {
  const pct = Math.min(Math.max(0, (value / max) * 100), 100);
  const barColor = pct > 90 ? 'bg-destructive' : pct > 70 ? 'bg-accent' : 'bg-primary';
  return (
    <div className="w-full space-y-1">
      {label && (
        <div className="flex items-center justify-between">
          <span className={cn('font-medium text-foreground', size === 'sm' ? 'text-xs' : 'text-sm')}>{label}</span>
          <span className={cn('text-muted-foreground font-mono', size === 'sm' ? 'text-[10px]' : 'text-xs')}>{detail || `${Math.round(pct)}%`}</span>
        </div>
      )}
      <div className={cn('w-full bg-muted rounded-full overflow-hidden', size === 'sm' ? 'h-1.5' : 'h-2')}>
        <div className={cn(barColor, 'h-full rounded-full transition-all duration-700 ease-out')} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function NetworkChart({ data, height = 160 }: { data: HistorySample[]; height?: number }) {
  if (data.length < 2) return <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">暂无网络数据</div>;
  const chartData = data.map(d => ({
    time: format(new Date(tsToMs(d.t)), 'HH:mm'),
    in: d.netIn,
    out: d.netOut,
  }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={chartData}>
        <defs>
          <linearGradient id="chartIn" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="chartOut" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.3} />
        <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }} axisLine={{ stroke: 'var(--color-border)' }} tickLine={false} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }} axisLine={false} tickLine={false} tickFormatter={(v) => formatBytes(v)} width={60} />
        <Tooltip
          contentStyle={{ backgroundColor: 'var(--color-popover)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', fontSize: '12px', color: 'var(--color-foreground)' }}
          formatter={(value: number, name: string) => [formatBytes(value), name === 'in' ? '↓ 入站' : '↑ 出站']}
        />
        <Area type="monotone" dataKey="in" stroke="var(--color-primary)" strokeWidth={2} fill="url(#chartIn)" name="in" animationDuration={800} />
        <Area type="monotone" dataKey="out" stroke="var(--color-accent)" strokeWidth={2} fill="url(#chartOut)" name="out" animationDuration={800} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function NodeCard({
  node,
  index,
  onOpen,
  pool,
}: {
  node: Node;
  index: number;
  onOpen: () => void;
  pool: BackendPool | null;
}) {
  const d = node.dynamic;
  const cpuUsage = d?.cpu_usage ?? 0;
  const memUsage = getMemUsage(d);
  const diskUsage = getDiskUsage(d);
  const swapUsage = getSwapUsage(d);

  const displayName = node.meta.name || hostNameLabel(node.static) || node.uuid.slice(0, 8);
  const cpuInfo = cpuLabel(node.static);
  const osName = osLabel(node.static);
  const hostName = hostNameLabel(node.static);
  const virt = virtLabel(node.meta, node.static);
  const tags = Array.isArray(node.meta.tags) ? node.meta.tags : [];

  return (
    <div
      onClick={node.online ? onOpen : undefined}
      role={node.online ? 'button' : undefined}
      tabIndex={node.online ? 0 : undefined}
      onKeyDown={
        node.online
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onOpen();
              }
            }
          : undefined
      }
      title={!node.online ? '服务器离线，无法打开详情' : undefined}
      aria-disabled={!node.online}
      className={cn(
        'group h-full min-h-0 rounded-lg border border-border',
        'p-3 sm:p-4 transition-[border-color,box-shadow,background-color] duration-200',
        'flex flex-col gap-2.5 sm:gap-3',
        node.online && [
          'cursor-pointer bg-card',
          'hover:border-primary/90 hover:bg-card hover:shadow-[0_0_0_1px_rgba(66,185,131,0.32),0_12px_28px_rgba(15,23,42,0.06)]',
        ],
        !node.online && [
          'relative overflow-hidden',
          'pointer-events-none cursor-not-allowed bg-muted/30 opacity-[0.72]',
          'border-border/70 shadow-none',
          'hover:border-border/70 hover:bg-muted/30 hover:shadow-none',
        ]
      )}
      style={{
        animation: `fade-in 0.5s ease-out ${index * 100}ms forwards`,
        opacity: 0,
      }}
    >
      <div className="flex items-start gap-2 border-b border-dashed border-border pb-2">
        <StatusDot online={node.online} />
        <CountryFlag region={node.meta.region} size={26} />
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="truncate text-[13px] sm:text-sm font-black tracking-wide text-foreground" title={displayName}>
            {displayName}
          </div>
          {(osName || virt) && (
            <div className="truncate text-[10px] font-semibold text-muted-foreground" title={[osName, virt].filter(Boolean).join(' · ')}>
              {[osName, virt].filter(Boolean).join(' · ')}
            </div>
          )}
        </div>
      </div>

      {node.online && (
        <div className="flex flex-wrap justify-center items-start gap-x-7 gap-y-2 py-1.5 sm:gap-x-10">
          <ResourceRing
            label="CPU"
            value={cpuUsage}
            sub={cpuInfo || null}
            size={64}
            strokeWidth={8}
          />
          <ResourceRing
            label="内存"
            value={memUsage}
            sub={d?.total_memory ? `${formatBytes(d.used_memory ?? 0)} / ${formatBytes(d.total_memory)}` : null}
            size={64}
            strokeWidth={8}
          />
          <ResourceRing
            label="磁盘"
            value={diskUsage}
            sub={d?.total_space ? `${formatBytes((d.total_space ?? 0) - (d.available_space ?? 0))} / ${formatBytes(d.total_space)}` : null}
            size={64}
            strokeWidth={8}
          />
        </div>
      )}

      <NodePingSection pool={pool} node={node} chartHeightClass="h-28" hideStats />

      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-dashed border-border pt-2 font-mono text-[10px] text-muted-foreground">
        {node.online && d && (
          <>
            <span className="inline-flex items-center gap-1 text-primary">
              <ArrowDown className="h-3 w-3 shrink-0" />
              {formatBytes(d.receive_speed ?? 0)}/s
            </span>
            <span className="inline-flex items-center gap-1 text-accent">
              <ArrowUp className="h-3 w-3 shrink-0" />
              {formatBytes(d.transmit_speed ?? 0)}/s
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3 shrink-0" />
              {formatUptime(d.uptime ?? 0)}
            </span>
          </>
        )}
        <span className={cn(node.online && d ? 'ml-auto' : '')}>{node.meta.region || '—'}</span>
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.slice(0, 6).map((t) => (
            <span
              key={t}
              className="rounded-full border border-border bg-secondary px-1.5 py-0.5 text-[9px] font-extrabold text-muted-foreground hover:border-primary hover:text-primary transition-colors"
            >
              {t}
            </span>
          ))}
          {tags.length > 6 && (
            <span className="px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground">+{tags.length - 6}</span>
          )}
        </div>
      )}

      {!node.online && (
        <>
          <div className="pointer-events-none absolute inset-0 z-[2] flex flex-col items-center justify-center gap-2 px-4 text-center">
            <span className="text-lg font-black tracking-wide text-destructive/65 drop-shadow-[0_1px_2px_rgba(0,0,0,0.08)] dark:drop-shadow-none">
              服务器离线
            </span>
          </div>
          <div
            className="pointer-events-none absolute inset-0 z-[10] rounded-[inherit]"
            aria-hidden
            style={{
              backgroundImage: [
                'repeating-linear-gradient(-45deg, color-mix(in oklch, var(--color-foreground) 30%, transparent) 0px, color-mix(in oklch, var(--color-foreground) 30%, transparent) 1px, transparent 1px, transparent 6px)',
                'linear-gradient(to bottom, color-mix(in oklch, var(--color-muted) 45%, transparent), color-mix(in oklch, var(--color-muted) 58%, transparent))',
              ].join(', '),
            }}
          />
        </>
      )}
    </div>
  );
}

function StatusDot({ online }: { online: boolean }) {
  return (
    <div className="relative flex items-center justify-center shrink-0">
      {online && (
        <div className="absolute w-2 h-2 rounded-full bg-emerald-500 animate-pulse-ring" />
      )}
      <div className={cn(
        'relative w-2 h-2 rounded-full',
        online ? 'bg-emerald-500 animate-pulse-dot' : 'bg-slate-400'
      )} />
    </div>
  );
}

function NodeDetailResourceRing(props: ComponentProps<typeof ResourceRing>) {
  return (
    <div className="flex w-full flex-col items-center justify-start">
      <div className="flex justify-center origin-top scale-[0.92] max-[380px]:scale-[0.88] sm:origin-center sm:scale-100">
        <ResourceRing {...props} />
      </div>
    </div>
  );
}

function NodeDetailDialog({ node, pool, open, onOpenChange }: { node: Node | null; pool: BackendPool | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  if (!node) return null;

  const d = node.dynamic;
  const cpuUsage = d?.cpu_usage ?? 0;
  const memUsage = getMemUsage(d);
  const diskUsage = getDiskUsage(d);
  const swapUsage = getSwapUsage(d);
  const swapRingActive = !!(d?.total_swap && d.used_swap != null);

  const displayName = node.meta.name || hostNameLabel(node.static) || node.uuid.slice(0, 8);
  const cpuInfo = cpuLabel(node.static);
  const osName = osLabel(node.static);
  const kernel = kernelLabel(node.static);
  const hostName = hostNameLabel(node.static);
  const virt = virtLabel(node.meta, node.static);
  const tags = Array.isArray(node.meta.tags) ? node.meta.tags : [];
  const level = getStatusLevel(node);
  const levelDot = level === 'operational' ? 'bg-emerald-500' : level === 'degraded' ? 'bg-amber-500' : 'bg-red-500';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[1400px] max-h-[min(90vh,90dvh)] overflow-y-auto overscroll-contain p-0 gap-0">
        <div className="flex items-center gap-3 px-5 sm:px-6 py-4 border-b border-dashed border-border">
          <CountryFlag region={node.meta.region} size={42} className="shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-lg font-black leading-7 tracking-wide text-foreground truncate">{displayName}</span>
              <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', levelDot)} />
            </div>
            <div className="text-xs text-muted-foreground font-mono mt-0.5">
              {node.meta.region}{hostName ? ` · ${hostName}` : ''}{osName ? ` · ${osName}` : ''}
            </div>
          </div>
        </div>

        {!node.online && (
          <div className="p-8 flex items-center justify-center">
            <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg text-center">
              <Server className="w-8 h-8 text-destructive mx-auto mb-2" />
              <span className="text-sm text-destructive font-medium">服务器离线</span>
            </div>
          </div>
        )}

        {node.online && d && (
          <div className="p-4 sm:p-6 space-y-5">
            <div className="grid w-full grid-cols-2 justify-items-center gap-x-5 gap-y-7 sm:grid-cols-4 sm:gap-x-5 sm:gap-y-5">
              <NodeDetailResourceRing
                label="CPU"
                value={cpuUsage}
                sub={`负载 ${(d.load_one ?? 0).toFixed(2)} / ${(d.load_five ?? 0).toFixed(2)} / ${(d.load_fifteen ?? 0).toFixed(2)}`}
                size={80}
                strokeWidth={10}
              />
              <NodeDetailResourceRing
                label="内存"
                value={memUsage}
                sub={`${formatBytes(d.used_memory ?? 0)} / ${formatBytes(d.total_memory ?? 0)}`}
                size={80}
                strokeWidth={10}
              />
              <NodeDetailResourceRing
                label="磁盘"
                value={diskUsage}
                sub={`${formatBytes((d.total_space ?? 0) - (d.available_space ?? 0))} / ${formatBytes(d.total_space ?? 0)}`}
                size={80}
                strokeWidth={10}
              />
              <NodeDetailResourceRing
                label="Swap"
                value={swapRingActive ? swapUsage : 0}
                inactive={!swapRingActive}
                sub={
                  swapRingActive
                    ? `${formatBytes(d.used_swap ?? 0)} / ${formatBytes(d.total_swap ?? 0)}`
                    : '未启用'
                }
                size={80}
                strokeWidth={10}
              />
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:items-stretch">
              <div className="flex flex-col gap-3 lg:h-full lg:min-h-0">
                <h4 className="shrink-0 text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <Server className="w-3.5 h-3.5" />
                  系统信息
                </h4>
                <div className="min-h-0 rounded-lg border border-border bg-muted/20 divide-y divide-border/50 lg:flex-1">
                  <DetailRow label="系统" value={osName || '—'} />
                  <DetailRow label="处理器" value={cpuInfo || '—'} />
                  <DetailRow label="区域" value={node.meta.region || '—'} />
                  <DetailRow label="运行时间" value={formatUptime(d.uptime ?? 0)} />
                  <DetailRow label="进程数" value={d.process_count ? String(d.process_count) : '—'} />
                  <DetailRow label="连接数" value={d.tcp_connections || d.udp_connections ? `TCP ${d.tcp_connections ?? '—'} / UDP ${d.udp_connections ?? '—'}` : '—'} />
                  {virt && <DetailRow label="虚拟化" value={virt} />}
                  {kernel && <DetailRow label="内核" value={kernel} />}
                  {d.total_swap > 0 && (d.used_swap ?? 0) > 0 && (
                    <DetailRow label="交换分区" value={`${formatBytes(d.used_swap ?? 0)} / ${formatBytes(d.total_swap ?? 0)} (${swapUsage.toFixed(1)}%)`} />
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-3 lg:h-full lg:min-h-0">
                <h4 className="shrink-0 text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <Wifi className="w-3.5 h-3.5" />
                  流量统计
                </h4>
                <div className="grid shrink-0 grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-border bg-muted/20 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <ArrowDown className="w-4 h-4 text-primary" />
                        <span className="text-xs font-bold text-muted-foreground">总入站</span>
                      </div>
                      <span className="text-xs text-muted-foreground font-mono">
                        ↓ {formatBytes(d.receive_speed ?? 0)}
                      </span>
                    </div>
                    <div className="text-2xl font-black font-mono text-foreground">
                      {formatTraffic(d.total_received ?? 0)}
                    </div>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/20 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <ArrowUp className="w-4 h-4 text-accent" />
                        <span className="text-xs font-bold text-muted-foreground">总出站</span>
                      </div>
                      <span className="text-xs text-muted-foreground font-mono">
                        ↑ {formatBytes(d.transmit_speed ?? 0)}
                      </span>
                    </div>
                    <div className="text-2xl font-black font-mono text-foreground">
                      {formatTraffic(d.total_transmitted ?? 0)}
                    </div>
                  </div>
                </div>

                <div className="flex min-h-0 flex-col lg:min-h-0 lg:flex-1">
                  <NodeOnlineStatsChart
                    pool={pool}
                    node={node}
                    windowMs={6 * 60 * 60 * 1000}
                    fillColumn
                  />
                </div>
              </div>
            </div>

            {node.history.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5" />
                  网络历史
                </h4>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><div className="w-3 h-0.5 bg-primary rounded" />入站</span>
                  <span className="flex items-center gap-1"><div className="w-3 h-0.5 bg-accent rounded" />出站</span>
                </div>
                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <NetworkChart data={node.history} />
                </div>
              </div>
            )}

            {pool && (
              <div className="space-y-2">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground sm:text-xs flex items-center gap-2">
                  <Radio className="h-3.5 w-3.5 shrink-0" />
                  Ping · 近 6 小时
                </h4>
                <div className="rounded-lg border border-border bg-muted/20 p-2 sm:p-4">
                  <NodePingSection
                    pool={pool}
                    node={node}
                    windowMs={6 * 60 * 60 * 1000}
                    variant="plain"
                    hideTitle
                    chartHeightClass="min-h-[184px] h-[clamp(11.5rem,42vmin,13rem)] sm:h-52"
                  />
                </div>
              </div>
            )}

            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-2 border-t border-dashed border-border">
                {tags.map((t) => (
                  <span
                    key={t}
                    className="rounded-full border border-border bg-secondary px-2.5 py-1 text-[10px] font-extrabold text-muted-foreground"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className="text-xs text-foreground font-mono truncate ml-4">{value}</span>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className="text-xs text-foreground font-mono truncate">{value}</span>
    </div>
  );
}

function StatusOverview({ nodes }: { nodes: Node[] }) {
  const online = nodes.filter((n) => n.online);
  const offline = nodes.filter((n) => !n.online);
  const degraded = nodes.filter((n) => n.online && getStatusLevel(n) === 'degraded');

  if (nodes.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
        当前视图下暂无节点
      </div>
    );
  }

  const denom = nodes.length;

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 bg-card rounded-lg border border-border">
      <div className="flex items-center gap-3">
        <div className={cn('w-10 h-10 rounded-full flex items-center justify-center',
          offline.length > 0 ? 'bg-destructive/20' :
          degraded.length > 0 ? 'bg-accent/20' :
          'bg-emerald-500/20'
        )}>
          {offline.length > 0 ? (
            <AlertTriangle className="w-5 h-5 text-destructive" />
          ) : degraded.length > 0 ? (
            <AlertTriangle className="w-5 h-5 text-accent" />
          ) : (
            <div className="w-3 h-3 rounded-full bg-emerald-500" />
          )}
        </div>
        <div>
          <div className="font-bold text-foreground">
            {offline.length > 0 ? '部分服务异常' : degraded.length > 0 ? '部分服务降级' : '全部服务正常'}
          </div>
          <div className="text-xs text-muted-foreground">更新于 {new Date().toLocaleTimeString('zh-CN')}</div>
        </div>
      </div>
      <div className="hidden sm:block w-px h-10 bg-border" />
      <div className="flex gap-4 text-sm">
        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500" /><span className="text-muted-foreground">正常</span><span className="font-bold text-foreground">{online.length - degraded.length}</span></div>
        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-amber-500" /><span className="text-muted-foreground">降级</span><span className="font-bold text-foreground">{degraded.length}</span></div>
        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-red-500" /><span className="text-muted-foreground">离线</span><span className="font-bold text-foreground">{offline.length}</span></div>
      </div>
      <div className="flex-1 w-full sm:w-auto">
        <div className="flex h-2 rounded-full overflow-hidden bg-muted">
          {online.length - degraded.length > 0 && (
            <div
              className="bg-emerald-500 transition-all duration-500"
              style={{ width: `${((online.length - degraded.length) / denom) * 100}%` }}
            />
          )}
          {degraded.length > 0 && (
            <div className="bg-amber-500 transition-all duration-500" style={{ width: `${(degraded.length / denom) * 100}%` }} />
          )}
          {offline.length > 0 && (
            <div className="bg-red-500 transition-all duration-500" style={{ width: `${(offline.length / denom) * 100}%` }} />
          )}
        </div>
      </div>
    </div>
  );
}

const SIDEBAR_BW_HISTORY = 45;

function SidebarRealtimeBandwidth({ nodes }: { nodes: Node[] }) {
  const [samples, setSamples] = useState<{ t: number; in: number; out: number }[]>([]);

  useEffect(() => {
    const online = nodes.filter((n) => n.online);
    const totalNetIn = online.reduce((s, n) => s + (n.dynamic?.receive_speed ?? 0), 0);
    const totalNetOut = online.reduce((s, n) => s + (n.dynamic?.transmit_speed ?? 0), 0);
    setSamples((prev) => {
      const next = [...prev, { t: Date.now(), in: totalNetIn, out: totalNetOut }];
      if (next.length > SIDEBAR_BW_HISTORY) next.splice(0, next.length - SIDEBAR_BW_HISTORY);
      return next;
    });
  }, [nodes]);

  const current = useMemo(() => {
    const online = nodes.filter((n) => n.online);
    const totalNetIn = online.reduce((s, n) => s + (n.dynamic?.receive_speed ?? 0), 0);
    const totalNetOut = online.reduce((s, n) => s + (n.dynamic?.transmit_speed ?? 0), 0);
    return {
      totalNetIn,
      totalNetOut,
      sum: totalNetIn + totalNetOut,
    };
  }, [nodes]);

  const chartData = useMemo(
    () =>
      samples.map((p) => ({
        label: format(new Date(p.t), 'HH:mm:ss'),
        in: p.in,
        out: p.out,
      })),
    [samples]
  );

  const chartReady = chartData.length >= 2;

  return (
    <div
      className="rounded-lg border border-border bg-card p-3 transition-all duration-300 hover:shadow-md hover:border-primary/30"
      style={{ animation: 'fade-in 0.4s ease-out 400ms forwards', opacity: 0 }}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <div className="shrink-0 rounded-md bg-muted/30 p-1.5">
            <Wifi className="h-4 w-4 text-foreground" />
          </div>
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground">实时带宽</div>
            <div className="truncate font-mono text-sm font-bold text-foreground">{formatBytes(current.sum)}</div>
          </div>
        </div>
        <div className="shrink-0 text-right font-mono text-[9px] leading-tight text-muted-foreground">
          <div className="text-primary">↓ {formatBytes(current.totalNetIn)}</div>
          <div className="text-accent">↑ {formatBytes(current.totalNetOut)}</div>
        </div>
      </div>

      <div className="mb-1.5 flex items-center gap-3 text-[9px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="h-0.5 w-2.5 rounded-full bg-primary" />
          入站
        </span>
        <span className="flex items-center gap-1">
          <span className="h-0.5 w-2.5 rounded-full bg-accent" />
          出站
        </span>
      </div>

      <div className="h-[104px] w-full">
        {!chartReady ? (
          <div className="flex h-full items-center justify-center rounded-md border border-dashed border-border bg-muted/20 text-[10px] text-muted-foreground">
            收集中…
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 2, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="sidebarBwIn" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="sidebarBwOut" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.25} vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 8, fill: 'var(--color-muted-foreground)' }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
                height={18}
              />
              <YAxis
                tick={{ fontSize: 8, fill: 'var(--color-muted-foreground)' }}
                axisLine={false}
                tickLine={false}
                width={44}
                tickFormatter={(v) => formatBytes(Number(v))}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--color-popover)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius)',
                  fontSize: '11px',
                  color: 'var(--color-foreground)',
                }}
                labelFormatter={(label) => (label != null && label !== '' ? String(label) : '')}
                formatter={(value: number, name: string) => [formatBytes(value), name === 'in' ? '↓ 入站' : '↑ 出站']}
              />
              <Area
                type="monotone"
                dataKey="in"
                stroke="var(--color-primary)"
                strokeWidth={1.5}
                fill="url(#sidebarBwIn)"
                name="in"
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="out"
                stroke="var(--color-accent)"
                strokeWidth={1.5}
                fill="url(#sidebarBwOut)"
                name="out"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function sidebarCardLabel(node: Node): string {
  return node.meta.name || hostNameLabel(node.static) || node.uuid.slice(0, 8);
}

function SidebarServerPickRow({ node, compact }: { node: Node; compact?: boolean }) {
  const name = sidebarCardLabel(node);
  const region = node.meta.region?.trim() || '—';
  const dot = compact ? 'text-[9px]' : 'text-[10px]';
  return (
    <span className="flex min-w-0 items-center gap-0.5">
      <CountryFlag region={node.meta.region} size={compact ? 14 : 16} className="shrink-0" />
      <span className={cn('text-muted-foreground shrink-0 px-0.5', dot)} aria-hidden>
        ·
      </span>
      <span className="min-w-0 truncate font-medium">{name}</span>
      <span className={cn('text-muted-foreground shrink-0 px-0.5', dot)} aria-hidden>
        ·
      </span>
      <span className="shrink-0 font-mono tabular-nums text-[10px] text-muted-foreground">{region}</span>
    </span>
  );
}

const SIDEBAR_SELECT_TRIGGER =
  'h-9 w-full justify-between gap-2 rounded-md border border-border/80 bg-muted/25 px-2.5 text-xs text-foreground shadow-none transition-colors hover:bg-muted/40 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background dark:bg-muted/15 dark:hover:bg-muted/25 [&>span]:line-clamp-none';

function SidebarRemainingValue({ nodes }: { nodes: Node[] }) {
  const [selectedUuid, setSelectedUuid] = useState('');
  const [currency, setCurrency] = useState<DisplayCurrency>('USD');

  useEffect(() => {
    if (nodes.length === 0) return;
    setSelectedUuid((u) => (u && nodes.some((n) => n.uuid === u) ? u : nodes[0].uuid));
  }, [nodes]);

  const activeUuid = useMemo(() => {
    if (nodes.length === 0) return '';
    if (selectedUuid && nodes.some((n) => n.uuid === selectedUuid)) return selectedUuid;
    return nodes[0].uuid;
  }, [nodes, selectedUuid]);

  const selected = useMemo(
    () => (activeUuid ? nodes.find((n) => n.uuid === activeUuid) ?? null : null),
    [nodes, activeUuid]
  );
  const meta = selected?.meta;

  const renewal = useMemo(() => {
    if (!meta || meta.price <= 0) return '—';
    return formatMoney(cyclePriceInCurrency(meta, currency), currency);
  }, [meta, currency]);

  const cycleText = meta && meta.priceCycle > 0 ? `${meta.priceCycle} 天` : '—';
  const expireText = meta?.expireTime?.trim() ? meta.expireTime : '—';

  const remaining = useMemo(() => {
    if (!meta) return '—';
    return formatMoney(usdToDisplayAmount(remainingValueUsd(meta), currency), currency);
  }, [meta, currency]);

  if (nodes.length === 0) return null;

  return (
    <div
      className="hidden lg:block rounded-lg border border-border bg-card p-3 transition-all duration-300 hover:shadow-md hover:border-primary/30"
      style={{ animation: 'fade-in 0.4s ease-out 520ms forwards', opacity: 0 }}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <div className="shrink-0 rounded-md bg-muted/30 p-1.5">
            <Calculator className="h-4 w-4 text-foreground" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-foreground">剩余价值计算</div>
            <div className="text-[10px] text-muted-foreground">单节点 · 静态汇率折算</div>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-[10px] font-medium text-muted-foreground">服务器</label>
        <Select value={activeUuid} onValueChange={setSelectedUuid}>
          <SelectTrigger className={cn(SIDEBAR_SELECT_TRIGGER)}>
            <SelectValue placeholder="选择节点" className="flex min-w-0 flex-1 items-center overflow-hidden [&>span]:min-w-0">
              {selected ? (
                <SidebarServerPickRow node={selected} compact />
              ) : (
                <span className="truncate text-muted-foreground">选择节点</span>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent
            side="bottom"
            sideOffset={4}
            align="start"
            avoidCollisions={false}
            className="border border-border/80 bg-popover text-popover-foreground shadow-lg backdrop-blur-md ring-1 ring-border/40"
          >
            {nodes.map((n) => (
              <SelectItem key={n.uuid} value={n.uuid} className="cursor-pointer py-2 pr-2 text-xs">
                <SidebarServerPickRow node={n} />
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <label className="block text-[10px] font-medium text-muted-foreground">展示币种</label>
        <Select value={currency} onValueChange={(v) => setCurrency(v as DisplayCurrency)}>
          <SelectTrigger className={cn(SIDEBAR_SELECT_TRIGGER)}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent
            side="bottom"
            sideOffset={4}
            align="start"
            avoidCollisions={false}
            className="border border-border/80 bg-popover text-popover-foreground shadow-lg backdrop-blur-md ring-1 ring-border/40"
          >
            <SelectItem value="USD" className="text-xs">
              USD $
            </SelectItem>
            <SelectItem value="CNY" className="text-xs">
              CNY ¥
            </SelectItem>
            <SelectItem value="EUR" className="text-xs">
              EUR €
            </SelectItem>
            <SelectItem value="GBP" className="text-xs">
              GBP £
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <dl className="mt-3 space-y-2 border-t border-dashed border-border pt-3 text-[11px]">
        <div className="flex items-start justify-between gap-2">
          <dt className="shrink-0 text-muted-foreground">续费金额（单周期）</dt>
          <dd className="text-right font-mono tabular-nums font-semibold text-foreground">{renewal}</dd>
        </div>
        <div className="flex items-start justify-between gap-2">
          <dt className="shrink-0 text-muted-foreground">计费周期</dt>
          <dd className="text-right font-mono tabular-nums text-foreground">{cycleText}</dd>
        </div>
        <div className="flex items-start justify-between gap-2">
          <dt className="shrink-0 text-muted-foreground">到期时间</dt>
          <dd className="max-w-[58%] text-right font-mono text-[10px] tabular-nums leading-snug text-foreground">
            {expireText}
          </dd>
        </div>
        <div className="flex items-start justify-between gap-2">
          <dt className="shrink-0 text-muted-foreground">剩余价值（估算）</dt>
          <dd className="text-right font-mono tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">
            {remaining}
          </dd>
        </div>
      </dl>
    </div>
  );
}

function OverviewStats({ nodes, className }: { nodes: Node[]; className?: string }) {
  const online = nodes.filter(n => n.online);
  const stats = useMemo(() => {
    const avgCpu = online.length ? online.reduce((s, n) => s + (n.dynamic?.cpu_usage ?? 0), 0) / online.length : 0;
    const avgMem = online.length ? online.reduce((s, n) => s + getMemUsage(n.dynamic), 0) / online.length : 0;
    const totalRx = online.reduce((s, n) => s + (n.dynamic?.total_received ?? 0), 0);
    const totalTx = online.reduce((s, n) => s + (n.dynamic?.total_transmitted ?? 0), 0);
    const offline = nodes.filter(n => !n.online);
    return [
      { icon: Server, label: '服务器总数', value: `${nodes.length}`, sub: `${online.length} 在线 / ${offline.length} 离线`, color: 'text-primary', bg: 'bg-primary/10' },
      { icon: Activity, label: '平均 CPU', value: `${Math.round(avgCpu)}%`, sub: `${online.length} 台运行中`, color: avgCpu > 70 ? 'text-destructive' : 'text-foreground', bg: 'bg-muted/30' },
      { icon: MemoryStick, label: '平均内存', value: `${Math.round(avgMem)}%`, sub: `${nodes.filter(n => n.online && getStatusLevel(n) === 'degraded').length} 台负载较高`, color: avgMem > 70 ? 'text-accent' : 'text-foreground', bg: 'bg-muted/30' },
      { icon: HardDrive, label: '总流量', value: formatTraffic(totalRx + totalTx), sub: `↓ ${formatTraffic(totalRx)} / ↑ ${formatTraffic(totalTx)}`, color: 'text-foreground', bg: 'bg-muted/30' },
      { icon: Globe, label: '可用率', value: `${nodes.length ? ((online.length / nodes.length) * 100).toFixed(1) : 0}%`, sub: `${offline.length > 0 ? `${offline.length} 台异常` : '全部正常'}`, color: offline.length > 0 ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400', bg: offline.length > 0 ? 'bg-destructive/10' : 'bg-emerald-500/10' },
    ];
  }, [nodes]);

  return (
    <div className={cn('grid grid-cols-2 sm:grid-cols-3 gap-3', className)}>
      {stats.map((stat, i) => (
        <div key={stat.label} className="rounded-lg border border-border p-3 transition-all duration-300 hover:shadow-md hover:border-primary/30" style={{ animation: `fade-in 0.4s ease-out ${i * 80}ms forwards` }}>
          <div className="flex items-center gap-2 mb-2">
            <div className={cn('p-1.5 rounded-md', stat.bg)}><stat.icon className={cn('w-4 h-4', stat.color)} /></div>
            <span className="text-xs text-muted-foreground">{stat.label}</span>
          </div>
          <div className={cn('text-xl font-bold font-mono', stat.color)}>{stat.value}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">{stat.sub}</div>
        </div>
      ))}
    </div>
  );
}

function App() {
  const { pathname } = useLocation();
  const isHome = pathname === '/' || pathname === '';
  const isNodehub = pathname.startsWith('/nodehub');
  const isBilling = pathname.startsWith('/billing');

  const { config, error: configError } = useConfig();
  const { nodes, errors, loading, pool } = useNodes(config);
  const [wsConnected, setWsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [detailNodeUuid, setDetailNodeUuid] = useState<string | null>(null);
  const [serverListFilter, setServerListFilter] = useState<ServerListFilter>('all');
  const [serverListSort, setServerListSort] = useState<ServerListSort>('order');
  const [serverListRegion, setServerListRegion] = useState<string>('__all__');

  useEffect(() => {
    if (detailNodeUuid == null) return;
    if (!nodes.some((n) => n.uuid === detailNodeUuid)) {
      setDetailNodeUuid(null);
    }
  }, [nodes, detailNodeUuid]);

  useEffect(() => {
    const timer = setInterval(() => setLastUpdate(new Date()), 5000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!pool) {
      setWsConnected(false);
      return;
    }
    const refresh = () => setWsConnected(pool.isAnyWebSocketOpen());
    refresh();
    const id = setInterval(refresh, 1000);
    return () => clearInterval(id);
  }, [pool]);

  const online = nodes.filter(n => n.online);
  const offline = nodes.filter(n => !n.online);
  const detailNode = nodes.find(n => n.uuid === detailNodeUuid) ?? null;

  const regionChoices = useMemo(() => {
    const set = new Set<string>();
    for (const n of nodes) {
      set.add(n.meta.region?.trim() || '—');
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'zh-CN'));
  }, [nodes]);

  useEffect(() => {
    if (serverListRegion === '__all__') return;
    if (!regionChoices.includes(serverListRegion)) setServerListRegion('__all__');
  }, [regionChoices, serverListRegion]);

  const displayedNodes = useMemo(() => {
    let filtered = nodes.filter((n) => {
      if (serverListFilter === 'online') return n.online;
      if (serverListFilter === 'offline') return !n.online;
      return true;
    });
    if (serverListRegion !== '__all__') {
      filtered = filtered.filter((n) => (n.meta.region?.trim() || '—') === serverListRegion);
    }
    return [...filtered].sort((a, b) => compareNodesForList(a, b, serverListSort));
  }, [nodes, serverListFilter, serverListSort, serverListRegion]);

  const nodeBillingTotals = useMemo(() => {
    let totalCycleUsd = 0;
    let remainingUsd = 0;
    for (const n of nodes) {
      if (!hasCost(n.meta)) continue;
      totalCycleUsd += cyclePriceUsd(n.meta);
      remainingUsd += remainingValueUsd(n.meta);
    }
    return { totalCycleUsd, remainingUsd };
  }, [nodes]);

  function handleOpenNode(uuid: string) {
    setDetailNodeUuid(uuid);
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="fixed inset-0 bg-grid-pattern opacity-[0.03] pointer-events-none" />
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute w-full h-px bg-primary/10 animate-scanline" />
      </div>

      <header className={siteHeaderShell}>
        <div className={siteHeaderInner}>
          <div className="flex min-w-0 flex-row flex-nowrap items-center justify-between gap-2 sm:gap-4">
            <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-1.5 overflow-x-auto [-webkit-overflow-scrolling:touch] sm:flex-wrap sm:gap-3 sm:overflow-visible">
              <div className="hidden min-w-0 items-center gap-3 text-base sm:text-lg sm:flex">
                <SiteBrandIcon siteLogo={config?.site_logo} />
                <div className="min-w-0">
                  <h1 className={siteHeaderTitle}>{config?.site_name || 'ServerPulse'}</h1>
                </div>
              </div>
              <div className="hidden h-5 w-px shrink-0 bg-border sm:block" aria-hidden />
              <Link to="/" className={siteNavHome(isHome)} title="首页">
                <Home className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden sm:inline">首页</span>
              </Link>
              <Link to="/nodehub" className={siteNavNodehub(isNodehub)} title="节点列表">
                <List className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden sm:inline">节点列表</span>
              </Link>
              <Link to="/billing" className={siteNavBilling(isBilling)} title="费用统计">
                <Receipt className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden sm:inline">费用统计</span>
              </Link>
            </div>
            <div className="flex shrink-0 flex-nowrap items-center justify-end gap-2 sm:gap-3">
              <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
                <Clock className="h-3.5 w-3.5 shrink-0" />
                <span className="tabular-nums">{lastUpdate.toLocaleTimeString('zh-CN')}</span>
              </div>
              <div
                className={cn(
                  'flex h-9 shrink-0 items-center gap-1.5 text-xs leading-none',
                  wsConnected ? 'text-muted-foreground' : 'text-destructive'
                )}
                title={wsConnected ? 'WebSocket 已连接' : 'WebSocket 未连接'}
              >
                <div
                  className={cn(
                    'h-2 w-2 shrink-0 rounded-full',
                    wsConnected ? 'animate-pulse-dot bg-emerald-500' : 'bg-red-500'
                  )}
                />
                <span className="hidden font-semibold uppercase tracking-wide sm:inline">
                  {wsConnected ? 'online' : 'down'}
                </span>
              </div>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      <main className={cn('relative z-10 mx-auto max-w-[1600px] space-y-6 px-3 py-6 sm:px-6', siteMainContent)}>
        {configError && (
          <div className="flex items-start gap-3 p-4 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm">配置文件加载失败</div>
              <div className="text-xs opacity-80 mt-1 font-mono break-all">{configError.message}</div>
            </div>
          </div>
        )}
        {errors.length > 0 && (
          <div className="flex items-start gap-3 p-4 bg-accent/10 border border-accent/30 rounded-lg text-accent">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm">后端连接异常</div>
              <div className="text-xs opacity-80 mt-1 space-y-1">
                {errors.map((e, i) => (
                  <div key={i} className="font-mono break-all">
                    {e.source}: {e.error instanceof Error ? e.error.message : String(e.error)}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-24 space-y-6">
            <div className="relative">
              <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Server className="w-6 h-6 text-primary/60" />
              </div>
            </div>
            <div className="w-64 space-y-2">
              <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full" style={{ animation: 'progress 3s ease-in-out infinite' }} />
              </div>
              <p className="text-center text-muted-foreground text-sm animate-data-flicker">正在连接 NodeGet 后端...</p>
            </div>
          </div>
        )}

        {!loading && nodes.length === 0 && !configError && (
          <div className="flex flex-col items-center justify-center py-24 space-y-4">
            <div className="w-20 h-20 rounded-full bg-muted/30 flex items-center justify-center">
              <Server className="w-10 h-10 text-muted-foreground/40" />
            </div>
            <p className="text-muted-foreground text-sm font-medium">暂无服务器数据</p>
            {errors.length === 0 && (
              <p className="text-xs text-muted-foreground/60">等待后端连接中...</p>
            )}
          </div>
        )}

        {!loading && nodes.length > 0 && (
          <>
            <div className="space-y-6">
              <StatusOverview nodes={nodes} />

              <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
              <aside
                className={cn(
                  'w-full lg:w-72 xl:w-80 shrink-0 flex flex-col gap-3',
                  'lg:sticky lg:top-20 lg:z-[5] lg:self-start',
                  'lg:max-h-[calc(100vh-5.5rem)] lg:overflow-y-auto lg:pr-1',
                  '[scrollbar-width:thin]'
                )}
              >
                <div className="rounded-lg border border-border/70 bg-muted/15 px-2.5 py-2 sm:px-3">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <Receipt className="h-3 w-3 shrink-0 opacity-70" />
                    节点价值（估算）
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[11px]">
                    <div>
                      <span className="text-muted-foreground">总价值</span>
                      <span className="ml-1 font-mono tabular-nums font-semibold text-foreground">
                        {formatMoney(usdToDisplayAmount(nodeBillingTotals.totalCycleUsd, 'USD'), 'USD')}
                      </span>
                      <span className="ml-0.5 text-[9px] text-muted-foreground/90">周期标价</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">剩余价值</span>
                      <span className="ml-1 font-mono tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">
                        {formatMoney(usdToDisplayAmount(nodeBillingTotals.remainingUsd, 'USD'), 'USD')}
                      </span>
                    </div>
                  </div>
                </div>
                <WorldMap nodes={nodes} onOpen={handleOpenNode} compact showMapControls />
                <SidebarRealtimeBandwidth nodes={nodes} />
                <SidebarRemainingValue nodes={nodes} />
              </aside>

              <div className="flex-1 min-w-0 space-y-6">
                <OverviewStats nodes={nodes} className="lg:grid-cols-3 xl:grid-cols-5" />
                <div className="space-y-3">
                  <div className="hidden flex-col gap-3 sm:gap-2 md:flex">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground shrink-0">
                        筛选
                      </span>
                      <SegmentGroup>
                        {(['all', 'online', 'offline'] as const).map((key) => (
                          <SegmentTab
                            key={key}
                            active={serverListFilter === key}
                            onClick={() => setServerListFilter(key)}
                          >
                            {key === 'all' ? 'All' : key === 'online' ? '在线' : '离线'}
                          </SegmentTab>
                        ))}
                      </SegmentGroup>
                    </div>
                    <div className="flex min-w-0 flex-nowrap items-center gap-3">
                      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto pb-0.5 [-webkit-overflow-scrolling:touch]">
                        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          区域
                        </span>
                        <SegmentGroup className="max-w-none shrink-0 flex-nowrap">
                          <SegmentTab active={serverListRegion === '__all__'} onClick={() => setServerListRegion('__all__')}>
                            All
                          </SegmentTab>
                          {regionChoices.map((r) => (
                            <SegmentTab key={r} active={serverListRegion === r} onClick={() => setServerListRegion(r)}>
                              {r}
                            </SegmentTab>
                          ))}
                        </SegmentGroup>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          排序
                        </span>
                        <SegmentGroup className="flex-nowrap">
                          {SERVER_LIST_SORT_TABS.map(({ value, label }) => (
                            <SegmentTab
                              key={value}
                              active={serverListSort === value}
                              onClick={() => setServerListSort(value)}
                            >
                              {label}
                            </SegmentTab>
                          ))}
                        </SegmentGroup>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                      <div className="w-1 h-4 bg-primary rounded-full" />
                      服务器详情
                      <span className="text-xs font-normal text-muted-foreground">
                        ({displayedNodes.length}
                        {nodes.length !== displayedNodes.length ? ` / ${nodes.length}` : ''} 台)
                      </span>
                    </h2>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground shrink-0">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse-dot" />
                      实时更新 · 每 2 秒刷新
                    </div>
                  </div>
                  {displayedNodes.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border bg-muted/10 py-12 text-center text-sm text-muted-foreground">
                      当前筛选下暂无节点
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                      {displayedNodes.map((node, index) => (
                        <NodeCard key={node.uuid} node={node} index={index} pool={pool} onOpen={() => handleOpenNode(node.uuid)} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
              </div>
            </div>

            <NodeDetailDialog
              node={detailNode}
              pool={pool}
              open={detailNode != null}
              onOpenChange={(open) => { if (!open) setDetailNodeUuid(null); }}
            />
          </>
        )}
      </main>

      {!loading && nodes.length > 0 && (
      <footer className="relative z-10 border-t border-border bg-card/50 backdrop-blur-sm">
        <div className="mx-auto max-w-[1600px] px-3 py-4 sm:px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse-dot" />
              <span>{config?.site_name || 'ServerPulse'} Monitor v1.0</span>
            </div>
            <div className="flex items-center gap-4">
              <span>实时推送 · 每 2 秒更新</span>
              <span>•</span>
              <span>{online.length}/{nodes.length} 节点在线</span>
              <span>•</span>
              <Link to="/nodehub" className="hover:text-primary transition-colors flex items-center gap-1">
                <List className="w-3 h-3" />
                节点列表
              </Link>
              <span>•</span>
              <Link to="/billing" className="hover:text-primary transition-colors flex items-center gap-1">
                <Receipt className="w-3 h-3" />
                费用统计
              </Link>
            </div>
            {config?.footer && <span>{config.footer}</span>}
          </div>
        </div>
      </footer>
      )}
    </div>
  );
}

export default App;
