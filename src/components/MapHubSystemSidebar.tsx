import type { Node } from '@/lib/nodeget-types';
import { detectCurrencyFromUnit, formatMoney } from '@/lib/billing-finance';
import { remainingDays } from '@/lib/cost';
import { formatUptime, cpuLabel, osLabel, kernelLabel, virtLabel } from '@/lib/nodeget-utils';
import { CountryFlag } from '@/components/CountryFlag';
import { HardDrive, MemoryStick, Receipt } from 'lucide-react';
import { cn } from '@/lib/utils';

function getMemUsagePct(d: Node['dynamic'] | null | undefined): number {
  if (!d?.total_memory) return 0;
  return Math.min(100, Math.max(0, ((d.used_memory ?? 0) / d.total_memory) * 100));
}

function getDiskUsagePct(d: Node['dynamic'] | null | undefined): number {
  if (!d?.total_space) return 0;
  return Math.min(
    100,
    Math.max(0, ((d.total_space - (d.available_space ?? 0)) / d.total_space) * 100)
  );
}

/** 与 ProgressBar / ui/progress 一致：轨道 secondary，已用量 primary→accent→destructive，余量 muted */
function UsageSplitBar({ pct }: { pct: number }) {
  const p = Math.min(100, Math.max(0, Math.round(pct)));
  const fillClass = p > 90 ? 'bg-destructive' : p > 70 ? 'bg-accent' : 'bg-primary';
  return (
    <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-secondary ring-1 ring-border/40">
      <div
        className={cn(fillClass, 'transition-[width] duration-300 ease-out')}
        style={{ width: `${p}%` }}
        title={`已使用 ${p}%`}
      />
      <div
        className="min-w-0 flex-1 bg-muted/55 transition-[flex-grow] duration-300 ease-out dark:bg-muted/45"
        title={`未使用 ${100 - p}%`}
      />
    </div>
  );
}

/**
 * /nodehub 地图左侧：与当前选中节点同步的系统信息（静态 + 动态摘要）。
 * @param variant rail=桌面左侧固定栏；drawer=移动端 Sheet 内全高展示
 */
