import { Button } from '@app/ui';
import { Moon, Sun } from 'lucide-react';
import { useUiStore } from '../../store/ui-store.ts';

export function ThemeToggle() {
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  return (
    <Button
      data-testid="theme-toggle"
      variant="ghost"
      size="icon"
      aria-label="Toggle theme"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
    >
      {theme === 'dark' ? <Sun /> : <Moon />}
    </Button>
  );
}
