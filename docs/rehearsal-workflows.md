# Rehearsal Workflows: Alerts in Claude Cowork

> Snapshot of the living doc at https://claude.ai/artifact/LSuWRQ4tYbPa1zNLtxLdob (2026-11-17). The living doc is the source of truth; refresh this copy when it changes.

Six scripted workflows show an analyst starting an investigation in Claude and finishing it in the app. W2 is the main demo. The others can be added depending on how much time the audience has.

## At a glance

| # | Workflow | Client | Phase | What it shows off | Time |
| --- | --- | --- | --- | --- | --- |
| W1 | Morning triage | Cowork | 1 | Search in plain language, then a deep link to the same filtered view | 2 min |
| W2 | Investigate and recommend | Cowork | 1 | A reasoned recommendation, then a write the human approves in the app's access queue | 4 min |
| W3 | Pattern across alerts | Cowork | 1 | Claude spots a repeat offender; the human escalates in the app | 3 min |
| W4 | Reopen a closed alert | Cowork | 1 | Using history: new evidence revisits an earlier decision | 2 min |
| W5 | Shift handover | Claude Code | 1 | The same MCP server works in a second client | 2 min |
| W6 | Act inline | Cowork | 2 | The interactive alert card, built from the app's own components | 3 min |

## W1 Morning triage

The analyst finds their work without opening the app, then lands on exactly the list Claude described.

**Prompt:** "What high-severity alerts are open on the EU equities desk? Anything mentioning layering?"

1. Claude calls `search_alerts` with structured filters (status Open, severity High, desk EU Equities) and the free text "layering".
2. Claude replies with a short ranked list, giving each alert's ID, rule, trader and age, and a sentence on why it's ranked where it is.
3. Claude gives one link to the filtered list, `/alerts?status=open&severity=high&desk=eu-equities&q=layering`, plus a link for each alert.
4. **Show:** click the list link. The app opens with the same filters set and the same rows.

**Watch for:** the counts in the app must match Claude's answer. If they don't, the link builder and the API disagree on filter meaning.

## W2 Investigate and recommend (main demo)

Claude works through a spoofing alert against the rule's criteria and recommends a next step. The human approves it in the app's access queue before it reaches the audit trail.

**Prompt:** "Investigate ALT-1042 and tell me what I should do with it."

1. The `investigate-alert` skill loads. Claude calls `get_alert`, `get_alert_timeline` and `find_related_alerts`.
2. Claude goes through the data tab: the order-to-trade ratio, cancels within 500 ms of the opposite-side fill, and the share of large resting orders on one side of the book. It tests each against the rule's indicators.
3. Claude recommends one action, for example "escalate to Compliance Lead", with three supporting facts, one fact against, and a confidence level.
4. Claude offers to acknowledge the alert and post the recommendation as a comment. When the presenter agrees, Claude submits both as action requests and replies with an approval link, saying nothing has changed yet. **The presenter opens the link, sees Claude's rationale and the exact comment text in the queue, and approves**.
5. **Show:** ask Claude "did that go through?" It checks the requests and confirms. In the app the status is In Progress and the timeline shows the comment under the presenter's name, marked "via Claude, approved by" them.

**Watch for:** the recommendation must cite numbers that appear in the data tab. Rehearse with the tab open next to Cowork.

## W3 Pattern across alerts

Claude connects alerts that each look minor into one pattern. Escalation stays a human action in the app.

**Prompt:** "Has trader T-0412 come up before? Is this a pattern?"

1. Claude calls `search_alerts` (trader T-0412, any status, last 90 days) and `find_related_alerts`.
2. Claude finds four alerts in seven weeks across two rules (layering and wash trades), two of them closed as false positives by different analysts.
3. Claude recommends escalating to the Compliance Lead and explains why each closure looked reasonable on its own but not together.
4. Claude doesn't escalate, because phase 1 has no escalate tool. It links to the in-progress T-0412 alert, where the assignees panel sits on the overview.
5. **Show:** escalate in the app. The escalation appears in the history and the Compliance Lead is added as an assignee. The status stays In Progress.

