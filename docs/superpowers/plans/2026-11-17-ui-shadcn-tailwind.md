# UI rework on shadcn/ui (Base UI) + Tailwind v4 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Fluent UI v9 with shadcn/ui components on Base UI, styled with Tailwind v4, and rebuild the layout as a dashboard (sidebar shell, stat cards, dense TanStack table, two-column detail), with every URL, behaviour and test intact.

**Architecture:** shadcn primitives are generated into `@app/ui/src/primitives` and the domain components in `@app/ui/src/components` are rebuilt on them. `@app/ui` exports one Tailwind entry (`@app/ui/styles.css`) that the web app imports. Fluent stays installed until the last task. Each PR-sized group of tasks leaves the build and every test green.

**Tech Stack:** shadcn 4.23 (Base UI variant), `@base-ui/react` 1.9, `tailwindcss` + `@tailwindcss/vite` 4.3, `tw-animate-css`, `class-variance-authority`, `clsx`, `tailwind-merge`, `@tanstack/react-table` 9, `lucide-react`. Existing: pnpm 12, TS 6 project refs, Vite 8, React 19, TanStack Router/Query, zustand, Vitest 5, Playwright, oxlint/oxfmt.

**Spec:** `docs/superpowers/specs/2026-11-17-ui-shadcn-tailwind-design.md`

## Global Constraints

- No API, server, MCP or domain changes. URLs and deep links keep their exact shape: `alertListUrl`/`alertUrl`/`queueUrl`/`actionRequestUrl` output must equal the app's URLs.
- `@app/ui` never imports `@tanstack/react-router`, `@tanstack/react-query` or `zustand`. `@tanstack/react-table` is allowed. Components take data and callbacks only.
- `@app/ui` uses no path aliases. After any shadcn CLI run, rewrite `@/…` imports to relative imports (with `.ts`/`.tsx` extensions, as the rest of the repo does).
- Primitives are Base UI based (`@base-ui/react`), never Radix.
- Page size stays 25, with no rows-per-page control and no new URL params.
- Theme: shadcn neutral palette, light and `.dark` variables. `<html>` carries `class="dark"` and `data-theme="light|dark"`, driven by the zustand `theme`.
- Keep every existing `data-testid` (see the list in Task 6). A selector in an e2e spec changes only when its control changed type, and the commit message lists each changed selector.
- Dependency versions: pin exact versions. pnpm's release-age policy may refuse versions published in the last day. If it does, take the newest version it accepts; never add to `minimumReleaseAgeExclude`.
- Every task ends with `pnpm typecheck && pnpm lint && pnpm test` green. Tasks that touch `apps/web` also need `pnpm e2e` green; ports 3001 and 5173 must be free.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- PR boundaries: PR 1 = Task 1; PR 2 = Tasks 2–4; PR 3 = Tasks 5–6; PR 4 = Tasks 7–8; PR 5 = Tasks 9–10.

## Review Focus

1. **Shared components unstyled in the web app**, because Tailwind did not scan `packages/ui`. Expect: badges and table cells have real backgrounds and padding in dev and in `vite build`. Pinned by the computed-style e2e in Task 6 and the build check in Task 1.
2. **Dark mode leaves hard-coded light colours**, making text unreadable. Expect: every surface follows the theme variables. Pinned by the dark-mode e2e in Task 5 (body background and table text colours flip).
3. **Narrow screens**: the sidebar or a wide table forces the whole page to scroll sideways. Expect: no horizontal page scroll at 390px wide; the table scrolls inside its own container. Pinned by the narrow-viewport e2e in Tasks 6 and 7.
4. **Keyboard use of the new popovers and menus** (faceted filters, More actions, user switcher). Expect: Enter/Space toggle, Escape closes and returns focus to the trigger. Pinned by the keyboard e2e in Tasks 6 and 8.
5. **Stat cards before the counts load or when a count fails.** Expect: a skeleton, never a misleading `0`. Pinned by the `StatCard` unit test in Task 3.

---

## PR 1 — Setup

