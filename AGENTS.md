# ZMAI Agent Notes

## Commands

- Requires Node.js 18+; use npm with the committed `package-lock.json`.
- Run `npm run check`, then `npm test`; build with `npm run build` (emits ignored `dist/`).
- Run a focused Vitest file with `npm test -- test/<name>.test.ts`.

## Architecture

- `src/index.ts` assembles filesystem paths, services, and the `AgentRegistry`; `src/cli/create-program.ts` is the authoritative CLI command wiring.
- Agent-specific local storage and native CLI behavior belong in `src/agents/*-adapter.ts`; retain the shared `AgentAdapter` contract in `src/agents/types.ts` and register new adapters in `src/agents/registry.ts`.
- `src/commands/resources.tsx` owns the `mcps`, `skills`, and `plugins` commands and starts the Ink resource UI in `src/integrations/ui/resource-app.tsx`. The live UI only supports removal, with confirmation handled by the caller/command path.
- Running the CLI reads and may modify real user files under `~/.claude-switch-config`, `~/.claude`, and `~/.zmai`; prefer isolated unit tests for filesystem-changing behavior.

## Conventions And Gotchas

- This is NodeNext ESM. Keep explicit `.js` extensions on relative imports even in `.ts` and `.tsx` source files.
- `USAGE.md` still documents the removed aggregate `integrations` command. The registered resource commands are `mcps`, `skills`, and `plugins`; follow `create-program.ts` and `README.md` for the current CLI contract.
- Package metadata is not synchronized: `package.json` is `1.4.0`, while the lockfile and CLI version are `1.3.0`. Reconcile all three when doing release/version work.
