/** 路由 /billing：费用汇总与节点计费视图。 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, List, Receipt, Server } from 'lucide-react';
import { useConfig } from '@/hooks/useConfig';
import { useNodes } from '@/hooks/useNodes';
import type { DisplayCurrency } from '@/lib/billing-finance';
import {
  cyclePriceUsd,
  formatMoney,
  monthlyPriceUsd,
  remainingValueUsd,
  yearlyPriceUsd,
  usdToDisplayAmount,
} from '@/lib/billing-finance';
import { hasCost, remainingDays } from '@/lib/cost';
import { nodeDisplayName } from '@/lib/billing-utils';
import { BillingCostPieCard, BillingYearCostTrendCard } from '@/components/billing/BillingCharts';
import { BillingExpiryTiers, BillingNodeList } from '@/components/billing/BillingDashboardPanels';
import {
  siteHeaderInnerFullWidth,
  siteHeaderShell,
  siteHeaderTitle,
  siteMainContent,
  siteNavBilling,
  siteNavHome,
  siteNavNodehub,
} from '@/lib/site-header';
import { ThemeToggle } from '@/components/ThemeToggle';
import { SiteBrandIcon } from '@/components/SiteBrandIcon';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const CURRENCY_STORAGE = 'billing-display-currency';

function loadStoredCurrency(): DisplayCurrency {
  try {
    const v = localStorage.getItem(CURRENCY_STORAGE) as DisplayCurrency | null;
    if (v === 'USD' || v === 'CNY' || v === 'EUR' || v === 'GBP') return v;
  } catch {
    /* ignore */
  }
  return 'USD';
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-3 w-0.5 rounded-full bg-primary" />
      <h2 className="text-xs font-bold tracking-tight text-foreground">{children}</h2>
    </div>
  );
}

