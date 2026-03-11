# M9_001: Config Import

**Prototype:** v0.1.0
**Milestone:** M9
**Workstream:** 001
**Date:** Mar 11, 2026
**Status:** DONE
**Priority:** P1 — Make first-time profile setup faster and less error-prone
**Depends on:** M3_001

---

## 1.0 Command Surface

**Status:** DONE

Add a first-time setup flow that imports aliases and secrets from a downloaded JSON file.

**Dimensions:**

- 1.1 DONE Add `config import --file <path>`
- 1.2 DONE Support optional `--project-id`, `--location`, `--default`, `--force`, and `--no-input`
- 1.3 DONE Keep deterministic `--json` output for automation

---

## 2.0 Prompt and Validation Flow

**Status:** DONE

Prompt for shared metadata only when needed, validate every imported alias, and keep the saved-config behavior explicit.

**Dimensions:**

- 2.1 DONE Prompt once for missing `project_id`
- 2.2 DONE Prompt once for missing `location`
- 2.3 DONE Validate every imported alias before saving
- 2.4 DONE Print a success summary after import
- 2.5 DONE Prompt to set a default alias when the config does not already have one

---

## 3.0 Acceptance Criteria

**Status:** DONE

- [x] 3.1 Users can import one or more aliases from the downloaded credential JSON shape
- [x] 3.2 Non-interactive runs fail clearly when required shared metadata is missing
- [x] 3.3 Unit tests cover parser failures, shared prompts, and default-alias behavior

---

## 4.0 Out of Scope

- Secrets manager integration
- Exporting saved profiles back to external files
