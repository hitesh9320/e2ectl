# Contributing

This document is for contributors changing the `e2ectl` codebase.

If you are using the CLI, start with [README.md](./README.md). If you are maintaining CI or the promotion gate, use [docs/MAINTAINING.md](./docs/MAINTAINING.md).

## Requirements

- Node.js 24+
- npm

## Local Setup

```bash
npm install
make lint
make test
make build
npm run test:integration
```

Useful day-to-day commands:

```bash
make dev
make coverage
node dist/app/index.js --help
npm run coverage:unit
npm run coverage:integration
npm run test:manual
npm pack --dry-run
```

## Branch Roles

- `develop` is the staging branch for ongoing feature integration.
- `main` is the release branch.
- Target `develop` for normal feature work unless the maintainers asked for a release-only change.

## Architecture Contract

The maintained v1 source tree is:

```text
src/
  app/
  core/
  myaccount/
  config/
  node/
  volume/
  vpc/
  ssh-key/
```

Domain ownership:

- `src/app/` wires Commander, runtime services, stdout/stderr, prompts, config store, and domain factories.
- `src/core/` contains low-level shared helpers such as errors, deterministic JSON helpers, and masking.
- `src/myaccount/` owns shared transport, credential validation, API envelope typing, and centralized API failure handling.
- `src/config/` owns profile persistence, import parsing, alias/default-context behavior, and auth/context resolution.
- `src/node/` owns node discovery, create/delete flows, actions, and output shaping.
- `src/volume/` owns volume list/get/delete, plans, create flows, and output shaping.
- `src/vpc/` owns VPC list/get/delete, plans, create flows, and output shaping.
- `src/ssh-key/` owns SSH key list/get/delete, create flows, and output shaping.

Architectural rules:

- Commands stay thin. `command.ts` files define the CLI surface and delegate immediately.
- Services orchestrate validation, defaults, prompts, and cross-domain workflows. They do not own rendering.
- Clients own endpoint paths and response parsing.
- Formatters own human-readable output and deterministic `--json` output.
- Generic API failure handling stays centralized in `src/myaccount/transport.ts`.
- Cross-domain imports should go through each domain `index.ts`.
- Prefer small, explicit implementations over speculative abstractions.

## Verification Contract

Before asking for review, run the local gate:

```bash
make lint
make test
make build
npm run test:integration
npm run coverage:unit
npm pack --dry-run
```

What this covers:

- `make lint`: formatting check, ESLint, and TypeScript `--noEmit`
- `make test`: unit tests
- `make build`: production compile
- `npm run test:integration`: built CLI process checks, fake-API coverage, and tarball install smoke
- `npm run coverage:unit`: unit tests with the enforced 80% coverage floor used by CI
- `npm pack --dry-run`: publishable package preview

The maintainer-owned CI policy and promotion gate live in [docs/MAINTAINING.md](./docs/MAINTAINING.md).

## Testing Expectations

- Put unit tests under `tests/unit/<domain>/`.
- Put integration tests under `tests/integration/<domain>/`.
- Add or update tests in the domain you touched instead of broad unrelated changes.
- Treat `--json` output as a contract whenever command behavior or formatters change.
- Coverage remains explicit locally:

```bash
make coverage
```

- Unit and integration coverage reports are written under `coverage/unit/` and `coverage/integration/`.
- `npm run coverage:integration` rebuilds `dist/` first and measures the spawned CLI process, not just the Vitest runner.
- Manual live checks are opt-in, read-only node checks only:

```bash
E2ECTL_RUN_MANUAL_E2E=1 \
E2E_API_KEY=<api-key> \
E2E_AUTH_TOKEN=<auth-token> \
E2E_PROJECT_ID=<project-id> \
E2E_LOCATION=<location> \
npm run test:manual
```

## Documentation Expectations

Every user-visible behavior change should ship with:

- tests
- docs updates
- examples validated against the real CLI surface

Update docs by audience:

- [README.md](./README.md) for operator-facing usage and onboarding
- [CONTRIBUTING.md](./CONTRIBUTING.md) for contributor workflow and architecture rules
- [docs/MAINTAINING.md](./docs/MAINTAINING.md) for CI, branch, and readiness policy

Do not leave stale command examples behind after behavior changes.

## Conventional Commits

- Use Conventional Commits such as `feat:`, `fix:`, and `chore:`.
- Use `feat!:` or a `BREAKING CHANGE:` footer only for intentional breaking changes.

## Releasing

Releases are cut by a maintainer from `main`. No automation opens release PRs — the tag push is the trigger.

### Flow

```bash
# 1. Add an entry under ## [x.y.z] in CHANGELOG.md
# 2. Bump the version (updates package.json and commits)
npm version patch   # or minor / major
# 3. Push the commit and tag
git push --follow-tags
```

After the tag lands, CI runs automatically:

1. Builds `dist/`
2. Publishes `@e2enetworks-oss/e2ectl` to GitHub Packages
3. Creates a GitHub Release with the changelog section extracted from `CHANGELOG.md`

### Dist-Tag Policy

- Tags with a prerelease suffix (`v1.2.0-rc.1`) publish to dist-tag `next`
- Stable tags (`v1.2.0`) publish to dist-tag `latest`

### If Publish Needs a Rerun

Use the `publish` workflow's manual dispatch input `release_tag` to rerun for an existing tag without pushing a new one.

### Testing a Publish Without Merging

You can smoke-test the full publish pipeline from a PR branch without touching `latest`.

**Step 1 — push a pre-release tag from your branch**

```bash
# Replace x.y.z with the next planned version
git tag vx.y.z-rc.1
git push origin vx.y.z-rc.1
```

The `-rc.1` suffix makes `publish.yml` use dist-tag `next`, so the stable
`npm install @e2enetworks-oss/e2ectl` is unaffected.

**Step 2 — watch the workflow**

Go to **Actions → publish** on GitHub and confirm the run completes green.

**Step 3 — verify the package**

```bash
# Confirm the next dist-tag was updated
npm view @e2enetworks-oss/e2ectl dist-tags
# → { latest: '...', next: 'x.y.z-rc.1' }

# Install and smoke-test
npm install -g @e2enetworks-oss/e2ectl@next
e2ectl --version
```

A pre-release GitHub Release is created automatically alongside the publish.

**Step 4 — ship the stable release**

Once the PR is merged and `main` is ready:

```bash
git tag vx.y.z
git push origin vx.y.z
```

This publishes under `latest` and creates the stable GitHub Release.

### After Publish

- Verify the GitHub Release and tag exist
- Verify the package resolves from GitHub Packages with the expected dist-tag
- Verify the install path works: `npm install -g @e2enetworks-oss/e2ectl`

## Pull Requests

- Keep changes scoped and reviewable.
- Avoid broad refactors when implementing a narrow fix or feature.
- Target `develop` unless maintainers asked for a release-only exception.
- Include the verification commands you actually ran.
- Call out doc updates when operator flow, contributor workflow, CI expectations, or release mechanics changed.
