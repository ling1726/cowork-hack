import { buttonVariants, SidebarInset, SidebarProvider } from '@app/ui';
import { Link, Outlet, createRootRoute } from '@tanstack/react-router';
import { AppSidebar } from '../components/shell/AppSidebar.tsx';
import { TopBar } from '../components/shell/TopBar.tsx';
import { UserGate } from '../components/UserGate.tsx';

function NotFound() {
  return (
    <div className="flex flex-col items-start gap-3 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="text-sm text-muted-foreground">There is nothing at this address.</p>
      <Link to="/alerts" className={buttonVariants({ variant: 'outline' })}>
        Back to alerts
      </Link>
    </div>
  );
}

function RootLayout() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-w-0 text-foreground">
        <TopBar />
        <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-6 p-4 md:p-6">
          <UserGate>
            <Outlet />
          </UserGate>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

export const Route = createRootRoute({ component: RootLayout, notFoundComponent: NotFound });
