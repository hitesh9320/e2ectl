# e2ectl-hitesh-test

`e2ectl-hitesh-test` is the personal release-sandbox build of `e2ectl`, the command-line interface for managing E2E Networks MyAccount resources from the terminal.

It is designed for operators and automation workflows that need:

- profile-based authentication and saved execution defaults
- discovery-first node creation
- node lifecycle and attachment actions
- block storage, VPC, and SSH key workflows
- deterministic `--json` output for scripts and agents

## Requirements

- Node.js 18+
- npm

## Install

Preferred install once the personal sandbox package is published:

```bash
npm install -g e2ectl-hitesh-test
e2ectl-hitesh-test --help
```

For prereleases:

```bash
npm install -g e2ectl-hitesh-test@next
e2ectl-hitesh-test --help
```

Until the personal sandbox package is live, install from source:

```bash
npm install
npm run build
npm link
e2ectl-hitesh-test --help
```

## Quickstart

The normal operator flow is:

1. import credentials
2. save a default alias, project id, and location
3. discover a valid OS row and config row
4. create a node from that exact catalog output
5. inspect or manage the resulting resources

### 1. Import credentials

```bash
e2ectl-hitesh-test config import --file ~/Downloads/config.json
```

For non-interactive setup:

```bash
e2ectl-hitesh-test config import \
  --file ~/Downloads/config.json \
  --default prod \
  --default-project-id <project-id> \
  --default-location <location> \
  --no-input
```

### 2. Review or update saved defaults

```bash
e2ectl-hitesh-test config list
e2ectl-hitesh-test config set-default --alias prod
e2ectl-hitesh-test config set-context \
  --alias prod \
  --default-project-id <project-id> \
  --default-location <location>
```

### 3. Discover valid operating system rows

```bash
e2ectl-hitesh-test node catalog os --alias prod
```

### 4. Discover valid node configs and billing options

```bash
e2ectl-hitesh-test node catalog plans \
  --alias prod \
  --display-category "Linux Virtual Node" \
  --category Ubuntu \
  --os Ubuntu \
  --os-version 24.04 \
  --billing-type all
```

This command is config-first:

- the primary table shows valid config rows and exact `plan` and `image` values
- the committed table shows which committed plan ids belong to which config row
- the footer prints exact `node create` examples

### 5. Create a node

Hourly:

```bash
e2ectl-hitesh-test node create \
  --alias prod \
  --name demo-node \
  --plan <exact-plan-from-catalog> \
  --image <exact-image-from-catalog>
```

Committed:

```bash
e2ectl-hitesh-test node create \
  --alias prod \
  --name demo-node \
  --plan <exact-plan-from-catalog> \
  --image <exact-image-from-catalog> \
  --billing-type committed \
  --committed-plan-id <exact-committed-plan-id-from-catalog>
```

### 6. Inspect the result

```bash
e2ectl-hitesh-test node list --alias prod
e2ectl-hitesh-test node get <node-id> --alias prod
```

If the selected alias already has a saved project id and location, later commands can omit `--project-id` and `--location`.

## Common Resource Workflows

### Node operations

Inspect and manage nodes:

```bash
e2ectl-hitesh-test node list
e2ectl-hitesh-test node get <node-id>
e2ectl-hitesh-test node delete <node-id> --force
e2ectl-hitesh-test node action power-on <node-id>
e2ectl-hitesh-test node action save-image <node-id> --name <image-name>
```

Attach resources to a node:

```bash
e2ectl-hitesh-test node action vpc attach <node-id> --vpc-id <vpc-id>
e2ectl-hitesh-test node action volume attach <node-id> --volume-id <volume-id>
e2ectl-hitesh-test node action ssh-key attach <node-id> --ssh-key-id <key-id>
```

### Volumes

Inspect the catalog and create a volume:

```bash
e2ectl-hitesh-test volume list
e2ectl-hitesh-test volume plans
e2ectl-hitesh-test volume create \
  --name data-01 \
  --size 250 \
  --billing-type hourly
e2ectl-hitesh-test volume create \
  --name analytics-data \
  --size 250 \
  --billing-type committed \
  --committed-plan-id 31 \
  --post-commit-behavior auto-renew
```

### VPCs

Inspect the catalog and create a VPC:

```bash
e2ectl-hitesh-test vpc list
e2ectl-hitesh-test vpc plans
e2ectl-hitesh-test vpc create \
  --name prod-vpc \
  --billing-type hourly \
  --cidr-source e2e
e2ectl-hitesh-test vpc create \
  --name analytics-vpc \
  --billing-type committed \
  --committed-plan-id 91 \
  --post-commit-behavior auto-renew \
  --cidr-source custom \
  --cidr 10.10.0.0/23
```

### SSH keys

List or create saved SSH keys:

```bash
e2ectl-hitesh-test ssh-key list
e2ectl-hitesh-test ssh-key create \
  --label admin-laptop \
  --public-key-file ~/.ssh/id_ed25519.pub
```

Use `--public-key-file -` to read a public key from stdin.

## Configuration And Authentication

Profiles are stored in `~/.e2e/config.json`.

Supported environment overrides:

- `E2E_API_KEY`
- `E2E_AUTH_TOKEN`
- `E2E_PROJECT_ID`
- `E2E_LOCATION`

Resolution order:

1. command flags
2. environment variables
3. the selected alias via `--alias`
4. the default saved alias

You can also add a profile manually:

```bash
e2ectl-hitesh-test config add \
  --alias prod \
  --api-key <api-key> \
  --auth-token <bearer-token> \
  --default-project-id <project-id> \
  --default-location <location>
```

## JSON And Automation

- Human-readable output is the default.
- `--json` emits deterministic machine-friendly output.
- Discovery commands such as `config list --json`, `node catalog os --json`, `node catalog plans --json`, `volume plans --json`, `vpc plans --json`, and `ssh-key list --json` are the safest entry points for automation.

## Safety Notes

- Saved credentials are written to `~/.e2e/` with restrictive permissions.
- `config import` validates credentials and alias state before writing.
- `node delete` prompts unless `--force` is supplied.
- API failures are normalized centrally so operators get consistent CLI errors.

## More Help

Use built-in help for the full command surface:

```bash
e2ectl-hitesh-test --help
e2ectl-hitesh-test config --help
e2ectl-hitesh-test node --help
e2ectl-hitesh-test volume --help
e2ectl-hitesh-test vpc --help
e2ectl-hitesh-test ssh-key --help
```

For deeper project docs:

- [CONTRIBUTING.md](./CONTRIBUTING.md) for contributor workflow and architecture
- [docs/MAINTAINING.md](./docs/MAINTAINING.md) for CI and maintenance policy
- [docs/RELEASING.md](./docs/RELEASING.md) for release automation and npm publishing