**Watch for:** the audience asking "why didn't Claude just escalate?" That's the cue for the "Claude advises, human acts" point.

## W4 Reopen a closed alert

Claude uses the timeline to challenge an earlier decision when new evidence arrives.

**Prompt:** "ALT-1051 just came in for a restricted list breach. Does it change anything we've already closed?"

1. Claude calls `get_alert` on ALT-1051, then `find_related_alerts` on the instrument.
2. Claude finds ALT-0987, closed three weeks ago with the comment "name added to restricted list after trade; timing benign".
3. The new alert shows a trade *before* the restricted list entry, by someone on the same deal team. Claude recommends reopening ALT-0987 and quotes the closing comment it disagrees with.
4. **Show:** follow the link and reopen ALT-0987 in the app. The timeline shows Closed, then Reopened, with the reason.

**Watch for:** the app must allow reopening from Closed only, and the reopen reason must be required.

## W5 Shift handover in Claude Code

The same plugin and MCP server work from a terminal, which shows it isn't tied to Cowork.

**Prompt:** "Write my shift handover: everything I touched today, what's still open, and what the next analyst should look at first."

1. Claude calls `search_alerts` (assignee = demo user, updated today) and `get_alert_timeline` for each result.
2. Claude writes a markdown handover with sections for Closed today, Still in progress, and Look at first, with a deep link on every alert.
3. **Show:** Cmd-click a link in the terminal. The browser opens the alert.

**Watch for:** the handover depends on today's activity, so run W2 to W4 first, or seed timeline entries timestamped relative to server start.

## W6 Act inline (phase 2)

The alert card from the web app renders inside Cowork. The analyst acts without switching windows, or opens the app with one click.

**Prompt:** "Show me ALT-1042."

1. `get_alert` returns its usual JSON plus a `ui://alerts/alert-card` resource. Cowork renders the card using the same Fluent components as the app.
2. The card shows status, assignees, highlight attributes and the latest three timeline entries.
3. **Show:** click Acknowledge on the card. The card calls the tool, the status badge updates, and Claude sees the change.
4. **Show:** click "Open in app". The deep link goes to the same alert, already In Progress.

**Watch for:** the card must look identical to the app's header. Any visible difference undermines the "shared UI" point.

## Seed data each workflow depends on

The seed must include these "story" records alongside about 40 background alerts, so the workflows give the same results every time. Alert IDs are placeholders until the seed is written.

| Record | Needed by | Must contain |
| --- | --- | --- |
| ALT-1042, spoofing/layering, Open, High, EU Equities, T-0412 | W1, W2, W3, W6 | A data tab of orders with cancel timing and order-to-trade ratio that clearly meets 2 of 3 indicators |
| Three earlier T-0412 alerts (two closed as false positive, one in progress) | W3 | Different analysts, closing comments, and dates spread over 7 weeks |
| ALT-0987, restricted list, Closed | W4 | A closing comment calling the timing benign, with the instrument and deal team on the record |
| ALT-1051, restricted list, Open | W4 | The same instrument, with a trade timestamp before the restricted list entry |
| 3 or more Open High alerts on EU Equities, one without "layering" | W1 | Proves the free text actually narrows the results |
| Users: demo analyst, second analyst, Compliance Lead, CCO | All | Roles, so primary/backup assignees and escalation targets make sense |

## Rehearsal checklist

- [ ] Restart the backend so the seed is clean (writes from earlier runs are gone), and check the approval setting is on for the presenter's user
- [ ] Web app and MCP server use the same app base URL
- [ ] The Cowork connector shows as connected and lists all 8 tools
- [ ] The plugin is installed and the `investigate-alert` skill appears
- [ ] Run W1 to W5 once end to end and check every deep link opens the right view
- [ ] Restart the backend again before going live
- [ ] Fallback: a screen recording of W2 in case the network or Cowork misbehaves

Each workflow will also have a Playwright test that clicks the deep links Claude would produce, so a broken link is caught before rehearsal.
