import { Text, makeStyles, tokens } from '@fluentui/react-components';
import { Link, Outlet, createRootRoute } from '@tanstack/react-router';
import { AppHeader } from '../components/AppHeader.tsx';
import { UserGate } from '../components/UserGate.tsx';

const useStyles = makeStyles({
  main: { padding: tokens.spacingHorizontalXL, maxWidth: '1400px', margin: '0 auto' },
  notFound: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalM },
});

function NotFound() {
  const styles = useStyles();
  return (
    <div className={styles.notFound}>
      <Text as="h1" size={700} weight="semibold">
        Page not found
      </Text>
      <Link to="/alerts">Back to alerts</Link>
    </div>
  );
}

function RootLayout() {
  const styles = useStyles();
  return (
    <>
      <AppHeader />
      <main className={styles.main}>
        <UserGate>
          <Outlet />
        </UserGate>
      </main>
    </>
  );
}

export const Route = createRootRoute({ component: RootLayout, notFoundComponent: NotFound });
