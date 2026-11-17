# UI rework: shadcn/ui (Base UI) + Tailwind v4 — Design

Date: 2026-11-17 · Status: draft for approval · Builds on: `2026-11-17-alerts-demo-design.md` (phase 1, merged)

## 1. Intent

The phase 1 app works, but it does not look like a professional dashboard. It renders Fluent UI v9 defaults: a top bar, wide loose rows, generic controls. This rework replaces Fluent with **shadcn/ui components built on Base UI**, styled with **Tailwind v4**, and changes the layout to a standard dashboard: a sidebar shell, summary cards, a dense data table with popover filters, and a two-column detail page.

Success: an analyst opening the app sees a polished, dense, modern dashboard in light and dark mode. Every phase 1 behaviour, URL and deep link still works, and the whole test suite is green at every step.

## 2. Goals, non-goals, anti-goals

**Goals**
- Remove `@fluentui/react-components`, `@fluentui/react-icons` and every `makeStyles`/`tokens` use.
- Copy the shadcn/ui components (Base UI variant) into `@app/ui` and style everything with Tailwind v4 utilities and shadcn theme variables.
- Render the alert list with **TanStack Table** (decided by the user).
- Rework the layout as in §5 (approved by the user).
- Keep the 52 Playwright tests and the unit tests green in every PR, changing a selector only where its control changed.

**Non-goals**
- No API, server, MCP or domain changes. Everything in §5 comes from endpoints that already exist.
- No new features beyond the summary cards.
- No rows-per-page control. The page size stays at 25: there is no `pageSize` URL param, and adding one would change the deep-link codec.

**Anti-goals** (this has failed even if it works)
- URLs or deep links change shape. `alertListUrl`/`alertUrl`/`queueUrl` output must still equal the app's URLs.
- `@app/ui` starts importing router, query or store code. Phase 2 bundles must still be able to import it alone.
- A home-grown design system grows next to shadcn. Theme changes go through shadcn's CSS variables; components keep shadcn's markup and variants.
- A PR in the stack leaves the build, typecheck, lint or any test red.

## 3. Constraints

- The stack stays as is: pnpm 12 workspaces, TypeScript 6 project references (`tsc -b`), Vite 8, React 19, TanStack Router/Query, zustand, Vitest 5 projects, oxlint/oxfmt, Playwright.
- Versions current today: shadcn 4.23, `@base-ui/react` 1.9, `tailwindcss`/`@tailwindcss/vite` 4.3, `@tanstack/react-table` 9.3, `lucide-react` 1.x. Pin exact versions in the plan.
- `@app/ui` stays presentational: data in, callbacks out (phase 1 spec §9). The import-guard test in `packages/ui/test/components.test.tsx` currently bans every `@tanstack/` import. It must be narrowed to `@tanstack/react-router` and `@tanstack/react-query`, so that `@tanstack/react-table` (a pure render helper) is allowed.
- Phase 2 renders `AlertSummaryCard`, `AlertTable` and `ActionRequestCard` in Cowork from single-file bundles. `@app/ui` must export one CSS entry (Tailwind import, theme variables, `@source` for its own components) that both the web app and those bundles import.
- Tailwind only sees classes in files it scans. The web app's CSS must `@source` the `@app/ui` source, or the shared components render unstyled.
- Sorting and paging stay server-side (the `sort` and `page` URL params drive `/api/alerts`). TanStack Table runs with manual sorting and manual pagination. It renders and reports clicks; it never sorts or slices data itself.

## 4. Approaches

1. **Gradual migration, both libraries installed for a while** (chosen by the user). Add Tailwind and shadcn next to Fluent, then move one area per PR and remove Fluent last. Each PR builds and passes everything. The cost: for a few PRs both style systems are loaded. Tailwind's preflight reset can visibly disturb screens Fluent still renders until their own PR lands. That is acceptable mid-stack, but no test may break because of it.
2. **Rewrite everything at once, split into PRs afterwards.** Faster to write, but the middle PRs rarely build on their own. Rejected.
3. **A new UI package next to the old one, then delete the old one.** Clean to review, but it duplicates every shared component, and phase 2 has two packages to choose from until the end. Rejected.

## 5. What the user sees

### App shell (all routes)

```
┌────────────┬──────────────────────────────────────────────────┐
│ ◆ Alerts   │ Alerts › ALT-1042                       [☾]      │
│            ├──────────────────────────────────────────────────┤
│ ▣ Alerts   │  <route content>                                 │
│ ☰ Queue  3 │                                                  │
│ ────────── │                                                  │
│ (DK) Dana ▾│                                                  │
└────────────┴──────────────────────────────────────────────────┘
```

