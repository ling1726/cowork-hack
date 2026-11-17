import {
  Badge,
  Button,
  Dropdown,
  Option,
  Text,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import {
  Settings24Regular,
  WeatherMoon24Regular,
  WeatherSunny24Regular,
} from '@fluentui/react-icons';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useUsers } from '../hooks.ts';
import { usePendingCount } from '../hooks/useActionRequests.ts';
import { SettingsDialog } from './SettingsDialog.tsx';
import { useUiStore } from '../store/ui-store.ts';

const useStyles = makeStyles({
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalL,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalXL}`,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground2,
  },
  brand: { textDecoration: 'none', color: tokens.colorNeutralForeground1 },
  nav: { display: 'flex', gap: tokens.spacingHorizontalM, alignItems: 'center' },
  navLink: {
    textDecoration: 'none',
    color: tokens.colorNeutralForeground2,
    paddingBottom: tokens.spacingVerticalXXS,
    borderBottom: '2px solid transparent',
  },
  navLinkActive: {
    color: tokens.colorNeutralForeground1,
    borderBottomColor: tokens.colorBrandForeground1,
  },
  spacer: { flexGrow: 1 },
  right: { display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalS },
});

export function AppHeader() {
  const styles = useStyles();
  const queryClient = useQueryClient();
  const { data: users = [] } = useUsers();
  const currentUserId = useUiStore((s) => s.currentUserId);
  const setCurrentUserId = useUiStore((s) => s.setCurrentUserId);
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const current = users.find((u) => u.id === currentUserId);
  const { data: pending = 0 } = usePendingCount();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const link = (to: '/alerts' | '/queue', label: string, extra?: React.ReactNode) => (
    <Link
      to={to}
      className={styles.navLink}
      activeProps={{ className: `${styles.navLink} ${styles.navLinkActive}` }}
    >
      {label}
      {extra}
    </Link>
  );

  return (
    <header className={styles.header}>
      <Link to="/alerts" className={styles.brand}>
        <Text weight="semibold" size={500}>
          Alerts
        </Text>
      </Link>
      <nav className={styles.nav} aria-label="Primary">
        {link('/alerts', 'Alerts')}
        {link(
          '/queue',
          'Queue',
          pending > 0 && (
            <Badge data-testid="queue-badge" appearance="filled" color="danger" size="small">
              {pending}
            </Badge>
          ),
        )}
      </nav>
      <div className={styles.spacer} />
      <div className={styles.right}>
        <Dropdown
          data-testid="current-user"
          aria-label="Current user"
          value={current?.name ?? ''}
          selectedOptions={[currentUserId]}
          onOptionSelect={(_e, d) => {
            if (!d.optionValue || d.optionValue === currentUserId) return;
            setCurrentUserId(d.optionValue);
            // Everything cached belongs to the previous user's view.
            void queryClient.resetQueries();
          }}
        >
          {users.map((u) => (
            <Option key={u.id} value={u.id} text={u.name}>
              {u.name}
            </Option>
          ))}
        </Dropdown>
        <Button
          data-testid="settings-button"
          appearance="subtle"
          aria-label="Settings"
          icon={<Settings24Regular />}
          onClick={() => setSettingsOpen(true)}
        />
        <Button
          data-testid="theme-toggle"
          appearance="subtle"
          aria-label="Toggle theme"
          icon={theme === 'dark' ? <WeatherSunny24Regular /> : <WeatherMoon24Regular />}
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        />
      </div>
      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
    </header>
  );
}
