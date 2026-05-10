/**
 * 全站顶栏与正文区共用的 Tailwind 类名片段（首页、/nodehub、/billing）。
 */
import { cn } from '@/lib/utils';

export const siteHeaderShell =
  'relative z-20 shrink-0 border-b border-border bg-card/80 backdrop-blur-xl';

export const siteHeaderInner =
  'mx-auto w-full max-w-[1600px] px-3 py-3 sm:px-6 sm:py-4';

export const siteHeaderGutter = 'px-3 py-3 sm:px-6 sm:py-4';

export const siteHeaderContentMax = 'mx-auto w-full max-w-[1600px]';

export const siteHeaderInnerFullWidth =
  'w-full px-3 py-3 sm:px-6 sm:py-4';

export const siteMainContent =
  'text-sm leading-normal text-foreground antialiased';

export const siteHeaderRow =
  'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4';

export const siteHeaderTitle =
  'truncate font-bold tracking-tight text-foreground leading-none text-inherit sm:leading-tight';

export const siteHeaderTitleLine2 = 'mt-0.5 truncate text-xs text-muted-foreground';

const navBase =
  'inline-flex h-9 min-h-9 shrink-0 items-center justify-center gap-1.5 px-2.5 text-xs font-semibold leading-none transition-colors sm:gap-2';

export const siteHeaderIconButton = (active: boolean) =>
  cn(
    'inline-flex h-9 w-9 shrink-0 items-center justify-center transition-colors',
    active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
  );

export const siteNavHome = (active: boolean) =>
  cn(navBase, active ? 'font-bold text-foreground' : 'text-muted-foreground hover:text-foreground');

export const siteNavNodehub = (active: boolean) =>
  cn(navBase, active ? 'font-bold text-primary' : 'text-muted-foreground hover:text-foreground');

export const siteNavBilling = (active: boolean) =>
  cn(navBase, active ? 'font-bold text-primary' : 'text-muted-foreground hover:text-foreground');
