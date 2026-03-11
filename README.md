# e2ectl

`e2ectl` is an OSS prototype CLI for managing E2E Networks MyAccount resources from the terminal.

## Current Status

This repository currently implements:

- M0 scaffold: project structure, build tooling, CI, docs, and CLI entrypoint
- M1 foundations: typed config model, config store, env/profile auth resolution, deterministic JSON helpers, and actionable error handling
- M2 API client: reusable MyAccount client, auth/query injection, response envelope parsing, and live credential validation
- M3 config commands: `config add`, `list`, `set-default`, and `remove`
- M4 node read commands: `node list` and `node get`
- M5 node write commands: `node create` with prototype defaults and `node delete` with confirmation safety
- M6 test suite: expanded unit coverage, shared test helpers, and a manual read-only API test lane kept out of CI

Planned next milestones are tracked in [docs/ROADMAP.md](./docs/ROADMAP.md).

## Design Constraints

- TypeScript strict mode
- Node.js 18+
- Commander.js for the CLI surface
- Native `fetch` for API access
- Human-friendly output by default, deterministic `--json` output for automation
- Config stored at `~/.e2e/config.json`
- Environment variables override saved profile values

## Configuration Model

Profiles are stored in `~/.e2e/config.json`:

```json
{
  "profiles": {
    "prod": {
      "api_key": "xxxx",
      "auth_token": "yyyy",
      "project_id": "12345",
      "location": "Delhi"
    }
  },
  "default": "prod"
}
```

Supported environment overrides:

- `E2E_API_KEY`
- `E2E_AUTH_TOKEN`
- `E2E_PROJECT_ID`
- `E2E_LOCATION`

## Node Commands

```bash
e2ectl node list [--alias <profile>] [--json]
e2ectl node get <node-id> [--alias <profile>] [--json]
e2ectl node create --name <name> --plan <plan> --image <image> [--alias <profile>] [--json]
e2ectl node delete <node-id> [--alias <profile>] [--force] [--json]
```

`node create` currently sends the documented prototype defaults for the optional fields.
`node delete` prompts for confirmation unless `--force` is supplied.

## Development

```bash
npm install
make lint
make test
make build
npm run test:manual
```

Run the CLI locally:

```bash
npm run dev -- --help
```

## Testing Strategy

- `make lint`: Prettier check, ESLint, and TypeScript typecheck
- `make test`: unit tests only, using Vitest with mocked filesystem and mocked network boundaries
- `make build`: production TypeScript compile into `dist/`
- `npm run test:manual`: manual read-only API checks, skipped unless `E2ECTL_RUN_MANUAL_E2E=1`

Manual read-only test inputs:

- `E2ECTL_RUN_MANUAL_E2E=1`
- `E2E_API_KEY`
- `E2E_AUTH_TOKEN`
- `E2E_PROJECT_ID`
- `E2E_LOCATION`
- Optional: `E2ECTL_MANUAL_NODE_ID` to exercise `node get`

## CI Behavior

GitHub Actions currently runs on:

- pushes to `main`
- every `pull_request`

The workflow uses a Node.js matrix for `18`, `20`, and `22`. Each matrix job runs:

1. `npm ci`
2. `make lint`
3. `make test`
4. `make build`

That means:

- PRs do run CI
- direct pushes to `main` run CI
- pushes to non-`main` branches only run CI once they are part of a PR

## Milestones

- `M0` scaffold
- `M1` config/auth/types
- `M2` API client
- `M3` config commands
- `M4` node read commands
- `M5` node write commands
- `M6` test suite
- `M7` CI/docs/polish