### Task 1: Tailwind v4, shadcn primitives, theme wiring, TanStack Table check

**Files:**
- Create: `packages/ui/components.json`, `packages/ui/src/styles.css`, `packages/ui/src/lib/utils.ts`, `packages/ui/src/primitives/*.tsx`, `apps/web/src/index.css`, `apps/web/src/theme.ts`, `apps/web/src/theme.test.ts`, `packages/ui/test/table-v9.test.tsx` (deleted at the end of this task)
- Modify: `packages/ui/package.json` (deps; `exports` adds `"./styles.css": "./src/styles.css"`), `packages/ui/test/components.test.tsx:123-140` (import guard), `apps/web/package.json`, `apps/web/vite.config.ts`, `apps/web/src/main.tsx`, `apps/web/index.html` (drop the inline `<style>`), `pnpm-workspace.yaml` (only if Tailwind's native package needs a build approval), `.oxlintrc.json`/`.oxfmtrc.json` (only if generated primitives fail lint; ignore narrowly, by path)

**Interfaces:**
- Produces: `cn(...inputs: ClassValue[]): string` from `packages/ui/src/lib/utils.ts`. Primitives at `packages/ui/src/primitives/<name>.tsx` using shadcn's export names (`Button`, `buttonVariants`, `Badge`, `Card*`, `Dialog*`, `DropdownMenu*`, `Popover*`, `Select*`, `Tabs*`, `Table*`, `Input`, `Textarea`, `Switch`, `Checkbox`, `Label`, `Separator`, `Sidebar*`, `Sheet*`, `Tooltip*`, `Avatar*`, `Breadcrumb*`, `Skeleton`). `@app/ui/src/index.ts` re-exports all primitives and `cn`. CSS entry `@app/ui/styles.css`. `applyTheme(theme: 'light' | 'dark', root: Pick<HTMLElement, 'classList' | 'setAttribute'>): void` in `apps/web/src/theme.ts`.

- [ ] **Step 1: TanStack Table v9 check (throwaway).** In `packages/ui/test/table-v9.test.tsx`, render a two-column table with `@tanstack/react-table` v9 using manual sorting and a controlled sorting state. Assert that rows render in the given order (the table must not re-sort) and that clicking a header calls the sorting-change handler. Run `pnpm vitest run packages/ui/test/table-v9.test.tsx` → PASS. If v9 cannot do this cleanly, switch to the latest v8, record why in the commit message, and use v8 from here on. Delete the file once it passes.

- [ ] **Step 2: Write the failing guard test.** In `components.test.tsx`, hoist the regex to `const FORBIDDEN = /@tanstack\/react-(router|query)|from ['"]zustand/` and add:

```ts
it('import guard allows react-table and bans router, query, zustand and path aliases', () => {
  expect(FORBIDDEN.test("from '@tanstack/react-table'")).toBe(false);
  expect(FORBIDDEN.test("from '@tanstack/react-router'")).toBe(true);
  expect(FORBIDDEN.test("from '@tanstack/react-query'")).toBe(true);
  expect(FORBIDDEN.test("from 'zustand'")).toBe(true);
  expect(ALIAS.test("from '@/lib/utils'")).toBe(true);
});
```

The existing walk test also fails a file matching `ALIAS = /from ['"]@\//`. Run `pnpm vitest run --project @app/ui` → FAIL (`FORBIDDEN`/`ALIAS` undefined).

- [ ] **Step 3: Make it pass.** Define both regexes and use them in the walk. Run → PASS.

- [ ] **Step 4: Write the failing theme test** in `apps/web/src/theme.test.ts`. Use a fake root with a real `classList` (`new Set`-backed `toggle(name, force)`) and a recorded `setAttribute`. Assert: `applyTheme('dark', root)` → `classList` contains `dark` and `data-theme` is `"dark"`; then `applyTheme('light', root)` → no `dark` and `data-theme` is `"light"`. Run `pnpm vitest run --project @app/web` → FAIL.

- [ ] **Step 5: Implement `applyTheme`.** In `main.tsx`, call it from an effect on `theme` with `document.documentElement`. Keep `FluentProvider` for now, but drop its `data-theme` prop so the attribute lives on `<html>` only (the shell e2e `[data-theme="dark"]` locator then matches `<html>`). If `toBeVisible()` does not hold for `<html>`, switch those three assertions to `expect(page.locator('html')).toHaveAttribute('data-theme', …)` and note it in the commit. Run → PASS.

- [ ] **Step 6: Add Tailwind and the primitives.** Install the deps (exact versions). Add `@tailwindcss/vite` to the web Vite plugins. Write `components.json` (Base UI, style default, base colour neutral, CSS variables on, `rsc: false`, `tsx: true`). Generate the primitives listed in Interfaces into `src/primitives`, `cn` into `src/lib/utils.ts`, then rewrite alias imports to relative ones. `src/styles.css`: `@import "tailwindcss"; @import "tw-animate-css";`, `@custom-variant dark (&:is(.dark *));`, shadcn's neutral `:root`/`.dark` variables and `@theme inline` mapping, `@source "./";`, and the base layer (`border-border`, `bg-background text-foreground` on body). `apps/web/src/index.css` is `@import "@app/ui/styles.css";`, imported first in `main.tsx`.

- [ ] **Step 7: Check that the production CSS contains classes from `packages/ui`.** Pick one utility class that appears only in a generated primitive (for example the `Sidebar` width variable class), then run `pnpm --filter @app/web build && grep -l "<that class>" apps/web/dist/assets/*.css`. Expect one match. Paste the command and its output into the commit message.

- [ ] **Step 8: Full verification.** Run `pnpm typecheck && pnpm lint && pnpm test && pnpm e2e`. All green. Tailwind's preflight may move Fluent screens visually; any e2e it breaks is fixed here, without changing a selector.

- [ ] **Step 9: Commit**

```bash
git add -A packages/ui apps/web pnpm-lock.yaml pnpm-workspace.yaml .oxlintrc.json .oxfmtrc.json
git commit -m "feat(ui): Tailwind v4 and shadcn/ui primitives on Base UI; theme on <html>"
```

---

## PR 2 — Shared components

Tasks 2–4 rebuild every `@app/ui` component on the primitives. Names and props stay unless stated, and the existing unit tests keep their assertions; only render wrappers change. Each task removes `FluentProvider` from the tests it touches. Use lucide icons.

### Task 2: Badges, tags, highlights, assignees, timeline, data tab

**Files:**
- Modify: `packages/ui/src/components/{AlertStatusBadge,SeverityBadge,ViaClaudeTag,AlertHighlights,AssigneesPanel,AlertTimeline,DataTabTable}.tsx`, `packages/ui/test/components.test.tsx`

**Interfaces:**
- Consumes: primitives from Task 1.
- Produces: the same exports and props as today.

- [ ] **Step 1: Write the failing test** `SeverityBadge and AlertStatusBadge expose their value for styling`: `render(<SeverityBadge severity="critical" />)` → `getByTestId('severity-badge')` has `data-severity="critical"`; `AlertStatusBadge status="in_progress"` → `data-status="in_progress"`. Run `pnpm vitest run --project @app/ui` → FAIL.
- [ ] **Step 2: Rebuild the seven components.** Badges use `Badge` with a variant map (low → secondary, medium → amber, high → orange, critical → destructive; open → outline blue, in_progress → amber, closed → secondary), with colours from theme-aware classes (`dark:` variants). Highlights render as a grid of small `Card`s with tone colours. `AssigneesPanel` is a `Card` with initials avatars and an Edit button (pencil icon, accessible name "Edit"). `AlertTimeline` is a vertical list with an actor avatar, a time and a body. `DataTabTable` uses the `Table` primitive with right-aligned numbers. Keep every `data-testid`.
- [ ] **Step 3: Run** `pnpm vitest run --project @app/ui` → all PASS.
- [ ] **Step 4: Commit** `feat(ui): badges, highlights, assignees, timeline and data tables on shadcn`.

### Task 3: AlertHeader with primary action and menu, StatCard, AlertSummaryCard

**Files:**
- Create: `packages/ui/src/components/StatCard.tsx`
- Modify: `packages/ui/src/components/{AlertHeader,AlertSummaryCard}.tsx`, `packages/ui/src/index.ts`, `packages/ui/test/components.test.tsx`

**Interfaces:**
- Produces:
  - `AlertHeader` props unchanged (`alert`, `actions: AllowedAction[]`, `onAction`, `pendingCount?`). Behaviour: `primaryAction(actions: AllowedAction[]): AllowedAction | undefined` (exported) returns `'acknowledge'` when present, otherwise `actions[0]`. The primary action is a `Button` with `data-testid="action-<name>"`. When more actions remain, a `More actions` button (accessible name exactly `More actions`) opens a `DropdownMenu` whose items keep `data-testid="action-<name>"` and the same labels as today's buttons.
  - `StatCard` + `StatCardProps { label: string; value: number | undefined; href: string; renderLink: (href: string, children: ReactNode) => ReactNode; tone?: 'default' | 'danger' | 'warning' }`. It renders `data-testid="stat-card"` and a `Skeleton` when `value` is `undefined`.

- [ ] **Step 1: Write the failing tests.**
  - `primaryAction prefers acknowledge, else the first allowed action`: `primaryAction(['close','acknowledge'])` → `'acknowledge'`; `primaryAction(['reopen'])` → `'reopen'`; `primaryAction([])` → `undefined`.
  - `AlertHeader puts the other actions in More actions`: with actions `['acknowledge','close','escalate']`, the button `Acknowledge` is visible and `Close` is not a visible button. After `userEvent.click(More actions)`, the menu item `Close` exists; clicking it calls `onAction('close')`.
  - `AlertHeader with one action shows no More actions`: actions `['reopen']` → no `More actions` button.
  - `StatCard shows a skeleton, never 0, while loading`: `value={undefined}` → no text `0` inside `stat-card`, and a skeleton element is present. `value={7}` → text `7` and the label.
  - Update the existing `AlertHeader renders Acknowledge…` test to the new markup.
  Run → FAIL.
- [ ] **Step 2: Implement.** `AlertSummaryCard` composes the new header (without actions), highlights and the last three timeline events in a `Card`, with an "Open in app" link via `renderLink`. Export `StatCard`, `StatCardProps` and `primaryAction` from the index.
- [ ] **Step 3: Run** `pnpm vitest run --project @app/ui` → PASS.
- [ ] **Step 4: Commit** `feat(ui): AlertHeader primary action and menu, StatCard, summary card on shadcn`.

### Task 4: AlertTable on TanStack Table, ActionRequestCard; Fluent leaves @app/ui

**Files:**
- Modify: `packages/ui/src/components/{AlertTable,ActionRequestCard}.tsx`, `packages/ui/package.json` (remove both `@fluentui/*` deps), `packages/ui/test/components.test.tsx` (drop the `FluentProvider` import), `packages/ui/test/setup.ts` (keep the `ResizeObserver` stub only if Base UI still needs it in jsdom), `pnpm-lock.yaml`

**Interfaces:**
- Produces: `AlertTableProps` unchanged (`items`, `sort?`, `onSortChange?`, `renderAlertLink`), plus `onRowClick?: (id: string) => void`. Columns, in order: ID (link via `renderAlertLink`), Title, Severity, Status, Assignees, Trader, Created, Updated. Sortable headers: Severity (`severity`), Created (`createdAt`), Updated (`updatedAt`). Each sortable header is a `button` inside a `columnheader`, named after the column.
- Sort rule (unchanged from today): clicking the column that is currently sorted flips its direction; clicking any other column sends the descending value (`-severity`, `-createdAt`, `-updatedAt`).

- [ ] **Step 1: Write the failing tests.**
  - `AlertTable has Created and Updated sort headers`: clicking `Created` with `sort={undefined}` → `onSortChange('-createdAt')`; with `sort="-createdAt"` → `onSortChange('createdAt')`.
  - `AlertTable rows call onRowClick, and the ID link does not double-fire`: clicking a row's Title cell → `onRowClick('ALT-1042')`. Clicking the ID link does not call `onRowClick`.
  - The three existing AlertTable tests stay as they are.
  Run → FAIL.
- [ ] **Step 2: Implement** with `useReactTable` (manual sorting; sorting state derived from the `sort` prop; no client sort or pagination), rendered through the `Table` primitive. Rows: `data-testid="alert-row"`, `cursor-pointer`, hover background. Header sort indicators use lucide arrow icons with `aria-sort` on the `th`. Rebuild `ActionRequestCard` on `Card`, `Badge`, `Button` and `Textarea`, keeping the two-step reject flow and all its test ids.
- [ ] **Step 3: Run** `pnpm vitest run --project @app/ui`, then `grep -r "@fluentui" packages/ui` → no matches. Then `pnpm typecheck && pnpm lint && pnpm test && pnpm e2e` → green. The web app still uses Fluent around these components.
- [ ] **Step 4: Commit** `feat(ui): AlertTable on TanStack Table, ActionRequestCard on shadcn; drop Fluent from @app/ui`.

---

## PR 3 — Shell and alert list

### Task 5: Sidebar shell, top bar, user switcher, theme toggle, settings

**Files:**
- Create: `apps/web/src/components/shell/{AppSidebar,TopBar,Breadcrumbs,UserSwitcher,ThemeToggle}.tsx`
- Delete: `apps/web/src/components/AppHeader.tsx`
- Modify: `apps/web/src/routes/__root.tsx`, `apps/web/src/components/SettingsDialog.tsx`, `apps/web/src/components/UserGate.tsx` (loading state uses `Skeleton`), `apps/web/e2e/shell.spec.ts`

**Interfaces:**
- Consumes: `Sidebar*`, `Breadcrumb*`, `Select*`, `Dialog*`, `Switch`, `Button` from `@app/ui`; `usePendingCount`, `useUsers`, `useUiStore`.
- Produces: `RootLayout` = `SidebarProvider` > `AppSidebar` + `SidebarInset` (`TopBar` + `<main>`). The nav keeps `aria-label="Primary"` with links named `Alerts` and `Queue`, and `queue-badge` beside Queue. `UserSwitcher` is a `Select` whose trigger has `data-testid="current-user"` and `aria-label="Current user"`, with items of role `option` showing the user's name. `ThemeToggle` keeps `data-testid="theme-toggle"`. Settings opens from a sidebar footer button with `data-testid="settings-button"`. `breadcrumbsFor(pathname: string): Array<{ label: string; to?: string }>` is exported from `Breadcrumbs.tsx`.

- [ ] **Step 1: Write the failing tests.**
  - Unit, `apps/web/src/components/shell/breadcrumbs.test.ts`: `breadcrumbsFor('/alerts')` → `[{label:'Alerts'}]`; `breadcrumbsFor('/alerts/ALT-1042')` → `[{label:'Alerts',to:'/alerts'},{label:'ALT-1042'}]`; `breadcrumbsFor('/queue/AR-0007')` → `[{label:'Queue',to:'/queue'},{label:'AR-0007'}]`; `breadcrumbsFor('/nope')` → `[]`.
  - E2E, `shell.spec.ts`, new test `dark mode flips page and table colours`: on `/alerts`, read the computed `background-color` of `body` and the `color` of the first `alert-row`. Click `theme-toggle`, then expect `html` to have class `dark` and both values to have changed.
  - E2E, `shell.spec.ts`, new test `user switcher works from the keyboard`: focus `current-user`, press Enter, ArrowDown to `Tom Becker`, press Enter, expect `Tom Becker`; open it again, press Escape, expect focus back on `current-user`.
  - E2E, `shell.spec.ts`, new test `sidebar collapses to a sheet on narrow screens`: at viewport 390×844, the `Primary` nav is hidden until the sidebar trigger (accessible name `Toggle Sidebar`) is clicked, then `Queue` is clickable and navigates to `/queue`.
  Run `pnpm vitest run --project @app/web` and `pnpm e2e -- shell.spec.ts` → the new tests FAIL.
- [ ] **Step 2: Implement** the shell. The existing shell tests keep their selectors (`current-user` text, `option` role, `navigation` Primary, `[data-theme]`).
- [ ] **Step 3: Run** `pnpm typecheck && pnpm lint && pnpm test && pnpm e2e` → green.
- [ ] **Step 4: Commit** `feat(web): sidebar shell, breadcrumbs, user switcher and theme toggle on shadcn`.

### Task 6: Alert list: stat cards, toolbar, faceted filters, table, pagination

**Files:**
- Create: `apps/web/src/components/list/{FacetedFilter,ListToolbar,StatCards}.tsx`
- Delete: `apps/web/src/components/FilterBar.tsx` (replaced by `ListToolbar`)
- Modify: `apps/web/src/routes/alerts.index.tsx`, `apps/web/src/components/{SearchBox,Pagination,AlertLink}.tsx`, `apps/web/src/hooks.ts`, `apps/web/e2e/alerts-list.spec.ts`, plus `apps/web/e2e/stat-cards.spec.ts` (new)

**Interfaces:**
- Consumes: `AlertTable`, `StatCard` (Task 3/4), `alertListUrl`, `queueUrl`, `verifiedUserId`, `queryKeys`, `usePendingCount`.
- Produces:
  - `useAlertCount(search: AlertListSearch): number | undefined` in `hooks.ts`. It calls `GET /api/alerts` with the search plus `pageSize: 1`, with the query key `queryKeys.alerts({ ...search, pageSize: 1 })`, so existing `['alerts']` invalidations refresh it. It returns `total`.
  - `statCards(currentUserId: string)` in `StatCards.tsx`: the four definitions from spec §5, each `{ label, search?: AlertListSearch, href }`. Labels exactly `Open`, `High & critical`, `Assigned to me`, `Awaiting you`. `Awaiting you` uses `usePendingCount` and links to `/queue`.
  - `FacetedFilter` props `{ label: string; options: Array<{ value: string; label: string }>; selected: string[]; onChange: (next: string[]) => void }`. The trigger is a `button` whose accessible name starts with `label` (selected labels follow as badges; with more than 2 selected, show `N selected`). The popover contains a search `Input` (placeholder `Filter <label>…`) and one `Checkbox` per option, named by its label.
  - Toolbar order: SearchBox, Status, Severity, Category, Desk (faceted), Trader (`Select`, `aria-label="Trader"`), `Switch` named `Assigned to me`, Reset (named `Reset`, shown when any filter is set). The chip row and `filter-chip` stay as today.
  - The page header shows `Alerts` and `result-count` (`"<n> alerts"`, unchanged text). The footer shows `Showing <from>–<to> of <total>` and pagination (`data-testid="pagination"`, Previous/Next and page-number buttons).
  - Row click navigates to `alertUrl('', id)`.

- [ ] **Step 1: Update the e2e specs first** (they fail against the current UI):
  - In `alerts-list.spec.ts`, replace each `getByRole('combobox', { name: X })` + `menuitemcheckbox` with `getByRole('button', { name: new RegExp('^' + X) })` + `getByRole('checkbox', { name: option, exact: true })`. The W1 test asserts `getByRole('button', { name: /^Status/ })` contains `Open` (same for Severity and Desk).
  - The toolbar's reset button is named `Reset`. The empty state keeps its own `Clear filters` button, so that test is unchanged.
  - New test `faceted filter works from the keyboard`: Tab to the Status trigger, press Enter, type `prog` into the filter input, which narrows the list to `In Progress`; press Space on it, then Escape. Expect the URL to have `status=in_progress` and focus to be back on the trigger.
  - New test `list has no horizontal page scroll at 390px`: set viewport 390×844, go to `/alerts`, and expect `document.documentElement.scrollWidth <= window.innerWidth`.
  - New test `shared component styles reach the app`: the computed `background-color` of the first `severity-badge` is not `rgba(0, 0, 0, 0)`, and the first `alert-row` cell's `padding-top` is not `0px`.
  - New `stat-cards.spec.ts`: on `/alerts`, the four `stat-card`s show the labels in order. Each count equals the `result-count` on the page its link opens (click, then compare). Clicking `Awaiting you` opens `/queue`. After `agentRequest` posts a comment on ALT-1042, `Awaiting you` shows `1` within 5 s.
  Run `pnpm e2e -- alerts-list.spec.ts stat-cards.spec.ts` → FAIL.
- [ ] **Step 2: Implement** the list page as in spec §5. `SearchBox` keeps its render-time prop sync and debounce, and its role `searchbox`.
- [ ] **Step 3: Run** `pnpm typecheck && pnpm lint && pnpm test && pnpm e2e` → green. Screenshots of `/alerts` in light and dark, at 1440 and 390 wide, go in the PR.
- [ ] **Step 4: Commit** `feat(web): dashboard alert list with stat cards, faceted filters and TanStack table` (list each changed e2e selector in the body).

---

## PR 4 — Alert detail and dialogs

### Task 7: Two-column alert detail

**Files:**
- Create: `apps/web/src/components/detail/DetailsPanel.tsx`
- Modify: `apps/web/src/routes/alerts.$alertId.tsx`, `apps/web/src/components/{PendingRequestsBanner,CommentComposer,MaterialsTab,DataTabView}.tsx`, `apps/web/e2e/alert-detail.spec.ts`

**Interfaces:**
- Consumes: `AlertHeader`, `AlertHighlights`, `AssigneesPanel`, `AlertTimeline`, `DataTabTable`, `Tabs*`, `Card*`.
- Produces: `DetailsPanel({ alert }: { alert: Alert })` with `data-testid="details-panel"`. It lists Trader, Instrument, Rule (`rule-indicators` moves here if the header no longer shows it), Desk, Category, Created and Updated as a definition list (`dt`/`dd`). Layout: `lg:grid-cols-[1fr_320px]`. The right column holds `DetailsPanel` then `AssigneesPanel`, and stacks under the left column below `lg`. Tabs keep the role `tab`, the names, and the `?tab=`/`?dataTab=` binding.

- [ ] **Step 1: Write the failing e2e tests** in `alert-detail.spec.ts`:
  - `details panel lists trader, instrument and rule`: on `/alerts/ALT-1042`, `details-panel` contains the trader id `T-0412`, the instrument and the rule name from the seed (read them from the existing header test's expectations).
  - `detail page has no horizontal page scroll at 390px`.
  - Update `header shows the alert, its rule and the assignees` only where the rule moved into the panel.
  Run `pnpm e2e -- alert-detail.spec.ts` → FAIL.
- [ ] **Step 2: Implement.**
- [ ] **Step 3: Run** the full suite → green. Add screenshots of `/alerts/ALT-1042` (light, dark, narrow).
- [ ] **Step 4: Commit** `feat(web): two-column alert detail with details panel`.

### Task 8: Action dialogs on shadcn

**Files:**
- Modify: `apps/web/src/components/dialogs/*.tsx` (all 8), `apps/web/e2e/alert-actions.spec.ts`, `apps/web/e2e/access-queue.spec.ts:175`

**Interfaces:**
- Consumes: `Dialog*`, `Select*`, `Input`, `Textarea`, `Label`, `Button` from `@app/ui`; `primaryAction` behaviour from Task 3.
- Produces: `ActionDialog` keeps its props. Dialogs keep role `dialog`, field labels (`Escalate to`, `Outcome`, `Primary`, `Backup`, …) as `Select` triggers of role `combobox` with options of role `option`, the submit button names (`Acknowledge`, `Escalate`, `Close alert`, …), mounting only while open, and showing server errors inside the dialog.

- [ ] **Step 1: Update the e2e specs first.** Add a helper in `alert-actions.spec.ts`:

```ts
const openAction = async (page: Page, name: string) => {
  const primary = page.getByRole('button', { name, exact: true });
  if (await primary.isVisible()) return primary.click();
  await page.getByRole('button', { name: 'More actions' }).click();
  await page.getByRole('menuitem', { name, exact: true }).click();
};
```

  Use it for every header action click (lines 9, 21, 44, 50, 58, 81) and in `access-queue.spec.ts:175`. Rewrite `header buttons come from allowedActions only` as: on ALT-0987, `Reopen` is a button and there is no `More actions`. On ALT-1042, `Acknowledge` is a button, and `More actions` lists `Close` and `Escalate` and not `Reopen`. Add `More actions menu works from the keyboard`: focus `More actions`, press Enter, ArrowDown to `Escalate`, press Enter, expect the dialog; Escape closes it and focus returns to `More actions`. Line 14's `action-close` assertion opens the menu first.
  Run `pnpm e2e -- alert-actions.spec.ts` → FAIL.
- [ ] **Step 2: Implement** the dialogs.
- [ ] **Step 3: Run** the full suite → green.
- [ ] **Step 4: Commit** `feat(web): action dialogs and More actions menu on shadcn` (list the changed selectors).

---

## PR 5 — Queue and cleanup

### Task 9: Queue as a table, request detail

**Files:**
- Modify: `apps/web/src/routes/{queue.index,queue.$requestId}.tsx`, `apps/web/src/components/{RequestCard,SettingsDialog}.tsx`, `apps/web/e2e/access-queue.spec.ts`

**Interfaces:**
- Produces: `/queue` keeps the status `Tabs` (`Pending`, `Approved`, `Rejected`, `Failed`). Each tab shows a `Table` with the columns Request (link to `/queue/<id>`), Alert (link), Action, Requested, Status (`request-status` badge), plus a `rationale` cell that is truncated to one line, with the full text in `title`. `/queue/$requestId` centres `ActionRequestCard` (max-w-2xl). `RequestCard` becomes `RequestRow` (rename the file). Rows keep `data-testid="action-request-card"`, so the queue specs keep their `card(page)` helper. If a spec needs the exact comment text, it opens the request.

- [ ] **Step 1: Update the queue specs** where they read the comment body from the list: they assert it on `/queue/<id>` instead. Add `queue rows link to the request`: clicking the first pending row's request link opens `/queue/AR-0001`. Run → FAIL.
- [ ] **Step 2: Implement.**
- [ ] **Step 3: Run** the full suite → green. Add queue screenshots.
- [ ] **Step 4: Commit** `feat(web): queue as a table on shadcn`.

### Task 10: Remove Fluent, update docs, final check

**Files:**
- Modify: `apps/web/package.json` (remove `@fluentui/*`), `apps/web/src/main.tsx` (remove `FluentProvider`), every remaining file that `grep -rl "@fluentui\|makeStyles\|tokens\." apps packages` finds, `packages/ui/test/setup.ts` (drop the Fluent comment), `README.md`, `docs/superpowers/specs/2026-11-17-alerts-demo-design.md` (lines naming Fluent: §3 stack, §9 heading text, repo tree comment), `pnpm-lock.yaml`

- [ ] **Step 1: Write the failing guard test** `apps/web/src/no-fluent.test.ts`: `no Fluent anywhere in the UI sources` walks `apps/web/src` and `packages/ui/src` (resolved from `import.meta.dirname`) and fails on any `@fluentui/` import. Run `pnpm vitest run --project @app/web` → FAIL (main.tsx still imports it).
- [ ] **Step 2: Remove** Fluent and any leftovers. The ui store's `density` is still unread, so delete it from the store and its `partialize` (a persisted `density` key in old localStorage is ignored harmlessly).
- [ ] **Step 3: Run** `pnpm install && pnpm typecheck && pnpm lint && pnpm test && pnpm e2e` → green. Then `pnpm --filter @app/web build` and compare the main JS bundle size with the size before Task 1 (record both in the commit).
- [ ] **Step 4: Commit** `chore(web): remove Fluent UI; docs name shadcn/ui and Tailwind`.
