# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- Made music watchdog recovery deterministic after disconnects by waiting for
  voice reconnection before replay attempts, recording recovery detail for
  failures/successes, and surfacing that detail in `/music health`.

## [2.6.16] - 2026-03-14

### Added

- Added deploy-recovery skill `.cursor/skills/lucky-deploy-recovery/SKILL.md`
  and linked it in `AGENTS.md` for "workflow green, production stale" incidents.
- Expanded project skills:
  - `.cursor/skills/lucky-docker-dev/SKILL.md` with deploy preflight, revision
    verification, and webhook signaling validation.
  - `.cursor/skills/lucky-ci-gate-recovery/SKILL.md` with webhook failure
    signatures (`dirty-tree-overwrite`, lock-collision, timeout-noise).
- Added `docs/AUTH_SMOKE_RUNBOOK.md` with manual Discord login smoke workflow
  and timestamped evidence capture template.

### Fixed

- Pinned webhook-driven `prisma migrate deploy` and `prisma migrate status`
  calls to `prisma/prisma.config.ts` so homelab deploys keep `DATABASE_URL`
  resolution when run from the webhook container.
- Updated GitHub MCP recovery docs and skills to use the official
  `github-mcp-server` binary with `gh auth token` as the primary runtime auth
  source and environment token fallback.
- Deploy webhook contract now includes command output in both success and error
  responses (`include-command-output-in-response*`) to prevent false-positive
  trigger results.
- Removed webhook runtime `-verbose` logging from compose service command to
  reduce request-secret exposure risk in logs.
- Hardened `scripts/deploy.sh` with:
  - required compose-env preflight before deploy actions
  - host-safe health endpoint resolution for non-container execution context
  - dirty tracked-worktree fail-fast before `git pull`
  - robust lock handling that validates stale/reused lock PIDs by command line

## [2.6.15] - 2026-03-14

### Added

- Added project CI triage skill
  `.cursor/skills/lucky-ci-gate-recovery/SKILL.md` and linked it in
  `AGENTS.md` for required-check/ruleset recovery workflows.
- Added project MCP GitHub recovery skill
  `.cursor/skills/mcp-github-recovery/SKILL.md` and linked it in `AGENTS.md`
  for `Transport closed` auth/transport remediation workflows.
- Expanded CI triage skill with deterministic required-vs-informational status
  classification and explicit ruleset-mismatch handling.
- Added repo-local OpenCode guardrail plugins, verification/install helper
  scripts, and the `opencode-lucky-workflows` project skill for Lucky Codex
  sessions on local and `server-do-luk`.
- Enhanced `/music health` diagnostics output for operator triage with resolver
  source/cache visibility, repeat-mode labels, watchdog recovery timestamps,
  and actionable recovery steps.

### Fixed

- Hardened GitHub MCP recovery runbook with protocol-compatibility detection
  (framed vs line-delimited stdio), wrapper-based runtime auth alignment for
  Codex, and local MCP config integrity checks for related server entries
  (`filesystem`, `fetch`, `playwright`).
- Bot music stability hotfix: `/autoplay` now acknowledges interactions before
  queue replenishment work, preventing Discord command timeout responses.
- Added fail-safe Discord Player error/debug handling (`player.events.on` and
  top-level `player.on`) so queue/player handler exceptions no longer crash the
  process during music runtime errors.
- Improved queue-miss guidance after runtime restarts: music commands now
  return explicit recovery text directing users to start a fresh queue with
  `/play`.
- SonarCloud CI is now Dependabot-safe: scans run only when `SONAR_TOKEN` is
  present, Dependabot PRs skip scan as success when token is unavailable, and
  non-Dependabot runs fail fast if the token is missing.
- Upgraded SonarCloud GitHub Action to `SonarSource/sonarqube-scan-action@v7`
  to keep workflow compatibility current.
- Cleared the open Dependabot workflow queue by landing split updates:
  `actions/checkout@v6`, `preactjs/compressed-size-action@v3`,
  `actions/labeler@v6`, and Sonar scan action `v7` via replacement PR.
- Deploy OAuth redirect smoke now treats sustained `429` rate-limit responses
  as warning-only (after auth-config contract passes), preventing false-negative
  homelab deploy failures caused by Discord OAuth endpoint throttling.
- Cleared the remaining moderate dependency audit chain by bumping
  `@swc/cli` to `^0.8.0`, raising `file-type` override to `>=21.3.2`,
  and forcing patched `yauzl` resolution (`3.2.1`), resulting in
  `npm audit` baseline `low=0`, `moderate=0`, `high=0`, `critical=0`.