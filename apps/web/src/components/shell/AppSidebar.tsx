import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from '@app/ui';
import { Link, useRouterState } from '@tanstack/react-router';
import { Inbox, Settings, ShieldAlert, Siren } from 'lucide-react';
import { useState } from 'react';
import { usePendingCount } from '../../hooks/useActionRequests.ts';
import { SettingsDialog } from '../SettingsDialog.tsx';
import { UserSwitcher } from './UserSwitcher.tsx';

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: pending = 0 } = usePendingCount();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const nav = [
    { to: '/alerts', label: 'Alerts', icon: Siren },
    { to: '/queue', label: 'Queue', icon: Inbox },
  ] as const;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link to="/alerts" aria-label="Home" />}>
              <span className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <ShieldAlert className="size-4" />
              </span>
              <span className="flex flex-col gap-0.5 leading-none">
                <span className="font-semibold">Surveillance</span>
                <span className="text-xs text-sidebar-foreground/60">Trade alerts</span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <nav aria-label="Primary">
              <SidebarMenu>
                {nav.map(({ to, label, icon: Icon }) => (
                  <SidebarMenuItem key={to}>
                    <SidebarMenuButton
                      isActive={pathname === to || pathname.startsWith(`${to}/`)}
                      tooltip={label}
                      render={<Link to={to} />}
                    >
                      <Icon />
                      <span>{label}</span>
                    </SidebarMenuButton>
                    {to === '/queue' && pending > 0 && (
                      <SidebarMenuBadge
                        data-testid="queue-badge"
                        className="bg-destructive text-white peer-hover/menu-button:text-white peer-data-active/menu-button:text-white"
                      >
                        {pending}
                      </SidebarMenuBadge>
                    )}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </nav>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              data-testid="settings-button"
              aria-label="Settings"
              tooltip="Settings"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarSeparator className="mx-0" />
        <UserSwitcher />
      </SidebarFooter>
      <SidebarRail />
      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
    </Sidebar>
  );
}
