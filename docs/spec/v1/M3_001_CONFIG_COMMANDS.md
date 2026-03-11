# M3_001: Config Commands

**Prototype:** v0.1.0
**Milestone:** M3
**Workstream:** 001
**Date:** Mar 11, 2026
**Status:** DONE
**Priority:** P0 — Make profile management usable from the CLI
**Depends on:** M2_001

---

## 1.0 Command Surface

**Status:** DONE

Implement the user-facing config command set on top of the existing store and validator layers.

**Dimensions:**

- 1.1 DONE Add `config add`
- 1.2 DONE Add `config list`
- 1.3 DONE Add `config set-default` and `config remove`

---

## 2.0 Validation and Output

**Status:** DONE

Ensure profile writes are validated before save and list output is safe for both humans and automation.

**Dimensions:**

- 2.1 DONE Validate credentials before save
- 2.2 DONE Mask credentials in list output
- 2.3 DONE Support deterministic JSON output for config operations

---

## 3.0 Acceptance Criteria

**Status:** DONE

- [x] 3.1 Config subcommands are wired into the CLI
- [x] 3.2 Profile writes fail fast on invalid local inputs
- [x] 3.3 List and mutation commands are covered by unit tests

---

## 4.0 Out of Scope

- Secrets manager integration
