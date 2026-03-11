# e2ectl

`e2ectl` is an OSS prototype CLI for managing E2E Networks MyAccount resources from the terminal.

## Current Status

This repository currently implements:

- M0 scaffold: project structure, build tooling, CI, docs, and CLI entrypoint
- M1 foundations: typed config model, config store, env/profile auth resolution, deterministic JSON helpers, and actionable error handling

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

## Development

```bash
npm install
make lint
make test
make build
```

Run the CLI locally:

```bash
npm run dev -- --help
```

## Milestones

- `M0` scaffold
- `M1` config/auth/types
- `M2` API client
- `M3` config commands
- `M4` node read commands
- `M5` node write commands
- `M6` test suite
- `M7` CI/docs/polish
