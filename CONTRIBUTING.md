# Contributing

## Requirements

- Node.js 18+
- npm

## Common Commands

```bash
npm install
make lint
make test
make build
npm run test:manual
```

## Verification Contract

- `make lint` runs formatting checks, ESLint, and `tsc --noEmit`
- `make test` runs unit tests only
- `make build` verifies the distributable compile
- `npm run test:manual` runs the read-only manual API checks and stays skipped unless `E2ECTL_RUN_MANUAL_E2E=1`

## CI Triggers

GitHub Actions runs for:

- pushes to `main`
- all pull requests

The CI matrix covers Node `18`, `20`, and `22`.

## Scope Discipline

- Keep changes small and milestone-driven.
- Default to deterministic JSON output for machine-facing surfaces.
- Avoid introducing SDK-style abstractions before they are needed by the CLI.
