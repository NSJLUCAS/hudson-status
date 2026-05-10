import { Monitor } from 'lucide-react';

/**
 * 顶栏品牌：有 `site_logo` 则显示，否则 Monitor。
 */
export function SiteBrandIcon({ siteLogo }: { siteLogo?: string | null }) {
  const url = siteLogo?.trim();
  if (!url) {
    return <Monitor className="h-[1em] w-[1em] shrink-0 text-primary" aria-hidden />;
  }
  return (
    <img
      src={url}
      alt=""
      className="h-[1em] w-auto max-w-[12em] shrink-0 object-contain object-left"
      decoding="async"
    />
  );
}
