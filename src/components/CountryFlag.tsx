import { memo } from 'react';
import type { SVGAttributes } from 'react';
import * as FlagIconsModule from 'country-flag-icons/react/3x2';
import { getCountryCode } from '@/lib/country-flags';
import { cn } from '@/lib/utils';

interface CountryFlagProps {
  region: string | undefined | null;
  className?: string;
  size?: number;
}

type FlagComponent = (props: SVGAttributes<SVGSVGElement>) => JSX.Element;

function resolveFlagComponent(code: string): FlagComponent | null {
  if (!code || code === 'default') return null;
  const C = (FlagIconsModule as Record<string, unknown>)[code];
  return typeof C === 'function' ? (C as FlagComponent) : null;
}

/**
 * 国旗组件 — 使用本地 country-flag-icons（React SVG），不依赖外网 CDN
 */
export const CountryFlag = memo(function CountryFlag({ region, className, size = 24 }: CountryFlagProps) {
  const countryCode = getCountryCode(region);
  const Flag = countryCode ? resolveFlagComponent(countryCode) : null;

  if (!Flag) {
    return (
      <span
        className={cn('inline-flex items-center justify-center text-muted-foreground/50', className)}
        style={{ width: size, height: size }}
        title="未知区域"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: size * 0.75, height: size * 0.75 }}>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
          <path d="M2 12h20" />
        </svg>
      </span>
    );
  }

  const height = size * (2 / 3);

  return (
    <span
      className={cn('inline-flex items-center justify-center overflow-hidden rounded-sm shadow-sm bg-muted/30 [&_svg]:block', className)}
      style={{ width: size, height }}
      title={region || countryCode}
    >
      <Flag
        className="w-full h-full object-cover rounded-sm"
        width={size}
        height={height}
        aria-label={countryCode}
      />
    </span>
  );
});
