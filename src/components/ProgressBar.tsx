import { cn } from '@/lib/utils';

interface ProgressBarProps {
  value: number;
  max?: number;
  label?: string;
  detail?: string;
  color?: 'auto' | 'primary' | 'accent' | 'destructive';
  size?: 'sm' | 'md';
  animated?: boolean;
}

export function ProgressBar({
  value,
  max = 100,
  label,
  detail,
  color = 'auto',
  size = 'md',
  animated = true,
}: ProgressBarProps) {
  const percentage = Math.min(Math.max(0, (value / max) * 100), 100);

  let barColor: string;
  if (color === 'auto') {
    if (percentage > 90) barColor = 'bg-destructive';
    else if (percentage > 70) barColor = 'bg-accent';
    else barColor = 'bg-primary';
  } else {
    barColor = `bg-${color}`;
  }

  return (
    <div className="w-full space-y-1">
      {label && (
        <div className="flex items-center justify-between">
          <span className={cn(
            'font-medium text-foreground',
            size === 'sm' ? 'text-xs' : 'text-sm'
          )}>
            {label}
          </span>
          <span className={cn(
            'text-muted-foreground font-mono',
            size === 'sm' ? 'text-[10px]' : 'text-xs'
          )}>
            {detail || `${Math.round(percentage)}%`}
          </span>
        </div>
      )}
      <div className={cn(
        'w-full bg-muted rounded-full overflow-hidden',
        size === 'sm' ? 'h-1.5' : 'h-2'
      )}>
        <div
          className={cn(
            barColor,
            'h-full rounded-full',
            animated && 'transition-all duration-700 ease-out'
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
