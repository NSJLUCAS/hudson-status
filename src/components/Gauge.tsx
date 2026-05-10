import { cn } from '@/lib/utils';

interface GaugeProps {
  value: number;
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  unit?: string;
  color?: 'auto' | 'primary' | 'accent' | 'destructive';
  showValue?: boolean;
}

export function Gauge({
  value,
  max = 100,
  size = 'md',
  label,
  unit = '%',
  color = 'auto',
  showValue = true,
}: GaugeProps) {
  const percentage = Math.min(Math.max(0, (value / max) * 100), 100);
  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (percentage / 100) * circumference;

  const sizeMap = {
    sm: { container: 'w-16 h-16', text: 'text-xs', label: 'text-[10px]', value: 'text-sm' },
    md: { container: 'w-24 h-24', text: 'text-sm', label: 'text-xs', value: 'text-lg' },
    lg: { container: 'w-32 h-32', text: 'text-base', label: 'text-sm', value: 'text-2xl' },
  };

  const s = sizeMap[size];

  let strokeColor: string;
  if (color === 'auto') {
    if (percentage > 90) strokeColor = 'stroke-destructive';
    else if (percentage > 70) strokeColor = 'stroke-accent';
    else strokeColor = 'stroke-primary';
  } else {
    strokeColor = `stroke-${color}`;
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <div className={cn('relative', s.container)}>
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full -rotate-90"
        >
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="var(--color-muted)"
            strokeWidth="6"
            className="opacity-30"
          />
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            className={cn(strokeColor, 'animate-gauge')}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            style={{ '--gauge-offset': offset } as React.CSSProperties}
          />
        </svg>
        {showValue && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={cn('font-bold text-foreground', s.value)}>
              {Math.round(value)}
            </span>
          </div>
        )}
      </div>
      {label && (
        <span className={cn('text-muted-foreground font-medium', s.label)}>
          {label}
        </span>
      )}
      {showValue && unit && (
        <span className={cn('text-muted-foreground', s.label)}>
          {unit}
        </span>
      )}
    </div>
  );
}
