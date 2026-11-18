# Open in Cowork Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Buttons in the web app that open a dialog with an editable, prefilled prompt, which the analyst sends to a new Cowork session via `claude://cowork/new?q=…` or copies.

**Architecture:** A pure prompt and link builder in `@app/domain` (beside the existing deep-link builders), one dialog plus button component in `apps/web`, wired into five places. No server, MCP or plugin changes. "Open in Cowork" is a real `<a href="claude://…">`, so Playwright can assert the href without following it.

**Tech Stack:** TypeScript, Zod, React 19, TanStack Router, `@app/ui` (shadcn on Base UI, Tailwind v4), lucide-react, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-18-open-in-cowork-design.md`

## Global Constraints

- Link format: `claude://cowork/new?q=<encodeURIComponent(prompt)>`. No `folder` or `file` parameters.
- The prompt is capped at 14,000 characters before encoding (`COWORK_PROMPT_MAX = 14000`).
- Every prompt starts with exactly: `Using the alerts connector and the investigate-alert skill, `
- Prompts carry ids and URLs only, never alert data.
- Never auto-open: every button opens the dialog first. Nothing is sent until the analyst presses Send in Cowork.
- Dialog hint copy (exact): `Claude will fetch the alert itself. Nothing is sent until you press Send in Cowork.`
- After Open, note copy (exact): `If Cowork didn't open, copy the prompt and paste it into a new Cowork session.`
- Do not modify `packages/ui/src/components/AlertHeader.tsx` (shared with the Cowork views).
- No new dependencies.

## Review Focus

1. **The analyst empties the textarea.** "Open in Cowork" must be disabled (no `href`, `aria-disabled="true"`), not open an empty session. Test in Task 2.
2. **Prompts with `&`, `#`, `?`, `%`, quotes or non-ASCII text** (a list URL with several filters, an edited prompt). `decodeURIComponent` of the `q` value must equal the prompt exactly. Test in Task 1.
3. **A prompt over 14,000 characters** (a long edit) is cut to 14,000 before encoding, not rejected. Test in Task 1.
4. **The dialog reopened after an edit** starts again from the case's prompt (edits don't leak between cases). Test in Task 2.
5. **Copy prompt** copies the edited text, not the original. Test in Task 2.

---

## File Structure

| File | Responsibility |
|---|---|
| `packages/domain/src/cowork.ts` (create) | `CoworkCase` type, `coworkPrompt`, `coworkLink`, labels, max length |
| `packages/domain/src/index.ts` (modify) | re-export `cowork.ts` |
| `packages/domain/test/cowork.test.ts` (create) | Vitest for the builder |
| `apps/web/src/components/OpenInCowork.tsx` (create) | `OpenInCoworkDialog` and `OpenInCoworkButton` |
| `apps/web/src/routes/alerts.$alertId.tsx` (modify) | cases investigate, second_opinion, pattern |
| `apps/web/src/components/list/ListToolbar.tsx` (modify) | case triage |
| `apps/web/src/routes/queue.$requestId.tsx` (modify) | case explain_request |
| `apps/web/src/components/shell/AppSidebar.tsx` (modify) | case handover |
| `apps/web/e2e/open-in-cowork.spec.ts` (create) | Playwright for every entry point |
| `docs/spike-notes.md` (modify), `spikes/open-in-cowork.html` (delete) | record the spike, remove the throwaway |

---

### Task 1: Prompt and link builder in `@app/domain`

**Files:**
- Create: `packages/domain/src/cowork.ts`
- Modify: `packages/domain/src/index.ts` (add `export * from './cowork.ts';`)
- Test: `packages/domain/test/cowork.test.ts`