- shadcn `Sidebar`: brand, nav (Alerts; Queue with the pending count badge, `data-testid="queue-badge"` kept). At the bottom, the user switcher (avatar, name, dropdown of users) and a Settings entry that opens the existing settings dialog. The sidebar collapses to icons and becomes a sheet on narrow screens.
- Top bar: sidebar trigger, breadcrumbs derived from the route (Alerts › ALT-1042, Queue › AR-0007), and the light/dark toggle.
- Theme: shadcn's neutral palette with its own light and dark variables. Dark mode toggles the `dark` class on `<html>` from the existing zustand `theme` value.

### Alert list (`/alerts`)

```
 Alerts                                                 96 alerts
 ┌Open 31────┐ ┌High & critical 12┐ ┌Assigned to me 7┐ ┌Awaiting you 3┐
 [Search…] [+Status] [+Severity] [+Category] [+Desk] [Trader ▾] [◯ Mine] ⨯ Reset
 ┌─ID──────Title─────────────Severity─Status──Assignees─Trader─Created─Updated┐
 │ALT-1042 Spoofing on T-0412 ● High  Open   DK, MS    T-0412  1d      2h     │
 └───────────────────────────────────────────────────────────────────────────┘
 Showing 1–25 of 96                                 ‹ Prev 1 2 3 4 Next ›
```

- **Summary cards** (approved by the user). Four cards, each a link built with `alertListUrl`/`queueUrl`. Each number is the `total` of one existing request:
  - Open: `status=open,in_progress`
  - High & critical: `severity=high,critical&status=open,in_progress`
  - Assigned to me: `assigneeId=<current user>&status=open,in_progress`
  - Awaiting you: the current user's pending action-request count (the hook the header already uses); this card links to `/queue`.

  The cards ignore the list's current filters. They are a fixed overview, and clicking one replaces the filters.
- **Toolbar:** the debounced search box, then one popover filter per multi-value field: status, severity, category, desk. Each is a shadcn "faceted filter": a dashed outline button, a popover with a searchable checkbox list, and the selected values shown as badges in the button. There are no per-option counts, since the API returns none. Then the controls the filter bar already has: a single-select Trader picker and the "Assigned to me" toggle. A Reset button shows when any filter is set. Filters with no control (`instrument`, `from`, `to`, and an assignee other than the current user) stay visible as removable chips, as today.
- **Table:** `AlertTable` in `@app/ui`, built on TanStack Table and the shadcn `Table`. Rows are dense, highlight on hover, and the whole row navigates. The ID cell stays a real link, so middle-click and the e2e link selectors keep working. The Severity, Created and Updated column headers are sort buttons. Between them they cover every `AlertSort` value, so there is no separate sort dropdown. A click reports the next `AlertSort` value through a callback, flipping direction on a second click as today (`sort=-severity`, then `sort=severity`).
- **Footer:** a "Showing x–y of n" count and Prev/Next with page numbers, driven by the `page` URL param.

### Alert detail (`/alerts/$alertId`)

```
 Alerts › ALT-1042
 ALT-1042  Spoofing on T-0412           ● High  Open   [Acknowledge] [⋯]
 ┌ pending Claude request banner (if any) ─────────────────────────────┐
 ┌──────────────────────────────────────────────┐ ┌ Details ──────────┐
 │ Highlights (cards)                           │ │ Trader   T-0412   │
 │ [Overview] [Timeline] [Materials] [Data]     │ │ Instrument …      │
 │ tab content                                  │ │ Rule     …        │
 │                                              │ │ Desk / Category   │
 │                                              │ │ Created / Updated │
 │                                              │ ├ Assignees ────────┤
 │                                              │ │ DK Dana (owner) ✎ │
 └──────────────────────────────────────────────┘ └───────────────────┘
```

- The header shows the ID, title, badges, the primary action as a button, and the remaining actions in a dropdown menu. Every action still opens its dialog. Which action is primary follows `allowedActions` (acknowledge when allowed, otherwise the first allowed one).
- The left column holds the banner, highlights and the tabs (`?tab=`, `?dataTab=` unchanged). The right column (stacked under the left on narrow screens) holds a details panel and the assignees panel with its edit button.
- The dialogs (acknowledge, close, reopen, escalate, assignees, add link, upload) become shadcn `Dialog` + form fields. Behaviour is unchanged: dialogs mount only while open, and server errors show inside the dialog and keep it open.

### Queue (`/queue`, `/queue/$requestId`)

- Status tabs as today. The list becomes the same dense table style (request, alert link, action, requested by, created, status). Request detail uses `ActionRequestCard` in a centred column. Its two-step reject keeps its flow.

## 6. Package layout

