import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-muted/50 p-0 hover:bg-muted transition-colors dark:border-primary/35 dark:bg-primary/10 dark:hover:bg-primary/15"
      aria-label="切换主题"
    >
      <Sun className="w-4 h-4 hidden dark:block text-primary" />
      <Moon className="w-4 h-4 block dark:hidden text-muted-foreground" />
    </button>
  );
}
