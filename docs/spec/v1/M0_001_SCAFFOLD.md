# M0_001: Repository Scaffold

**Prototype:** v0.1.0
**Milestone:** M0
**Workstream:** 001
**Date:** Mar 11, 2026
**Status:** DONE
**Priority:** P0 — Establish the repository contract and developer workflow
**Depends on:** None

---

## 1.0 Tooling Baseline

**Status:** DONE

Create the repository structure and the TypeScript CLI toolchain.

**Dimensions:**

- 1.1 DONE Add package metadata, build scripts, and TypeScript configuration
- 1.2 DONE Add ESLint, Prettier, Vitest, and Make targets
- 1.3 DONE Add GitHub Actions CI for lint, test, and build

---

## 2.0 Repository Shape

**Status:** DONE

Add the initial source, tests, docs, and makefile layout needed for milestone-driven development.

### 2.1 CLI Skeleton

Base command wiring and command namespaces are present.

**Dimensions:**

- 2.1.1 DONE Add the `e2ectl` entrypoint and root Commander program
- 2.1.2 DONE Add `config` and `node` command namespaces

### 2.2 Project Docs

Starter docs explain current scope and verification flow.

**Dimensions:**

- 2.2.1 DONE Add README, CONTRIBUTING, roadmap, and versioning files
- 2.2.2 DONE Add a simple architecture diagram source

---

## 3.0 Acceptance Criteria

**Status:** DONE

- [x] 3.1 The repository can install dependencies and run lint, test, and build
- [x] 3.2 The CLI entrypoint is wired and shows help
- [x] 3.3 CI configuration exists for the supported Node.js matrix

---

## 4.0 Out of Scope

- Real API requests
- User-facing config mutation commands
- Node resource operations