**Interfaces:**
- Consumes: `alertListUrl(base: string, search: AlertListSearch): string` and `type AlertListSearch` from `./links.ts` and `./search-params.ts`.
- Produces:
  ```ts
  export type CoworkCase =
    | { kind: 'investigate'; alertId: string }
    | { kind: 'second_opinion'; alertId: string }
    | { kind: 'pattern'; traderId: string; traderName: string }
    | { kind: 'triage'; base: string; search: AlertListSearch }
    | { kind: 'explain_request'; requestId: string; alertId: string }
    | { kind: 'handover' };
  export type CoworkCaseKind = CoworkCase['kind'];
  export const COWORK_PROMPT_MAX = 14000;
  export const COWORK_PROMPT_PREFIX = 'Using the alerts connector and the investigate-alert skill, ';
  export const COWORK_CASE_LABELS: Record<CoworkCaseKind, string>;
  export function coworkPrompt(c: CoworkCase): string;
  export function coworkLink(prompt: string): string; // '' when prompt.trim() is empty
  ```

- [ ] **Step 1: Write the failing tests** in `packages/domain/test/cowork.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { COWORK_CASE_LABELS, COWORK_PROMPT_MAX, coworkLink, coworkPrompt } from '../src/index.ts';

const P = 'Using the alerts connector and the investigate-alert skill, ';
const q = (link: string) => decodeURIComponent(link.replace('claude://cowork/new?q=', ''));

describe('coworkPrompt', () => {
  it('investigate', () =>
    expect(coworkPrompt({ kind: 'investigate', alertId: 'ALT-1051' })).toBe(
      `${P}investigate ALT-1051. Test the evidence against the rule and recommend one next action.`,
    ));
  it('second opinion', () =>
    expect(coworkPrompt({ kind: 'second_opinion', alertId: 'ALT-0987' })).toBe(
      `${P}review the closure of ALT-0987. Quote the closing note, compare it with related alerts, and say whether it should be reopened.`,
    ));
  it('pattern', () =>
    expect(coworkPrompt({ kind: 'pattern', traderId: 'T-0166', traderName: 'Jonas Weber' })).toBe(
      `${P}check whether trader Jonas Weber (T-0166) has a pattern across alerts, any status, and how each was closed.`,
    ));
  it('triage embeds the same list URL the app builds', () =>
    expect(
      coworkPrompt({
        kind: 'triage',
        base: 'http://localhost:5173',
        search: { status: ['open'], severity: ['high'], desk: ['eu-equities'], q: 'layering' },
      }),
    ).toBe(
      `${P}triage the alerts at http://localhost:5173/alerts?status=open&severity=high&desk=eu-equities&q=layering: search with the same filters and rank them.`,
    ));
  it('explain request', () =>
    expect(coworkPrompt({ kind: 'explain_request', requestId: 'AR-0002', alertId: 'ALT-1051' })).toBe(
      `${P}explain request AR-0002 on ALT-1051: what it changes, why you asked for it, and what I should check before approving.`,
    ));
  it('handover', () => expect(coworkPrompt({ kind: 'handover' })).toBe(`${P}write my shift handover.`));
  it('has a label for every kind', () =>
    expect(Object.keys(COWORK_CASE_LABELS).sort()).toEqual(
      ['explain_request', 'handover', 'investigate', 'pattern', 'second_opinion', 'triage'],
    ));
});

