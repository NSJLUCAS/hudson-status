import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import type { Node, NodeMeta } from '@/lib/nodeget-types';
import { remainingDays } from '@/lib/cost';
import type { DisplayCurrency } from '@/lib/billing-finance';
import {
  formatMoney,
  monthlyPriceInCurrency,
  yearlyPriceInCurrency,
  monthlyPriceUsd,
  yearlyPriceUsd,
} from '@/lib/billing-finance';
import { nodeDisplayName, serviceProvider } from '@/lib/billing-utils';
import { cn } from '@/lib/utils';
import { CountryFlag } from '@/components/CountryFlag';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type SortKey = 'name' | 'region' | 'provider' | 'monthly' | 'yearly' | 'expire' | 'days';

function parseExpireSort(expireTime: string): number {
  if (!expireTime) return 0;
  const t = new Date(expireTime).getTime();
  return Number.isFinite(t) ? t : 0;
}

function compareNodes(a: Node, b: Node, key: SortKey, dir: number): number {
  const ma = a.meta;
  const mb = b.meta;
  const inv = dir;

  switch (key) {
    case 'name':
      return inv * nodeDisplayName(a).localeCompare(nodeDisplayName(b), 'zh-CN');
    case 'region':
      return inv * (ma.region || '').localeCompare(mb.region || '', 'zh-CN');
    case 'provider':
      return inv * serviceProvider(a).localeCompare(serviceProvider(b), 'zh-CN');
    case 'monthly':
      return inv * (monthlyPriceUsd(ma) - monthlyPriceUsd(mb));
    case 'yearly':
      return inv * (yearlyPriceUsd(ma) - yearlyPriceUsd(mb));
    case 'expire':
      return inv * (parseExpireSort(ma.expireTime) - parseExpireSort(mb.expireTime));
    case 'days': {
      const da = remainingDays(ma.expireTime);
      const db = remainingDays(mb.expireTime);
      const na = da ?? -1e9;
      const nb = db ?? -1e9;
      return inv * (na - nb);
    }
    default:
      return 0;
  }
}

function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  if (!active) return <ArrowUpDown className="ml-1 h-3.5 w-3.5 opacity-40" />;
  return dir === 'asc' ? (
    <ArrowUp className="ml-1 h-3.5 w-3.5 text-[#8b5c2e]" />
  ) : (
    <ArrowDown className="ml-1 h-3.5 w-3.5 text-[#8b5c2e]" />
  );
}

type BillingSubscriptionTableProps = {
  nodes: Node[];
  currency: DisplayCurrency;
  /** 置于外层 Card 内：去掉重复标题与外层卡片壳 */
  embedded?: boolean;
  className?: string;
};

export function BillingSubscriptionTable({
  nodes,
  currency,
  embedded = false,
  className,
}: BillingSubscriptionTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('days');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const sorted = useMemo(() => {
    const list = [...nodes];
    list.sort((a, b) => compareNodes(a, b, sortKey, sortDir === 'asc' ? 1 : -1));
    return list;
  }, [nodes, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'days' ? 'asc' : 'desc');
    }
  }

  function formatDays(meta: NodeMeta) {
    const d = remainingDays(meta.expireTime);
    if (d == null) return { text: '—', cls: 'text-[#8b8178]' };
    if (d < 0) return { text: `过期 ${Math.abs(d)} 天`, cls: 'text-[#9a3d2e] font-medium' };
    if (d < 7) return { text: `${d} 天`, cls: 'text-[#9a3d2e] font-medium' };
    if (d <= 30) return { text: `${d} 天`, cls: 'text-[#8b5c2e]' };
    return { text: `${d} 天`, cls: 'text-[#4d6b50]' };
  }

  const Th = ({
    k,
    children,
    className: thClass,
  }: {
    k: SortKey;
    children: ReactNode;
    className?: string;
  }) => (
    <TableHead className={cn('cursor-pointer select-none hover:bg-[#ebe4d8]/60 dark:hover:bg-[#3d3830]/50', thClass)}>
      <button
        type="button"
        className="inline-flex items-center font-semibold text-[#5c534a] dark:text-[#c4bbb0]"
        onClick={() => toggleSort(k)}
      >
        {children}
        <SortIcon active={sortKey === k} dir={sortDir} />
      </button>
    </TableHead>
  );

  return (
    <div
      className={cn(
        embedded ? '' : 'overflow-hidden rounded-2xl border border-[#e5dcd0] bg-[#faf7f1] shadow-sm dark:border-[#3d3830] dark:bg-[#2a2620]',
        className
      )}
    >
      {!embedded && (
        <div className="border-b border-[#e5dcd0] px-4 py-3 dark:border-[#3d3830]">
          <h3 className="text-sm font-semibold text-[#3d3429] dark:text-[#ebe4d9]">订阅详情表</h3>
          <p className="mt-0.5 text-xs text-[#6b6158]">点击表头排序 · 服务提供商来自标签或虚拟化字段</p>
        </div>
      )}

      <div className={cn('overflow-x-auto', embedded && 'px-4')}>
        <Table>
          <TableHeader>
            <TableRow className="border-[#ebe4d8] hover:bg-transparent dark:border-[#3d3830]">
              <Th k="name">节点名称</Th>
              <Th k="region">地区</Th>
              <Th k="provider">服务提供商</Th>
              <Th k="monthly" className="text-right">
                <span className="inline-flex w-full justify-end">月价</span>
              </Th>
              <Th k="yearly" className="text-right">
                <span className="inline-flex w-full justify-end">年价（估算）</span>
              </Th>
              <Th k="expire">到期日期</Th>
              <Th k="days" className="text-right">
                <span className="inline-flex w-full justify-end">剩余天数</span>
              </Th>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((node) => {
              const meta = node.meta;
              const mo = monthlyPriceInCurrency(meta, currency);
              const yr = yearlyPriceInCurrency(meta, currency);
              const df = formatDays(meta);
              return (
                <TableRow
                  key={node.uuid}
                  className="border-[#ebe4d8] hover:bg-[#f3ece4]/80 dark:border-[#3d3830] dark:hover:bg-[#322c26]"
                >
                  <TableCell className="font-medium text-[#3d3429] dark:text-[#ebe4d9]">
                    <div className="flex items-center gap-2">
                      <CountryFlag region={meta.region} size={18} />
                      <span className="truncate max-w-[180px]">{nodeDisplayName(node)}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-[#6b6158]">{meta.region || '—'}</TableCell>
                  <TableCell className="text-[#6b6158]">{serviceProvider(node)}</TableCell>
                  <TableCell className="text-right font-mono text-xs tabular-nums">
                    {mo > 0 ? formatMoney(mo, currency) : '—'}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs tabular-nums">
                    {yr > 0 ? formatMoney(yr, currency) : '—'}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-[#5c534a]">{meta.expireTime || '—'}</TableCell>
                  <TableCell className={cn('text-right font-mono text-xs tabular-nums', df.cls)}>{df.text}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