export default function BillingPage() {
  const { pathname } = useLocation();
  const isHome = pathname === '/' || pathname === '';
  const isNodehub = pathname.startsWith('/nodehub');
  const isBilling = pathname.startsWith('/billing');

  const { config } = useConfig();
  const { nodes, loading } = useNodes(config);

  const [currency, setCurrency] = useState<DisplayCurrency>(loadStoredCurrency);

  useEffect(() => {
    try {
      localStorage.setItem(CURRENCY_STORAGE, currency);
    } catch {
      /* ignore */
    }
  }, [currency]);

  const baseRows = useMemo(() => {
    const list = [...nodes].filter((n) => hasCost(n.meta));
    list.sort((a, b) => {
      const da = remainingDays(a.meta.expireTime);
      const db = remainingDays(b.meta.expireTime);
      if (da == null && db == null) return nodeDisplayName(a).localeCompare(nodeDisplayName(b));
      if (da == null) return 1;
      if (db == null) return -1;
      return da - db;
    });
    return list;
  }, [nodes]);

  const overview = useMemo(() => {
    let monthlyUsd = 0;
    let yearlyUsd = 0;
    let actualUsd = 0;
    let remainingSumUsd = 0;
    let d30Count = 0;
    let d30CycleUsd = 0;
    let d30RemainingUsd = 0;
    for (const n of baseRows) {
      monthlyUsd += monthlyPriceUsd(n.meta);
      yearlyUsd += yearlyPriceUsd(n.meta);
      actualUsd += cyclePriceUsd(n.meta);
      remainingSumUsd += remainingValueUsd(n.meta);
      const d = remainingDays(n.meta.expireTime);
      if (d != null && d >= 0 && d <= 30) {
        d30Count += 1;
        d30CycleUsd += cyclePriceUsd(n.meta);
        d30RemainingUsd += remainingValueUsd(n.meta);
      }
    }
    return {
      subs: baseRows.length,
      monthlyUsd,
      yearlyUsd,
      actualUsd,
      remainingSumUsd,
      monthlyDisplay: usdToDisplayAmount(monthlyUsd, currency),
      yearlyDisplay: usdToDisplayAmount(yearlyUsd, currency),
      actualDisplay: usdToDisplayAmount(actualUsd, currency),
      remainingDisplay: usdToDisplayAmount(remainingSumUsd, currency),
      d30Count,
      d30CycleDisplay: usdToDisplayAmount(d30CycleUsd, currency),
      d30RemainingDisplay: usdToDisplayAmount(d30RemainingUsd, currency),
    };
  }, [baseRows, currency]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none fixed inset-0 bg-grid-pattern opacity-[0.03]" />
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="animate-scanline absolute h-px w-full bg-primary/10" />
      </div>

      <header className={siteHeaderShell}>
        <div className={siteHeaderInnerFullWidth}>
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
                <List className="h-3 w-3 shrink-0" />
                <span className="hidden sm:inline">节点列表</span>
              </Link>
              <Link to="/billing" className={siteNavBilling(isBilling)} title="费用统计">
                <Receipt className="h-3 w-3 shrink-0" />
                <span className="hidden sm:inline">费用统计</span>
              </Link>
            </div>
            <div className="flex shrink-0 flex-nowrap items-center justify-end gap-2 sm:gap-3">
              <Select value={currency} onValueChange={(v) => setCurrency(v as DisplayCurrency)}>
                <SelectTrigger className="h-9 min-h-9 w-[104px] shrink-0 border-border bg-background px-2.5 text-xs font-semibold leading-none">
                  <SelectValue placeholder="币种" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD $</SelectItem>
                  <SelectItem value="CNY">CNY ¥</SelectItem>
                  <SelectItem value="EUR">EUR €</SelectItem>
                  <SelectItem value="GBP">GBP £</SelectItem>
                </SelectContent>
              </Select>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      <main className={cn('relative z-10 w-full px-3 py-6 sm:px-6', siteMainContent)}>
        <div className="w-full overflow-hidden rounded-xl border border-border/60 bg-card/35 shadow-sm ring-1 ring-border/40 backdrop-blur-sm">
          <div className="space-y-4 p-3 sm:p-4">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
          <Card className="border-border/80 bg-card shadow-sm">
            <CardContent className="p-3">
              <p className="text-xs font-medium text-muted-foreground">节点数量</p>
              <p className="mt-0.5 font-mono text-lg font-bold tabular-nums leading-tight text-foreground">{overview.subs}</p>
            </CardContent>
          </Card>
          <Card className="border-border/80 bg-card shadow-sm">
            <CardContent className="p-3">
              <p className="text-xs font-medium text-muted-foreground">实际续费价格</p>
              <p className="mt-0.5 font-mono text-lg font-bold tabular-nums leading-tight text-primary">
                {overview.actualUsd > 0 ? formatMoney(overview.actualDisplay, currency) : '—'}
              </p>
              <p className="mt-1 text-xs leading-snug text-muted-foreground">各订阅单次周期标价合计</p>
            </CardContent>
          </Card>
          <Card className="border-border/80 bg-card shadow-sm">
            <CardContent className="p-3">
              <p className="text-xs font-medium text-muted-foreground">预计月费</p>
              <p className="mt-0.5 font-mono text-lg font-bold tabular-nums leading-tight text-foreground">
                {overview.monthlyUsd > 0 ? formatMoney(overview.monthlyDisplay, currency) : '—'}
              </p>
              <p className="mt-1 text-xs leading-snug text-muted-foreground">周期价摊到 30 天</p>
            </CardContent>
          </Card>
          <Card className="border-border/80 bg-card shadow-sm">
            <CardContent className="p-3">
              <p className="text-xs font-medium text-muted-foreground">预计年付</p>
              <p className="mt-0.5 font-mono text-lg font-bold tabular-nums leading-tight text-foreground">
                {overview.yearlyUsd > 0 ? formatMoney(overview.yearlyDisplay, currency) : '—'}
              </p>
              <p className="mt-1 text-xs leading-snug text-muted-foreground">预计月费 ×12</p>
            </CardContent>
          </Card>
          <Card className="border-border/80 bg-card shadow-sm">
            <CardContent className="p-3">
              <p className="text-xs font-medium text-muted-foreground">总节点剩余价值</p>
              <p className="mt-0.5 font-mono text-lg font-bold tabular-nums leading-tight text-emerald-600 dark:text-emerald-400">
                {overview.remainingSumUsd > 0 ? formatMoney(overview.remainingDisplay, currency) : '—'}
              </p>
              <p className="mt-1 text-xs leading-snug text-muted-foreground">当前周期内按剩余天数比例估算</p>
            </CardContent>
          </Card>
          <Card className="border-border/80 bg-card shadow-sm">
            <CardContent className="p-3">
              <p className="text-xs font-medium text-muted-foreground">30 天内到期</p>
              <p className="mt-0.5 font-mono text-lg font-bold tabular-nums leading-tight text-foreground">{overview.d30Count}</p>
              <p className="mt-1 text-xs leading-snug text-muted-foreground">
                周期标价 {overview.d30Count > 0 ? formatMoney(overview.d30CycleDisplay, currency) : '—'} · 剩余{' '}
                {overview.d30Count > 0 ? formatMoney(overview.d30RemainingDisplay, currency) : '—'}
              </p>
            </CardContent>
          </Card>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center space-y-4 py-16">
            <div className="relative">
              <div className="h-12 w-12 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Server className="h-5 w-5 text-primary/60" />
              </div>
            </div>
            <p className="animate-data-flicker text-center text-xs leading-relaxed text-muted-foreground">
              正在加载节点数据…
              <br />
              <span className="text-sm opacity-90">
                加载完成后若仍未显示计费明细，请在 NodeGet 中添加节点成本配置。
              </span>
            </p>
          </div>
        ) : baseRows.length === 0 ? (
          <Card className="border-dashed border-border bg-muted/20">
            <CardContent className="space-y-2 py-12 text-center text-xs text-muted-foreground">
              <p className="font-medium text-foreground">暂无计费数据</p>
              <p className="text-sm leading-relaxed">
                加载完成后仍未显示时，请在 NodeGet 中添加节点成本配置。
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            <SectionLabel>节点、到期与成本</SectionLabel>
            <div className="grid min-h-0 gap-4 lg:grid-cols-3 lg:items-stretch">
              <BillingNodeList
                nodes={baseRows}
                currency={currency}
                className="min-h-[min(52vh,420px)] h-full lg:col-span-2 lg:min-h-0 lg:h-full"
              />
              <div className="flex min-h-0 flex-col gap-4 lg:col-span-1 lg:h-full">
                <BillingExpiryTiers
                  nodes={baseRows}
                  className="min-h-0 flex-1 overflow-hidden"
                />
                <div className="flex shrink-0 flex-col overflow-hidden rounded-lg border border-border/50 bg-muted/10 px-1 pb-1 pt-0.5">
                  <BillingCostPieCard
                    compact
                    nodes={baseRows}
                    currency={currency}
                    className="border-0 shadow-none ring-0"
                  />
                </div>
              </div>
            </div>

            <div className="min-h-0 space-y-2 border-t border-border/50 pt-4">
              <BillingYearCostTrendCard nodes={baseRows} currency={currency} className="w-full min-h-0" />
            </div>
          </div>
        )}
          </div>
        </div>
      </main>

      <footer className="relative z-10 border-t border-border bg-card/50 backdrop-blur-sm">
        <div className="w-full px-3 py-2 sm:px-5">
          <p className="text-center text-xs text-muted-foreground">
            {config?.site_name || 'ServerPulse'} · 费用统计 · 静态汇率折算仅供参考
          </p>
        </div>
      </footer>
    </div>
  );
}
