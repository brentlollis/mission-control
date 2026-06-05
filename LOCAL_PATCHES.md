# Brent AI Local Patches

This Mission Control checkout tracks upstream releases, but this machine is intentionally configured as a local-only Codex worker. Do not use the in-app updater casually; update through the local upgrade workflow so these patches are preserved and verified.

## Architecture Decision

- Mission Control is a local-only control plane on this Windows worker.
- OpenClaw/gateway setup is not an unresolved requirement unless the user explicitly changes direction.
- The scheduled `codex-worker` is the active execution lane.
- Canonical memory is Markdown under `C:\Users\brent-ai\Projects`; SQLite is only a search/index layer.

## Patch: Curated Memory Prefixes

- File: `src/lib/config.ts`
- Purpose: allow local configuration to expose only selected documentation prefixes when `OPENCLAW_MEMORY_DIR` points at a broad workspace root.
- Env var: `MC_MEMORY_ALLOWED_PREFIXES`
- Reason: `OPENCLAW_MEMORY_DIR=C:\Users\brent-ai\Projects` is useful, but Mission Control must not browse the whole project tree, build outputs, browser profiles, databases, or secrets.

## Patch: Documentation Folder Discovery

- File: `src/lib/docs-knowledge.ts`
- Purpose: make the Docs APIs recognize canonical `Documentation` folders and the configured memory prefixes.
- Reason: Brent AI projects use `Documentation` as the canonical handoff/memory folder, not only `docs`, `memory`, or `knowledge-base`.

## Patch: Managed Release Awareness

- Files: `src/app/api/releases/check/route.ts`, `src/components/layout/update-banner.tsx`
- Purpose: compare upstream releases against `MC_CURRENT_RELEASE_TAG` instead of only `package.json`.
- Reason: upstream package metadata can lag the release tag, and this checkout carries local commits on top of upstream tags. The dashboard should notify when a newer upstream release exists, not when package metadata is stale or a stale browser cache says so. In local-only mode, the banner does not show the in-app update button; updates should go through `C:\Users\brent-ai\Projects\_system\scripts\Update-MissionControl.ps1`.

## Patch: Intentional Local-Only Mode

- Files: `src/components/layout/local-mode-banner.tsx`, `src/app/[[...panel]]/page.tsx`, `src/app/api/openclaw/version/route.ts`
- Purpose: suppress missing-gateway/OpenClaw update prompts when `NEXT_PUBLIC_LOCAL_ONLY=true` and `OPENCLAW_ENABLED=0`.
- Reason: local-only is the selected architecture on this machine, not an incomplete gateway setup.

## Patch: Onboarding Completion Persistence

- Files: `src/lib/onboarding-session.ts`, `src/lib/__tests__/onboarding-session.test.ts`
- Purpose: keep the onboarding wizard closed on fresh browser sessions after the admin has completed or skipped it.
- Reason: completed/skipped onboarding used to auto-replay on every fresh browser session; replay should only happen through the explicit Settings action.

## Patch: Metricool Social Panel

- Files: `src/app/api/local/metricool-social/route.ts`, `src/lib/metricool-social-workflow.ts`, `src/lib/__tests__/metricool-social-workflow.test.ts`, `src/components/panels/metricool-social-panel.tsx`, `src/app/[[...panel]]/page.tsx`, `src/components/layout/nav-rail.tsx`
- Purpose: expose a reusable social publishing cockpit with Metricool brand connection status, Bellara video inventory, platform-specific caption editing, approval status, split Posts Library draft upsert, dry-run daily schedule planning, post verification actions, and a local run log in Mission Control.
- Backend source of truth: `C:\Users\brent-ai\Projects\active\metricool-social-agent`
- Reason: Creative State, Bellara Brass, and Heritage Trumpets need one repeatable social operations surface across sessions without duplicating Metricool API logic in Mission Control.
- Safety: the route only calls allowlisted agent commands, requires Mission Control auth, writes local JSON state/audit files under `C:\Users\brent-ai\Projects\_system\mission-control\data\metricool-social`, dry-runs schedules, and requires a human UI click before creating or updating live Metricool Posts Library drafts. Autolist records are inventory only; approved/drafted caption saves sync to Posts Library as the default persistence target.

## Patch: Trumpet Customer Dashboard Panel

- Files: `src/app/api/local/trumpet-customer-dashboard/route.ts`, `src/components/panels/trumpet-customer-dashboard-panel.tsx`, `src/app/[[...panel]]/page.tsx`, `src/components/layout/nav-rail.tsx`
- Purpose: expose the local `trumpet-customer-dashboard` SQLite customer database in Mission Control with customer, inventory, active listing, sold item, source, transaction, item, instrument, and shipment summaries plus a link to the standalone local web app.
- Current extension: includes Sync Status and Import Sources sections backed by the dashboard `sync_runs` and `source_records` tables, plus thumbnail/photo-link rendering for Inventory and Sold Items using normalized dashboard `thumbnail_url` and `photo_url` fields.
- Backend source of truth: `C:\Users\brent-ai\Projects\active\trumpet-customer-dashboard`
- Reason: Heritage Trumpets and Bellara Brass need one customer surface that can combine Shippo labels, marketplace sales, Ecwid orders, and trumpets bought/sold spreadsheet rows into unified customer records.
- Runtime note: Mission Control runs as SYSTEM on this machine, so this patch uses the fixed Brent AI projects root (`C:\Users\brent-ai\Projects`) by default instead of `homedir()`.
- Safety: the Mission Control route is read-only, requires viewer auth, reads only sanitized summary fields from the local SQLite database, and does not expose Shippo secrets, label URLs, label PDFs, or raw source JSON.

## Local Config That Must Survive Updates

These are intentionally in `.env`, which is ignored by git:

```text
OPENCLAW_MEMORY_DIR=C:\Users\brent-ai\Projects
MC_MEMORY_ALLOWED_PREFIXES=Documentation/;active/autonomous-worker-machine/Documentation/;active/creative-state/Documentation/;active/bellara-brass/Documentation/;active/heritage-trumpets/Documentation/;_system/docs/
OPENCLAW_ENABLED=0
NEXT_PUBLIC_GATEWAY_OPTIONAL=true
NEXT_PUBLIC_LOCAL_ONLY=true
MC_CURRENT_RELEASE_TAG=v2.0.1
```

Do not store secrets from `.env` in docs, chat, logs, or commits.

## Upgrade Verification

After rebasing onto any upstream release:

1. `pnpm run typecheck`
2. `pnpm run build`
3. Restart `\AI-Worker\Start Mission Control`
4. Verify `/api/memory?action=tree&depth=3` lists the curated documentation roots.
5. Verify `/api/docs/tree` lists the same roots.
6. Verify search for `local-only` finds the root and machine handoff docs.
7. Verify `/api/releases/check` returns `updateAvailable: false` for the currently applied release tag.
8. Verify the dashboard has no missing OpenClaw/gateway banner in local-only mode.
9. Verify `\AI-Worker\Mission Control Codex Worker` is running and `codex-worker` heartbeats.
10. Verify `/social` loads the Metricool Social cockpit and `/api/local/metricool-social` returns the configured brands plus Bellara inventory.