describe('coworkLink', () => {
  it('uses the Cowork scheme and nothing else', () =>
    expect(coworkLink('hi there')).toBe('claude://cowork/new?q=hi%20there'));
  it('round-trips awkward text exactly', () => {
    const text = `a&b=c #x ?y 100% "q" 'z' é ü 日本 ${'\n'}next`;
    expect(q(coworkLink(text))).toBe(text);
  });
  it('caps the prompt at 14,000 characters before encoding', () =>
    expect(q(coworkLink('x'.repeat(COWORK_PROMPT_MAX + 500)))).toHaveLength(COWORK_PROMPT_MAX));
  it('returns an empty string for a blank prompt', () => expect(coworkLink('  \n ')).toBe(''));
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run packages/domain/test/cowork.test.ts`
Expected: FAIL, `coworkPrompt` is not exported.

- [ ] **Step 3: Implement `packages/domain/src/cowork.ts`** with the signatures above and add the re-export to `index.ts`. Prompt texts are exactly the strings in the tests. Labels: `investigate: 'Investigate with Cowork'`, `second_opinion: 'Second opinion'`, `pattern: 'Check for a pattern'`, `triage: 'Triage this list'`, `explain_request: 'Explain this request'`, `handover: 'Shift handover'`. `coworkLink` slices to `COWORK_PROMPT_MAX` and then calls `encodeURIComponent`. Use a `switch` on `kind` with an exhaustive `never` check.

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm vitest run packages/domain/test/cowork.test.ts && pnpm typecheck`
Expected: all PASS, no type errors.

- [ ] **Step 5: Commit**

```bash
git add packages/domain/src/cowork.ts packages/domain/src/index.ts packages/domain/test/cowork.test.ts
git commit -m "feat(domain): Cowork prompt and claude:// link builder"
```

---

### Task 2: Dialog and button, wired into the alert page

**Files:**
- Create: `apps/web/src/components/OpenInCowork.tsx`
- Modify: `apps/web/src/routes/alerts.$alertId.tsx` (a button row directly under `<AlertHeader …/>`, before `<PendingRequestsBanner/>`)
- Test: `apps/web/e2e/open-in-cowork.spec.ts`

**Interfaces:**
- Consumes: `CoworkCase`, `coworkPrompt`, `coworkLink`, `COWORK_CASE_LABELS` (Task 1).
- Produces:
  ```ts
  export function OpenInCoworkDialog(props: { coworkCase: CoworkCase; onClose: () => void }): JSX.Element;
  export function OpenInCoworkButton(props: {
    coworkCase: CoworkCase;
    label?: string;                      // defaults to COWORK_CASE_LABELS[kind]
    variant?: 'outline' | 'ghost';       // default 'outline'
    size?: 'sm' | 'default';             // default 'sm'
  }): JSX.Element;
  ```

**Dialog behaviour:** mount only while open (the `ActionDialog` convention: unmounting resets the state). It has no corner X (`showCloseButton={false}`), because "Close" belongs to the Close-alert action. Its contents:
- Title: the case label.
- `Textarea` with `aria-label="Prompt"`, initialised from `coworkPrompt(coworkCase)`, at least 8 rows.
- The hint line (copy in Global Constraints).
- Footer: `Cancel` (outline). `Copy prompt` (outline, writes the current textarea value with `navigator.clipboard.writeText` and shows `Copied.` or `Copy failed: <message>` in a `role="status"` line). `Open in Cowork`: an `<a>` styled with `buttonVariants()`, `data-testid="open-in-cowork"`, `href={coworkLink(text)}`. When the link is `''`, drop the `href` and set `aria-disabled="true"`. On click, show the after-open note (copy in Global Constraints) in the same status line. The dialog stays open.

The button has a `Sparkles` icon (lucide), `data-testid={`cowork-${kind}`}`, and owns its `open` state.

**Alert page row:** `<div className="flex flex-wrap gap-2" data-testid="cowork-actions">`, containing:
- `investigate` (always);
- `second_opinion` only when `alert.status === 'closed'`;
- `pattern` with `alert.trader.id` and `alert.trader.name`.

- [ ] **Step 1: Write the failing Playwright tests** in `apps/web/e2e/open-in-cowork.spec.ts`:

```ts
import { coworkLink, coworkPrompt } from '@app/domain';
import { expect, test } from './fixtures.ts';

const prompt = (page) => page.getByRole('textbox', { name: 'Prompt' });
const open = (page) => page.getByTestId('open-in-cowork');

test('investigate: dialog prefilled, link matches, nothing opens until clicked', async ({ page }) => {
  await page.goto('/alerts/ALT-1051');
  await page.getByTestId('cowork-investigate').click();
  const expected = coworkPrompt({ kind: 'investigate', alertId: 'ALT-1051' });
  await expect(prompt(page)).toHaveValue(expected);
  await expect(open(page)).toHaveAttribute('href', coworkLink(expected));
  await expect(page.getByText('Nothing is sent until you press Send in Cowork.')).toBeVisible();
});

test('edits flow into the link; blank prompt disables Open', async ({ page }) => {
  await page.goto('/alerts/ALT-1051');
  await page.getByTestId('cowork-investigate').click();
  await prompt(page).fill('Focus on the Kestrel timing & the 16:30 entry');
  await expect(open(page)).toHaveAttribute('href', coworkLink('Focus on the Kestrel timing & the 16:30 entry'));
  await prompt(page).fill('   ');
  await expect(open(page)).not.toHaveAttribute('href', /.*/);
  await expect(open(page)).toHaveAttribute('aria-disabled', 'true');
});

test('reopening the dialog resets to the case prompt', async ({ page }) => {
  await page.goto('/alerts/ALT-1051');
  await page.getByTestId('cowork-investigate').click();
  await prompt(page).fill('edited');
  await page.getByRole('button', { name: 'Cancel' }).click();
  await page.getByTestId('cowork-investigate').click();
  await expect(prompt(page)).toHaveValue(coworkPrompt({ kind: 'investigate', alertId: 'ALT-1051' }));
});

test('Copy prompt copies the edited text', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/alerts/ALT-1051');
  await page.getByTestId('cowork-investigate').click();
  await prompt(page).fill('my own question');
  await page.getByRole('button', { name: 'Copy prompt' }).click();
  await expect(page.getByRole('status')).toHaveText('Copied.');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('my own question');
});

test('second opinion appears only on a closed alert; pattern names the trader', async ({ page }) => {
  await page.goto('/alerts/ALT-1051');
  await expect(page.getByTestId('cowork-second_opinion')).toHaveCount(0);
  await page.getByTestId('cowork-pattern').click();
  await expect(prompt(page)).toHaveValue(/trader Marcus Hale \(T-0741\)/);
  await page.goto('/alerts/ALT-0987');
  await page.getByTestId('cowork-second_opinion').click();
  await expect(prompt(page)).toHaveValue(coworkPrompt({ kind: 'second_opinion', alertId: 'ALT-0987' }));
});
```

Add a `Page` type import from `@playwright/test` for the helpers. If the seed's trader for ALT-1051 differs, read it from the page header and keep the assertion on the `Name (ID)` shape.

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @app/web e2e -- open-in-cowork` (stop `pnpm dev` first)
Expected: FAIL, `cowork-investigate` not found.

- [ ] **Step 3: Implement `OpenInCowork.tsx` and the alert-page row** as specified above.

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @app/web e2e -- open-in-cowork && pnpm typecheck && pnpm lint`
Expected: 5 passed, no type or lint errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/OpenInCowork.tsx apps/web/src/routes/alerts.\$alertId.tsx apps/web/e2e/open-in-cowork.spec.ts
git commit -m "feat(web): Open in Cowork dialog on the alert page"
```

---

### Task 3: List, request and sidebar entry points

**Files:**
- Modify: `apps/web/src/components/list/ListToolbar.tsx`: `OpenInCoworkButton` with `{ kind: 'triage', base: window.location.origin, search }`, at the right end of the toolbar.
- Modify: `apps/web/src/routes/queue.$requestId.tsx`: under `<RequestCard/>`, only when `data.status === 'pending'`: `{ kind: 'explain_request', requestId: data.id, alertId: data.alertId }`.
- Modify: `apps/web/src/components/shell/AppSidebar.tsx`: a `SidebarMenuButton` in the footer above Settings, with `data-testid="cowork-handover"`, a `Sparkles` icon, label `Shift handover` and tooltip `Shift handover`. It mounts `OpenInCoworkDialog` with `{ kind: 'handover' }` (same pattern as `SettingsDialog`).
- Test: `apps/web/e2e/open-in-cowork.spec.ts` (append)

**Interfaces:**
- Consumes: `OpenInCoworkButton` and `OpenInCoworkDialog` (Task 2), `coworkPrompt` and `coworkLink` (Task 1).

- [ ] **Step 1: Append the failing tests**

```ts
test('triage carries the current filters', async ({ page }) => {
  await page.goto('/alerts?status=open&severity=high&desk=eu-equities&q=layering');
  await page.getByTestId('cowork-triage').click();
  await expect(prompt(page)).toHaveValue(
    coworkPrompt({
      kind: 'triage',
      base: 'http://localhost:5173',
      search: { status: ['open'], severity: ['high'], desk: ['eu-equities'], q: 'layering' },
    }),
  );
});

test('explain shows on a pending request only', async ({ page, agentRequest }) => {
  const { id } = (await agentRequest('/api/alerts/ALT-1042/acknowledge', {
    rationale: 'Starting the investigation.',
  })) as { id: string };
  await page.goto(`/queue/${id}`);
  await page.getByTestId('cowork-explain_request').click();
  await expect(prompt(page)).toHaveValue(
    coworkPrompt({ kind: 'explain_request', requestId: id, alertId: 'ALT-1042' }),
  );
});

test('sidebar offers the shift handover', async ({ page }) => {
  await page.goto('/alerts');
  await page.getByTestId('cowork-handover').click();
  await expect(open(page)).toHaveAttribute('href', coworkLink(coworkPrompt({ kind: 'handover' })));
});
```

If the acknowledge response doesn't carry `id` at the top level, read it the way `access-queue.spec.ts` does. Also assert that after approving that request (via the app's Approve button) the `cowork-explain_request` button is gone.

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @app/web e2e -- open-in-cowork`
Expected: the 3 new tests FAIL, the 5 from Task 2 PASS.

- [ ] **Step 3: Implement the three entry points** as listed under Files.

- [ ] **Step 4: Run the full suite**

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm e2e`
Expected: everything passes, including the existing e2e specs (the toolbar and sidebar changes must not break `alerts-list` or `shell`).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/list/ListToolbar.tsx apps/web/src/routes/queue.\$requestId.tsx apps/web/src/components/shell/AppSidebar.tsx apps/web/e2e/open-in-cowork.spec.ts
git commit -m "feat(web): Open in Cowork from the list, a pending request and the sidebar"
```

---

### Task 4: Docs and cleanup

**Files:**
- Modify: `docs/spike-notes.md`: add a section `## Cowork: Open in Cowork links` recording: `claude://cowork/new?q=` opened a Cowork session with the prompt prefilled and sendable (verified by a person, 2026-11-18); Claude used the alerts connector and the skill after Send. Keep the re-check line for bug #73593 (already-running app) as a rehearsal item.
- Modify: `README.md`: one paragraph under the plugin section: the app's Cowork buttons open `claude://cowork/new` and need Claude Desktop with the plugin installed; Copy prompt is the fallback.
- Modify: `docs/rehearsal-workflows.md`: in the pre-flight checklist, add `- [ ] Click "Investigate with Cowork" on ALT-1051 once with Claude Desktop already open, and check the Send button appears`.
- Delete: `spikes/open-in-cowork.html` (and the empty `spikes/` folder).

- [ ] **Step 1: Make the edits above.**
- [ ] **Step 2: Run `pnpm lint`** (oxfmt checks the Markdown). Expected: PASS.
- [ ] **Step 3: Commit**

```bash
git add docs/spike-notes.md README.md docs/rehearsal-workflows.md docs/superpowers/specs/2026-11-18-open-in-cowork-design.md docs/superpowers/plans/2026-11-18-open-in-cowork.md
git rm -r spikes
git commit -m "docs: Open in Cowork spike results, rehearsal check; remove spike"
```
