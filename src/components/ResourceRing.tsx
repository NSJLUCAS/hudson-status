import { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface ResourceRingProps {
  label: string;
  value: number;
  max?: number;
  sub?: string;
  size?: number;
  strokeWidth?: number;
  /** 未启用/无数据：灰色环，中间为「—」，用于 Swap 等可选资源 */
  inactive?: boolean;
  /** 外层容器类名（用于网格内居中、缩放等） */
  className?: string;
}

export function ResourceRing({
  label,
  value,
  max = 100,
  sub,
  size = 72,
  strokeWidth = 9,
  inactive = false,
  className,
}: ResourceRingProps) {
  const pctRaw = Math.min(Math.max(0, (value / max) * 100), 100);
  const pct = inactive ? 0 : pctRaw;
  const radius = useMemo(() => 50 - strokeWidth / 2 - 1, [strokeWidth]);
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (circumference * pct) / 100;
  const viewBox = '0 0 100 100';
  const innerInset = Math.min(22, Math.max(14, strokeWidth + 4));

  const color = inactive
    ? '#94a3b8'
    : pctRaw >= 90
      ? '#f56565'
      : pctRaw >= 70
        ? '#f6ad55'
        : '#42b983';
  const glow = inactive
    ? 'rgba(148, 163, 184, 0.12)'
    : pctRaw >= 90
      ? 'rgba(245, 101, 101, 0.20)'
      : pctRaw >= 70
        ? 'rgba(246, 173, 85, 0.18)'
        : 'rgba(66, 185, 131, 0.18)';

  return (
    <div className={cn('min-w-0 text-center', className)} style={{ width: size }}>
      <div className="relative mx-auto" style={{ width: size, height: size }}>
        <svg
          viewBox={viewBox}
          className="relative z-[1] h-full w-full -rotate-90 overflow-visible"
          style={{ width: size, height: size }}
        >
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            stroke={inactive ? 'rgb(148 163 184 / 0.35)' : 'var(--color-border)'}
            opacity={inactive ? 1 : 0.95}
          />
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            stroke={color}
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            className="transition-all duration-700 ease-out"
          />
        </svg>

        <div
          className="absolute rounded-full bg-card"
          style={{
            inset: `${innerInset}%`,
            boxShadow: '0 0 0 1px var(--color-border) / 0.55',
          }}
        />

        <div
          className="absolute inset-0 rounded-full"
          style={{ boxShadow: `0 0 18px ${glow}` }}
        />

        <div className="absolute inset-0 z-[2] flex flex-col items-center justify-center leading-none">
          <span
            className={cn(
              'font-black transition-colors duration-150',
              inactive ? 'text-muted-foreground' : 'text-foreground',
              size <= 56 ? 'text-[11px]' : size <= 70 ? 'text-[13px]' : 'text-[14px]'
            )}
          >
            {inactive ? '—' : `${Math.round(pctRaw)}%`}
          </span>
          <span
            className={cn(
              'mt-0.5 font-extrabold tracking-wide',
              inactive ? 'text-muted-foreground/90' : 'text-muted-foreground',
              size <= 56 ? 'text-[8px]' : 'text-[9px]'
            )}
          >
            {label}
          </span>
        </div>
      </div>
      {sub && (
        <div
          className={cn(
            'mx-auto mt-1.5 max-w-[11.5rem] line-clamp-2 min-h-0 text-[10px] font-bold leading-snug sm:mt-1 sm:max-w-none sm:text-[9px]',
            inactive ? 'text-muted-foreground/70' : 'text-muted-foreground'
          )}
          title={sub}
        >
          {sub}
        </div>
      )}
    </div>
  );
}