- `packages/ui`
  - `components.json` for the shadcn CLI (Base UI, neutral, CSS variables, aliases into `src/`).
  - `src/primitives/*`: shadcn components as generated (button, badge, card, dialog, dropdown-menu, popover, select, tabs, table, input, textarea, switch, checkbox, label, separator, sidebar, sheet, tooltip, avatar, breadcrumb, skeleton, and whatever else the screens need).
  - `src/lib/cn.ts` (`clsx` + `tailwind-merge`).
  - `src/styles.css`: `@import "tailwindcss"`, `tw-animate-css`, the shadcn theme variables (light and `.dark`), and `@source` for the package's own `src`. Exported as `@app/ui/styles.css` (a second entry in the package's `exports`).
  - `src/components/*`: the existing domain components, rewritten on the primitives, keeping their names and props unless a layout change needs new ones (for example `AlertTable` taking a sort callback). Plus a new `SummaryCard` for the overview cards, kept presentational.
- `apps/web`: `@tailwindcss/vite` in `vite.config.ts`, and `src/index.css` importing `@app/ui/styles.css`. Containers keep living in `apps/web/src/components`. The faceted filter, search box and pagination are web containers composed from `@app/ui` primitives, since they hold URL state.
- Icons: `lucide-react` (shadcn's default), replacing `@fluentui/react-icons`.

## 7. The PR stack

Each PR passes `pnpm typecheck`, `pnpm lint`, `pnpm test` and `pnpm e2e`, and gets light and dark screenshots of the screens it touched, checked in the browser.

1. **Setup.** Tailwind v4 and shadcn init in `@app/ui`, the primitives the stack needs, `styles.css`, the web app importing it, the dark class wired to the theme store (Fluent's provider still follows the same value), the narrowed import guard, and a TanStack Table v9 check (below). No screen changes yet, beyond whatever the preflight reset does to Fluent screens. Any test that preflight breaks gets fixed here.
2. **Shared components.** Every `@app/ui` component rebuilt on shadcn + Tailwind, `AlertTable` on TanStack Table, the new `SummaryCard`. Component tests drop `FluentProvider` and keep asserting the same behaviour. Fluent leaves `@app/ui`.
3. **Shell and alert list.** Sidebar layout, top bar, user switcher, settings dialog, summary cards, toolbar with faceted filters, table footer. E2E selectors for the status and severity filters change from Fluent's `menuitemcheckbox`.
4. **Alert detail and dialogs.** Two-column layout, header actions, tabs, comment composer, materials, data tab, banner, all dialogs.
5. **Queue and cleanup.** Queue pages and `RequestCard`. Remove the Fluent dependencies, `FluentProvider` and any leftovers. Update the phase 1 spec's stack lines and the README where they name Fluent.

**TanStack Table 9 check (first step of PR 1).** v9 is a recent major version, and its API differs from v8. Before building on it, prove in a throwaway test that a table with manual sorting and controlled sort state renders rows and reports header clicks. If v9 cannot do that cleanly, use v8 and note why.

## 8. Testing

- Unit (`@app/ui`, jsdom): the existing component tests carry over with the same assertions. New tests cover the `AlertTable` sort callback (the next `AlertSort` value per header click), the row link, `SummaryCard`, and the primary-action choice in `AlertHeader`.
- E2E: the 52 specs stay, finding elements by role and accessible name. Selectors change only where a control changed type (the faceted filters, the actions dropdown on the detail page, the user switcher). Each changed selector is listed in its PR description. New specs: summary card numbers and links, the sidebar navigation, and the actions dropdown.
- Visual: screenshots of the list, detail and queue in light and dark, at desktop and narrow widths, attached to PRs 3–5.

## 9. Calls I made (the user can override)

- Summary card definitions and that they ignore current filters (§5).
- Page size fixed at 25, no rows-per-page control (keeps the deep-link codec unchanged).
- Faceted filters for status, severity, category and desk. Trader and "Assigned to me" keep their current controls. The remaining single-value filters stay as removable chips.
- Sorting only through the Severity, Created and Updated column headers. The table gains a Created column so every sort value has a header.
- The queue list becomes a table instead of a stack of cards.
- The primary header action follows `allowedActions`; the rest go in a dropdown.
- Neutral theme, shadcn's default font stack, and lucide icons.
- shadcn primitives live in `@app/ui/src/primitives`; containers with URL state stay in the web app.

## 10. Left to the builder

- The exact shadcn style preset and which extra primitives to generate.
- Spacing and density within shadcn's scale. Column widths and truncation.
- Whether pnpm needs a build approval for Tailwind's native package, and how the oxfmt and oxlint ignores cover generated primitives (the primitives are committed source and should pass lint as generated, or carry a narrow ignore).
- Breadcrumb labels for each route.
- The ui store's `density` value, which nothing reads today. Leave it, or remove it in PR 5 if it is still unused.