export function MapHubSystemSidebar({
  node,
  variant = 'rail',
}: {
  node: Node | null;
  variant?: 'rail' | 'drawer';
}) {
  const isDrawer = variant === 'drawer';

  /** 桌面左侧轨道：移动端隐藏，md+ 竖条展示（宽度 315px） */
  const railOuter =
    'hidden h-[954px] max-h-full min-h-0 shrink-0 flex-col self-start border-r border-border/60 bg-card/50 backdrop-blur-md md:flex w-[315px] [scrollbar-width:thin]';

  /** 移动端抽屉内：占满 Sheet，可滚动 */
  const drawerOuter =
    'flex h-full min-h-0 w-full flex-col border-0 bg-card/50 backdrop-blur-md';

  /** 无节点时空栏轨道样式（略浅背景） */
  const railOuterEmpty =
    'hidden h-[954px] max-h-full min-h-0 shrink-0 flex-col self-start border-r border-border/60 bg-card/40 backdrop-blur-sm md:flex w-[315px]';

  const drawerOuterEmpty = 'flex h-full min-h-0 w-full flex-col border-0 bg-card/40 backdrop-blur-sm';

  if (!node) {
    return (
      <aside className={cn(isDrawer ? drawerOuterEmpty : railOuterEmpty)}>
        <div className="border-b border-border/50 px-2 py-2.5 sm:px-4">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">系统信息</span>
        </div>
        <div className="flex flex-1 items-center justify-center px-2 py-3 text-center text-xs text-muted-foreground sm:px-4">
          暂无选中节点
        </div>
      </aside>
    );
  }

  const d = node.dynamic;
  const osName = osLabel(node.static);
  const cpuInfo = cpuLabel(node.static);
  const region = node.meta.region || '—';
  const virt = virtLabel(node.meta, node.static);
  const kernel = kernelLabel(node.static);

  const tcpUdp =
    d?.tcp_connections != null || d?.udp_connections != null
      ? `TCP ${d.tcp_connections ?? '—'} / UDP ${d?.udp_connections ?? '—'}`
      : '—';

  const rows: { label: string; value: string }[] = [
    { label: '系统', value: osName || '—' },
    { label: '处理器', value: cpuInfo || '—' },
    { label: '区域', value: region },
    { label: '运行时间', value: node.online && d ? formatUptime(d.uptime ?? 0) : '—' },
    { label: '进程数', value: d?.process_count != null ? String(d.process_count) : '—' },
    { label: '连接数', value: tcpUdp },
    { label: '虚拟化', value: virt || '—' },
    { label: '内核', value: kernel || '—' },
  ];

  const displayName = node.meta.name || node.uuid.slice(0, 8);

  const meta = node.meta;
  const billingCurrency = detectCurrencyFromUnit(meta.priceUnit || '$');
  const renewalAmountText =
    meta.price > 0 ? formatMoney(meta.price, billingCurrency) : '—';
  const cycleDaysText = meta.priceCycle > 0 ? `${meta.priceCycle} 天` : '—';
  const expireTimeText = meta.expireTime?.trim() || '—';
  const daysUntilExpire = remainingDays(meta.expireTime);
  const expireValueClass =
    expireTimeText === '—' || daysUntilExpire == null
      ? 'text-foreground'
      : daysUntilExpire < 0
        ? 'font-semibold text-destructive'
        : daysUntilExpire <= 3
          ? 'font-semibold text-amber-600 dark:text-amber-400'
          : 'text-foreground';

  return (
    <aside className={cn(isDrawer ? drawerOuter : railOuter)}>
      <div className="shrink-0 border-b border-border/50 px-2 py-2.5 sm:px-4">
        <div className="flex items-center gap-2">
          <CountryFlag region={node.meta.region} size={22} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-black text-foreground">{displayName}</div>
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">系统信息</div>
          </div>
        </div>
      </div>

      {!node.online && (
        <div className="shrink-0 border-b border-destructive/20 bg-destructive/5 px-2 py-1.5 text-center text-xs font-medium text-destructive sm:px-4">
          节点离线
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="divide-y divide-border/50">
          {rows.map((row) => (
            <div key={row.label} className="flex items-start justify-between gap-2 px-2 py-2 sm:px-4">
              <span className="shrink-0 text-xs text-muted-foreground">{row.label}</span>
              <span className="min-w-0 max-w-[58%] break-words text-right font-mono text-xs leading-snug text-foreground">
                {row.value}
              </span>
            </div>
          ))}
        </div>

        <div className="space-y-2 border-t border-border/50 px-2 py-3 sm:px-4">
          <div className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <Receipt className="h-3 w-3 shrink-0 opacity-80" />
            费用
          </div>
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <span className="shrink-0 text-xs text-muted-foreground">续费金额</span>
              <span className="min-w-0 max-w-[58%] break-words text-right font-mono text-xs tabular-nums leading-snug text-foreground">
                {renewalAmountText}
              </span>
            </div>
            <div className="flex items-start justify-between gap-2">
              <span className="shrink-0 text-xs text-muted-foreground">周期</span>
              <span className="min-w-0 max-w-[58%] text-right font-mono text-xs tabular-nums text-foreground">
                {cycleDaysText}
              </span>
            </div>
            <div className="flex items-start justify-between gap-2">
              <span className="shrink-0 text-xs text-muted-foreground">到期</span>
              <span
                className={cn(
                  'min-w-0 max-w-[58%] break-words text-right font-mono text-xs tabular-nums leading-snug',
                  expireValueClass
                )}
              >
                {expireTimeText}
              </span>
            </div>
          </div>
        </div>

        {node.online && d && (d.total_memory || d.total_space) ? (
          <div className="space-y-3 border-t border-border/50 px-2 py-3 sm:px-4">
            {d.total_memory ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1 text-xs font-bold text-muted-foreground">
                    <MemoryStick className="h-3 w-3 shrink-0 opacity-80" />
                    内存
                  </span>
                  <span className="font-mono text-xs tabular-nums text-foreground">
                    {Math.round(getMemUsagePct(d))}%
                  </span>
                </div>
                <UsageSplitBar pct={getMemUsagePct(d)} />
              </div>
            ) : null}
            {d.total_space ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1 text-xs font-bold text-muted-foreground">
                    <HardDrive className="h-3 w-3 shrink-0 opacity-80" />
                    硬盘
                  </span>
                  <span className="font-mono text-xs tabular-nums text-foreground">
                    {Math.round(getDiskUsagePct(d))}%
                  </span>
                </div>
                <UsageSplitBar pct={getDiskUsagePct(d)} />
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </aside>
  );
}
