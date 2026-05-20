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

## Local Config That Must Survive Updates

These are intentionally in `.env`, which is ignored by git:

```text
OPENCLAW_MEMORY_DIR=C:\Users\brent-ai\Projects
MC_MEMORY_ALLOWED_PREFIXES=Documentation/;active/autonomous-worker-machine/Documentation/;active/creative-state/Documentation/;active/bellara-brass/Documentation/;active/heritage-trumpets/Documentation/;_system/docs/
OPENCLAW_ENABLED=0
NEXT_PUBLIC_GATEWAY_OPTIONAL=true
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
7. Verify `\AI-Worker\Mission Control Codex Worker` is running and `codex-worker` heartbeats.
