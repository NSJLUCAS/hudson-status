import { cn } from '@/lib/utils';

interface StatusIndicatorProps {
  status: 'operational' | 'degraded' | 'down';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export function StatusIndicator({ status, size = 'md', showLabel = true }: StatusIndicatorProps) {
  const sizeMap = {
    sm: { dot: 'w-2 h-2', ring: 'w-2 h-2', label: 'text-xs' },
    md: { dot: 'w-2.5 h-2.5', ring: 'w-2.5 h-2.5', label: 'text-sm' },
    lg: { dot: 'w-3 h-3', ring: 'w-3 h-3', label: 'text-base' },
  };

  const colorMap = {
    operational: {
      dot: 'bg-emerald-500',
      ring: 'bg-emerald-500',
      label: 'text-emerald-600 dark:text-emerald-400',
      text: '运行中',
    },
    degraded: {
      dot: 'bg-amber-500',
      ring: 'bg-amber-500',
      label: 'text-amber-600 dark:text-amber-400',
      text: '性能降级',
    },
    down: {
      dot: 'bg-red-500',
      ring: 'bg-red-500',
      label: 'text-red-600 dark:text-red-400',
      text: '离线',
    },
  };

  const s = sizeMap[size];
  const c = colorMap[status];

  return (
    <div className="inline-flex items-center gap-2">
      <div className="relative flex items-center justify-center">
        {status !== 'down' && (
          <div
            className={cn(
              'absolute rounded-full animate-pulse-ring opacity-75',
              s.ring,
              c.ring
            )}
          />
        )}
        <div
          className={cn(
            'relative rounded-full animate-pulse-dot',
            s.dot,
            c.dot
          )}
        />
      </div>
      {showLabel && (
        <span className={cn('font-medium', s.label, c.label)}>
          {c.text}
        </span>
      )}
    </div>
  );
}
