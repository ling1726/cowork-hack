import { Separator, SidebarTrigger } from '@app/ui';
import { Breadcrumbs } from './Breadcrumbs.tsx';
import { ThemeToggle } from './ThemeToggle.tsx';

export function TopBar() {
  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 data-vertical:h-4" />
      <Breadcrumbs />
      <div className="flex-1" />
      <ThemeToggle />
    </header>
  );
}
