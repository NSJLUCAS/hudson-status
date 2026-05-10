/** 路由 /nodehub：地图、四宫格监控、系统侧栏与节点列表。 */
import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNodes } from '@/hooks/useNodes';
import { useConfig } from '@/hooks/useConfig';
import { Node } from '@/lib/nodeget-types';
import type { BackendPool } from '@/lib/backend-pool';
import { CountryFlag } from '@/components/CountryFlag';
import { ResourceRing } from '@/components/ResourceRing';
import { formatBytes, formatUptime, getStatusLevel, cpuLabel, osLabel, osShortLabel, hostNameLabel } from '@/lib/nodeget-utils';
import { buildLatencyChart } from '@/lib/latency';
import { useNodePingData } from '@/hooks/useNodeLatency';
import {
  Home, PanelLeft, Server, ArrowDown, ArrowUp,
  List,
  X, MapPin, Layers, Radio,
  Wifi,
  Receipt,
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { MapHubMapPane } from '@/components/MapHubMapPane';
import { MapHubSystemSidebar } from '@/components/MapHubSystemSidebar';
import { ThemeToggle } from '@/components/ThemeToggle';
import { SiteBrandIcon } from '@/components/SiteBrandIcon';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import {
  siteHeaderContentMax,
  siteHeaderGutter,
  siteHeaderIconButton,
  siteHeaderShell,
  siteHeaderTitle,
  siteNavBilling,
  siteNavHome,
  siteNavNodehub,
  siteMainContent,
} from '@/lib/site-header';

function getMemUsage(d: Node['dynamic']): number {
  if (!d?.total_memory) return 0;
  return ((d.used_memory ?? 0) / d.total_memory) * 100;
}

function getDiskUsage(d: Node['dynamic']): number {
  if (!d?.total_space) return 0;
  return ((d.total_space - (d.available_space ?? 0)) / d.total_space) * 100;
}

function getCoreCount(staticData: Node['static']): number | null {
  const lc = staticData?.cpu?.logical_cores;
  const pc = staticData?.cpu?.physical_cores;
  if (typeof lc === 'number' && lc > 0) return lc;
  if (typeof pc === 'number' && pc > 0) return pc;
  return null;
}

function MiniNodePctBars({ cpu, mem, disk, active }: { cpu: number; mem: number; disk: number; active: boolean }) {
  const seg = (pct: number) => Math.min(100, Math.max(0, pct));
  return (
    <div className="mt-2 space-y-1">
      <div className="flex gap-1">
        {[cpu, mem, disk].map((v, i) => (
          <div
            key={i}
            className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted/45 ring-1 ring-border/35"
            title={`${['CPU', '内存', '硬盘'][i]} ${Math.round(seg(v))}%`}
          >
            <div
              className={cn('h-full rounded-full bg-primary/85 transition-[width]', !active && 'w-0')}
              style={{ width: active ? `${seg(v)}%` : undefined }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <span className="min-w-0 flex-1 text-left">CPU</span>
        <span className="min-w-0 flex-1 text-left">内存</span>
        <span className="min-w-0 flex-1 text-left">硬盘</span>
      </div>
    </div>
  );
}

function MiniNodeCard({ node, isSelected, onClick }: { 
  node: Node; 
  isSelected: boolean; 
  onClick: () => void;
}) {
  const level = getStatusLevel(node);
  const d = node.dynamic;
  const cpuUsage = d?.cpu_usage ?? 0;
  const memPct = getMemUsage(d);
  const diskPct = getDiskUsage(d);
  const displayName = node.meta.name || hostNameLabel(node.static) || node.uuid.slice(0, 8);
  const osText = osShortLabel(node.static) || '—';
  const cores = getCoreCount(node.static);
  const tcpUdp =
    node.online && d
      ? `TCP ${d.tcp_connections ?? '—'} / UDP ${d?.udp_connections ?? '—'}`
      : '—';

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full rounded-lg border p-3 text-left transition-all duration-200 group',
        isSelected
          ? 'border-primary bg-primary/[0.06] shadow-[0_0_0_1px_rgba(66,185,131,0.45)] ring-2 ring-primary/35'
          : 'border-border/60 bg-card/50 hover:border-primary/30 hover:bg-card/80'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <div className="relative mt-0.5 flex shrink-0 items-center justify-center">
            {node.online && (
              <div className="absolute h-2 w-2 rounded-full bg-emerald-500 animate-pulse-ring" />
            )}
            <div
              className={cn(
                'relative h-2 w-2 rounded-full',
                node.online ? 'bg-emerald-500 animate-pulse-dot' : 'bg-slate-400'
              )}
            />
          </div>
          <CountryFlag region={node.meta.region} size={18} />
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-1">
              <span className="truncate text-xs font-bold text-foreground">{displayName}</span>
              {level === 'degraded' && (
                <div className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
              )}
            </div>
          </div>
        </div>

        {node.online && d ? (
          <div className="shrink-0 text-right font-mono text-xs leading-snug tabular-nums">
            <div className="text-primary">↓ {formatBytes(d.receive_speed ?? 0)}</div>
            <div className="text-accent">↑ {formatBytes(d.transmit_speed ?? 0)}</div>
            <div className="mt-1 text-muted-foreground">{formatUptime(d.uptime ?? 0)}</div>
          </div>
        ) : (
          <span className="shrink-0 text-xs font-medium text-destructive">离线</span>
        )}
      </div>

      <p
        className="mt-1.5 block w-full truncate text-left font-mono text-xs leading-snug text-muted-foreground"
        title={`${osLabel(node.static)} · ${cores != null ? `${cores} 核` : '—'} · ${tcpUdp}`}
      >
        {osText} · {cores != null ? `${cores}核` : '—'} · {tcpUdp}
      </p>

      <MiniNodePctBars
        cpu={cpuUsage}
        mem={memPct}
        disk={diskPct}
        active={!!(node.online && d)}
      />
    </button>
  );
}

function NodeDetailPanel({ node, onClose }: { node: Node; onClose: () => void }) {
  const d = node.dynamic;
  const cpuUsage = d?.cpu_usage ?? 0;
  const memUsage = getMemUsage(d);
  const diskUsage = getDiskUsage(d);
  const displayName = node.meta.name || hostNameLabel(node.static) || node.uuid.slice(0, 8);
  const cpuInfo = cpuLabel(node.static);
  const osName = osLabel(node.static);
  const level = getStatusLevel(node);
  const levelDot = level === 'operational' ? 'bg-emerald-500' : level === 'degraded' ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className="h-full flex flex-col bg-card/95 backdrop-blur-xl">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/60">
        <button 
          onClick={onClose}
          className="p-1.5 rounded-md hover:bg-muted/50 transition-colors"
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
        <CountryFlag region={node.meta.region} size={24} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-black text-foreground truncate">{displayName}</span>
            <span className={cn('w-2 h-2 rounded-full shrink-0', levelDot)} />
          </div>
          <div className="text-xs text-muted-foreground font-mono">
            {node.meta.region || '—'}{osName ? ` · ${osName}` : ''}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {!node.online ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center space-y-2">
              <Server className="w-8 h-8 text-destructive/50 mx-auto" />
              <span className="text-sm text-destructive font-medium">服务器离线</span>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              <ResourceRing label="CPU" value={cpuUsage} sub={cpuInfo || null} size={64} strokeWidth={8} />
              <ResourceRing label="内存" value={memUsage} size={64} strokeWidth={8} />
              <ResourceRing label="磁盘" value={diskUsage} size={64} strokeWidth={8} />
            </div>

            <div className="rounded-lg border border-border/60 bg-muted/20 divide-y divide-border/40">
              <div className="flex items-center justify-between px-3 py-2">
                <div className="flex items-center gap-2">
                  <ArrowDown className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-bold text-muted-foreground">入站带宽</span>
                </div>
                <span className="text-sm font-mono font-bold text-foreground">{formatBytes(d?.receive_speed ?? 0)}/s</span>
              </div>
              <div className="flex items-center justify-between px-3 py-2">
                <div className="flex items-center gap-2">
                  <ArrowUp className="w-3.5 h-3.5 text-accent" />
                  <span className="text-xs font-bold text-muted-foreground">出站带宽</span>
                </div>
                <span className="text-sm font-mono font-bold text-foreground">{formatBytes(d?.transmit_speed ?? 0)}/s</span>
              </div>
            </div>

            <div className="rounded-lg border border-border/60 bg-muted/20 divide-y divide-border/40 text-xs">
              {[
                { label: '系统', value: osName || '—' },
                { label: '处理器', value: cpuInfo || '—' },
                { label: '运行时间', value: formatUptime(d?.uptime ?? 0) },
                { label: '进程数', value: d?.process_count ? String(d.process_count) : '—' },
                { label: 'TCP 连接', value: d?.tcp_connections ? String(d.tcp_connections) : '—' },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between px-3 py-2">
                  <span className="text-muted-foreground">{row.label}</span>
                  <span className="font-mono text-foreground truncate ml-4">{row.value}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StatsBar({ nodes }: { nodes: Node[] }) {
  const online = nodes.filter(n => n.online).length;
  const offline = nodes.filter(n => !n.online).length;
  const totalNetIn = nodes.reduce((s, n) => s + (n.dynamic?.receive_speed ?? 0), 0);
  const totalNetOut = nodes.reduce((s, n) => s + (n.dynamic?.transmit_speed ?? 0), 0);

  return (
    <div
      className="flex w-max min-w-0 shrink-0 items-center gap-3 sm:gap-4 md:gap-6 text-xs sm:text-sm font-mono text-muted-foreground"
      title="下行/上行为全部节点实时速率之和"
    >
      <div className="flex items-center gap-1.5">
        <Server className="w-3.5 h-3.5" />
        <span>{nodes.length}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse-dot" />
        <span className="text-emerald-600 dark:text-emerald-400 font-bold">{online}</span>
      </div>
      {offline > 0 && (
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
          <span className="text-destructive font-bold">{offline}</span>
        </div>
      )}
      <div className="flex items-center gap-1">
        <ArrowDown className="h-3 w-3 shrink-0 text-primary" />
        <span className="shrink-0 text-muted-foreground">下行</span>
        <span className="text-primary">{formatBytes(totalNetIn)}</span>
      </div>
      <div className="flex items-center gap-1">
        <ArrowUp className="h-3 w-3 shrink-0 text-accent" />
        <span className="shrink-0 text-muted-foreground">上行</span>
        <span className="text-accent">{formatBytes(totalNetOut)}</span>
      </div>
    </div>
  );
}

const MAP_HUB_CHART_HISTORY = 45;

type ClusterSample = { t: number; cpu: number; mem: number; netIn: number; netOut: number };

function useSelectedNodeCpuMemSamples(selectedNode: Node | null): ClusterSample[] {
  const [samples, setSamples] = useState<ClusterSample[]>([]);

  useEffect(() => {
    setSamples([]);
  }, [selectedNode?.uuid]);

  useEffect(() => {
    if (!selectedNode?.online) return;
    const d = selectedNode.dynamic;
    const cpu = d?.cpu_usage ?? 0;
    const mem = getMemUsage(d);
    setSamples((prev) => {
      const next = [...prev, { t: Date.now(), cpu, mem, netIn: 0, netOut: 0 }];
      if (next.length > MAP_HUB_CHART_HISTORY) next.splice(0, next.length - MAP_HUB_CHART_HISTORY);
      return next;
    });
  }, [selectedNode]);

  return samples;
}

function useSelectedNodeNetworkSamples(selectedNode: Node | null): ClusterSample[] {
  const [samples, setSamples] = useState<ClusterSample[]>([]);

  useEffect(() => {
    setSamples([]);
  }, [selectedNode?.uuid]);

  useEffect(() => {
    if (!selectedNode?.online) return;
    const netIn = selectedNode.dynamic?.receive_speed ?? 0;
    const netOut = selectedNode.dynamic?.transmit_speed ?? 0;
    setSamples((prev) => {
      const next = [...prev, { t: Date.now(), cpu: 0, mem: 0, netIn, netOut }];
      if (next.length > MAP_HUB_CHART_HISTORY) next.splice(0, next.length - MAP_HUB_CHART_HISTORY);
      return next;
    });
  }, [selectedNode]);

  return samples;
}

const MINI_TOOLTIP = {
  backgroundColor: 'var(--color-popover)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius)',
  fontSize: 11,
  color: 'var(--color-foreground)',
};

function useCompactNodehubCharts() {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const fn = () => setCompact(mq.matches);
    fn();
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);
  return compact;
}

function formatChartTickTime(ts: number, compact: boolean) {
  const d = new Date(ts);
  return compact ? format(d, 'HH:mm') : format(d, 'HH:mm:ss');
}

function MiniPercentLineChart({
  samples,
  keyName,
  strokeVar,
  suffix,
  selected,
  compact,
}: {
  samples: ClusterSample[];
  keyName: 'cpu' | 'mem';
  strokeVar: string;
  suffix: string;
  selected: Node | null;
  compact: boolean;
}) {
  const data = useMemo(
    () =>
      samples.map((s) => ({
        t: s.t,
        v: Math.round(s[keyName] * 10) / 10,
      })),
    [samples, keyName]
  );
  const last = samples.length ? samples[samples.length - 1][keyName] : 0;
  const ready = data.length >= 2;

  const chartMargin = compact
    ? { top: 4, right: 2, left: 0, bottom: 18 }
    : { top: 4, right: 4, left: 0, bottom: 12 };

  return (
    <div className="flex h-full min-h-0 flex-col rounded-md border border-border/50 bg-card/40 p-2">
      <div className="mb-1 flex items-center justify-between gap-1">
        <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{suffix}</span>
        {!selected ? (
          <span className="text-xs text-muted-foreground">未选节点</span>
        ) : !selected.online ? (
          <span className="text-xs text-muted-foreground">离线</span>
        ) : (
          <span className="font-mono text-xs tabular-nums text-foreground">{last.toFixed(1)}%</span>
        )}
      </div>
      <div className="min-h-0 flex-1">
        {!selected ? (
          <div className="flex h-full items-center justify-center rounded border border-dashed border-border/60 bg-muted/10 px-1 text-center text-xs text-muted-foreground">
            点击节点查看
          </div>
        ) : !selected.online ? (
          <div className="flex h-full items-center justify-center rounded border border-dashed border-border/60 bg-muted/10 px-1 text-center text-xs text-muted-foreground">
            节点离线
          </div>
        ) : !ready ? (
          <div className="flex h-full items-center justify-center rounded border border-dashed border-border/60 bg-muted/10 text-xs text-muted-foreground">
            收集中…
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%" debounce={50}>
            <LineChart data={data} margin={chartMargin}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.2} vertical={false} />
              <XAxis
                dataKey="t"
                type="number"
                domain={['dataMin', 'dataMax']}
                scale="time"
                tickFormatter={(tick) => formatChartTickTime(Number(tick), compact)}
                tick={{ fontSize: compact ? 8 : 9, fill: 'var(--color-muted-foreground)' }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={compact ? 36 : 22}
                height={compact ? 20 : 16}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: compact ? 8 : 9, fill: 'var(--color-muted-foreground)' }}
                axisLine={false}
                tickLine={false}
                width={compact ? 22 : 26}
                tickFormatter={(v) => `${v}`}
              />
              <Tooltip
                contentStyle={MINI_TOOLTIP}
                formatter={(v: number) => [`${v.toFixed(1)}%`, suffix]}
                labelFormatter={(ts) => format(new Date(Number(ts)), 'yyyy-MM-dd HH:mm:ss')}
              />
              <Line type="monotone" dataKey="v" stroke={strokeVar} strokeWidth={1.25} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function MiniNetworkAreaChart({ samples, selected, compact }: { samples: ClusterSample[]; selected: Node | null; compact: boolean }) {
  const data = useMemo(
    () =>
      samples.map((s) => ({
        t: s.t,
        in: s.netIn,
        out: s.netOut,
      })),
    [samples]
  );
  const ready = data.length >= 2;
  const lastIn = samples.length ? samples[samples.length - 1].netIn : 0;
  const lastOut = samples.length ? samples[samples.length - 1].netOut : 0;

  const chartMargin = compact
    ? { top: 2, right: 2, left: 0, bottom: 18 }
    : { top: 2, right: 4, left: 0, bottom: 12 };

  return (
    <div className="flex h-full min-h-0 flex-col rounded-md border border-border/50 bg-card/40 p-2">
      <div className="mb-1 flex min-w-0 items-center gap-1">
        <span className="flex shrink-0 items-center gap-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          <Wifi className="h-3 w-3" />
          网络
        </span>
      </div>
      {selected?.online ? (
        <div className="mb-1 flex items-center justify-end gap-2 font-mono text-xs leading-tight">
          <span className="text-primary">↓ {formatBytes(lastIn)}</span>
          <span className="text-accent">↑ {formatBytes(lastOut)}</span>
        </div>
      ) : null}
      <div className="min-h-0 flex-1">
        {!selected ? (
          <div className="flex h-full items-center justify-center rounded border border-dashed border-border/60 bg-muted/10 px-1 text-center text-xs text-muted-foreground">
            点击节点查看
          </div>
        ) : !selected.online ? (
          <div className="flex h-full items-center justify-center rounded border border-dashed border-border/60 bg-muted/10 px-1 text-center text-xs text-muted-foreground">
            节点离线
          </div>
        ) : !ready ? (
          <div className="flex h-full items-center justify-center rounded border border-dashed border-border/60 bg-muted/10 text-xs text-muted-foreground">
            收集中…
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%" debounce={50}>
            <AreaChart data={data} margin={chartMargin}>
              <defs>
                <linearGradient id="mapHubNetIn" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="mapHubNetOut" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.2} vertical={false} />
              <XAxis
                dataKey="t"
                type="number"
                domain={['dataMin', 'dataMax']}
                scale="time"
                tickFormatter={(tick) => formatChartTickTime(Number(tick), compact)}
                tick={{ fontSize: compact ? 8 : 9, fill: 'var(--color-muted-foreground)' }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={compact ? 36 : 22}
                height={compact ? 20 : 16}
              />
              <YAxis
                tick={{ fontSize: compact ? 8 : 9, fill: 'var(--color-muted-foreground)' }}
                axisLine={false}
                tickLine={false}
                width={compact ? 30 : 36}
                tickFormatter={(v) => formatBytes(Number(v))}
              />
              <Tooltip
                contentStyle={MINI_TOOLTIP}
                formatter={(value: number, name: string) => [formatBytes(value), name === 'in' ? '↓ 入站' : '↑ 出站']}
                labelFormatter={(ts) => format(new Date(Number(ts)), 'yyyy-MM-dd HH:mm:ss')}
              />
              <Area type="monotone" dataKey="in" stroke="var(--color-primary)" strokeWidth={1} fill="url(#mapHubNetIn)" name="in" isAnimationActive={false} />
              <Area type="monotone" dataKey="out" stroke="var(--color-accent)" strokeWidth={1} fill="url(#mapHubNetOut)" name="out" isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function MapPingMiniChart({
  pool,
  selected,
  compact,
}: {
  pool: BackendPool | null;
  selected: Node | null;
  compact: boolean;
}) {
  const { pingData, loading } = useNodePingData(pool, selected?.source ?? null, selected?.uuid ?? null);
  const type = 'ping' as const;
  const { data, series } = useMemo(() => buildLatencyChart(pingData, type), [pingData]);

  const chartRows = useMemo(() => {
    return data.map((row) => {
      const out: Record<string, number | string | null> = { t: row.t };
      for (const s of series) {
        out[s.name] = row[s.name] as number | null;
      }
      return out;
    });
  }, [data, series]);

  const ready = chartRows.length >= 2 && series.length > 0;

  const chartMargin = compact
    ? { top: 4, right: 4, left: 0, bottom: 18 }
    : { top: 6, right: 6, left: 2, bottom: 12 };

  return (
    <div className="flex h-full min-h-0 flex-col rounded-md border border-border/50 bg-card/40 p-2">
      <div className="mb-1 flex min-w-0 items-center gap-1">
        <span className="flex min-w-0 items-center gap-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          <Radio className="h-3 w-3 shrink-0" />
          <span className="truncate">Ping</span>
        </span>
      </div>
      <div className="min-h-0 flex-1">
        {!pool ? (
          <div className="flex h-full items-center justify-center rounded border border-dashed border-border/60 bg-muted/10 text-xs text-muted-foreground">
            无后端
          </div>
        ) : !selected ? (
          <div className="flex h-full items-center justify-center rounded border border-dashed border-border/60 bg-muted/10 px-1 text-center text-xs text-muted-foreground">
            点击节点查看
          </div>
        ) : loading && !ready ? (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            加载中…
          </div>
        ) : !ready ? (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            暂无 Ping
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%" debounce={50}>
            <LineChart data={chartRows} margin={chartMargin}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.2} vertical={false} />
              <XAxis
                dataKey="t"
                type="number"
                domain={['dataMin', 'dataMax']}
                scale="time"
                tickFormatter={(tick) => formatChartTickTime(Number(tick), compact)}
                tick={{ fontSize: compact ? 8 : 9, fill: 'var(--color-muted-foreground)' }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={compact ? 40 : 28}
                height={compact ? 20 : 18}
              />
              <YAxis
                domain={['auto', 'auto']}
                tick={{ fontSize: compact ? 8 : 9, fill: 'var(--color-muted-foreground)' }}
                axisLine={false}
                tickLine={false}
                width={compact ? 30 : 34}
                tickFormatter={(v) => `${v}`}
              />
              <Tooltip
                contentStyle={MINI_TOOLTIP}
                formatter={(v: number, name: string) => [`${Number(v).toFixed(1)} ms`, name]}
                labelFormatter={(ts) => format(new Date(Number(ts)), 'yyyy-MM-dd HH:mm:ss')}
              />
              {series.map((s) => (
                <Line
                  key={s.name}
                  type="monotone"
                  dataKey={s.name}
                  stroke={s.color}
                  strokeWidth={1}
                  dot={false}
                  connectNulls
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function MapOverviewCharts({
  pool,
  selectedNode,
}: {
  pool: BackendPool | null;
  selectedNode: Node | null;
}) {
  const compact = useCompactNodehubCharts();
  const nodeCpuMemSamples = useSelectedNodeCpuMemSamples(selectedNode);
  const netSamples = useSelectedNodeNetworkSamples(selectedNode);

  return (
    <div className="shrink-0 border-b border-border/60 bg-background/90 backdrop-blur-md">
      <div className="w-full px-2 py-2.5 sm:px-4">
        <div className="grid h-[min(300px,46svh)] grid-cols-2 grid-rows-2 gap-2 sm:h-[min(360px,45svh)] md:h-[432px] [&>*]:min-h-0">
          <MiniPercentLineChart
            samples={nodeCpuMemSamples}
            keyName="cpu"
            strokeVar="var(--color-primary)"
            suffix="CPU"
            selected={selectedNode}
            compact={compact}
          />
          <MiniPercentLineChart
            samples={nodeCpuMemSamples}
            keyName="mem"
            strokeVar="var(--color-accent)"
            suffix="内存"
            selected={selectedNode}
            compact={compact}
          />
          <MiniNetworkAreaChart samples={netSamples} selected={selectedNode} compact={compact} />
          <MapPingMiniChart pool={pool} selected={selectedNode} compact={compact} />
        </div>
      </div>
    </div>
  );
}

export default function NodehubPage() {
  const { config } = useConfig();
  const { nodes, loading, pool } = useNodes(config);
  const [selectedUuid, setSelectedUuid] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showNodeList, setShowNodeList] = useState(true);
  const [systemDrawerOpen, setSystemDrawerOpen] = useState(false);

  const { pathname } = useLocation();
  const isHome = pathname === '/' || pathname === '';
  const isNodehub = pathname.startsWith('/nodehub');
  const isBilling = pathname.startsWith('/billing');

  const selectedNode = useMemo(
    () => nodes.find(n => n.uuid === selectedUuid) ?? null,
    [nodes, selectedUuid]
  );

  const sortedNodes = useMemo(() => {
    return [...nodes].sort((a, b) => {
      if (a.online !== b.online) return b.online ? 1 : -1;
      return (a.meta.name || a.uuid).localeCompare(b.meta.name || b.uuid);
    });
  }, [nodes]);

  useEffect(() => {
    if (sortedNodes.length === 0) {
      setSelectedUuid(null);
      return;
    }
    setSelectedUuid((prev) => {
      if (prev != null && sortedNodes.some((n) => n.uuid === prev)) return prev;
      return sortedNodes[0].uuid;
    });
  }, [sortedNodes]);

  const handleOpenNode = useCallback((uuid: string) => {
    setSelectedUuid(uuid);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setSidebarOpen(false);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setSidebarOpen(false);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="relative flex min-h-screen w-full flex-col bg-background">
      <header className={siteHeaderShell}>
        <div className={siteHeaderGutter}>
          <div className={siteHeaderContentMax}>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between lg:gap-4">
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex min-w-0 items-center justify-between gap-2">
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:gap-2">
                  <button
                    type="button"
                    className="flex h-9 shrink-0 items-center gap-1.5 rounded-md px-2 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground md:hidden"
                    onClick={() => setSystemDrawerOpen(true)}
                    title="系统信息"
                  >
                    <PanelLeft className="h-4 w-4 shrink-0" />
                    <span className="text-xs font-bold">系统</span>
                  </button>
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
                <div className="flex shrink-0 items-center gap-1 sm:gap-1.5 lg:hidden">
                  <ThemeToggle />
                  <button
                    type="button"
                    onClick={() => setShowNodeList(!showNodeList)}
                    className={siteHeaderIconButton(showNodeList)}
                    title="节点列表"
                  >
                    <Layers className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                    className={siteHeaderIconButton(sidebarOpen)}
                    title="详情面板"
                  >
                    <Radio className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex w-full min-w-0 flex-col gap-2 lg:max-w-[min(100%,52rem)] lg:flex-row lg:items-center lg:justify-end xl:max-w-none xl:flex-1">
              <div className="w-full min-w-0 overflow-x-auto [-webkit-overflow-scrolling:touch] pb-0.5 sm:pb-0 lg:flex lg:justify-end">
                <StatsBar nodes={nodes} />
              </div>
              <div className="hidden shrink-0 items-center justify-end gap-2 lg:flex">
                <ThemeToggle />
                <button
                  type="button"
                  onClick={() => setShowNodeList(!showNodeList)}
                  className={siteHeaderIconButton(showNodeList)}
                  title="节点列表"
                >
                  <Layers className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className={siteHeaderIconButton(sidebarOpen)}
                  title="详情面板"
                >
                  <Radio className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
        </div>
      </header>

      <Sheet open={systemDrawerOpen} onOpenChange={setSystemDrawerOpen}>
        <SheetContent
          side="left"
          className="flex w-[min(100vw-1rem,20rem)] max-w-[85vw] flex-col gap-0 overflow-hidden p-0 sm:max-w-sm [&>button]:text-foreground"
        >
          <MapHubSystemSidebar node={selectedNode} variant="drawer" />
        </SheetContent>
      </Sheet>

      <div className="relative flex w-full flex-col">
        <div className="flex w-full justify-center px-3 py-6 sm:px-6">
          <div
            className={cn(
              'flex w-full max-w-[1600px] min-w-0 flex-col rounded-xl border border-border/60 bg-card/35 shadow-sm ring-1 ring-border/40 backdrop-blur-sm',
              siteMainContent
            )}
          >
            <div className="relative flex min-w-0 flex-row overflow-hidden pt-3 sm:pt-4">
              <MapHubSystemSidebar node={selectedNode} />
              <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                <MapOverviewCharts pool={pool} selectedNode={selectedNode} />
                <div className="relative w-full overflow-hidden">
                  <MapHubMapPane nodes={nodes} selectedUuid={selectedUuid} onSelectNode={handleOpenNode} />
                </div>
              </div>
            </div>

            {showNodeList && (
              <div className="flex flex-col border-t border-border/60 bg-background/95 backdrop-blur-xl">
                <div className="flex shrink-0 items-center gap-2 border-b border-border/40 px-2 py-2 sm:px-4">
                  <div className="flex min-w-0 flex-1 items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span>节点列表</span>
                    <span className="ml-auto font-mono text-foreground">{nodes.length}</span>
                  </div>
                </div>
                <div className="px-2 pb-2 pt-1 sm:px-4">
                {loading && (
                  <div className="flex items-center justify-center py-8">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
                  </div>
                )}

                {!loading && nodes.length === 0 && (
                  <div className="flex flex-col items-center justify-center space-y-2 py-12">
                    <Server className="h-8 w-8 text-muted-foreground/30" />
                    <span className="text-xs text-muted-foreground">暂无节点数据</span>
                  </div>
                )}

                {!loading && nodes.length > 0 && (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                    {sortedNodes.map((node) => (
                      <MiniNodeCard
                        key={node.uuid}
                        node={node}
                        isSelected={node.uuid === selectedUuid}
                        onClick={() => handleOpenNode(node.uuid)}
                      />
                    ))}
                  </div>
                )}
                </div>
              </div>
            )}
          </div>
        </div>

        {sidebarOpen && selectedNode && (
          <div className="absolute right-0 top-0 z-20 h-full w-72 shrink-0 border-l border-border/60 shadow-xl">
            <NodeDetailPanel node={selectedNode} onClose={handleCloseDetail} />
          </div>
        )}
      </div>
    </div>
  );
}
