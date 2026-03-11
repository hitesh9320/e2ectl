# M1_001: Config, Auth, and Types

**Prototype:** v0.1.0
**Milestone:** M1
**Workstream:** 001
**Date:** Mar 11, 2026
**Status:** DONE
**Priority:** P0 — Establish typed local state and credential resolution
**Depends on:** M0_001

---

## 1.0 Config Storage

**Status:** DONE

Implement the config file model and filesystem-backed persistence helpers.

**Dimensions:**

- 1.1 DONE Model the stored config and profile schema
- 1.2 DONE Support reading, writing, deleting, and default profile updates
- 1.3 DONE Make config serialization deterministic

---

## 2.0 Credential Resolution

**Status:** DONE

Resolve runtime credentials from environment variables and saved profiles with clear failure modes.

**Dimensions:**

- 2.1 DONE Add environment variable parsing for `E2E_*` credentials
- 2.2 DONE Overlay env values on top of the selected or default profile
- 2.3 DONE Raise actionable errors when credentials are incomplete or missing

---

## 3.0 Output and Error Utilities

**Status:** DONE

Add stable JSON formatting and reusable CLI error primitives.

**Dimensions:**

- 3.1 DONE Add deterministic JSON formatting helpers
- 3.2 DONE Add secret masking helpers for future list commands
- 3.3 DONE Add stable error codes and human-readable error formatting

---

## 4.0 Acceptance Criteria

**Status:** DONE

- [x] 4.1 Config storage and auth resolution are covered by unit tests
- [x] 4.2 Secrets can be masked without losing the last four characters
- [x] 4.3 Error messages include the next step when resolution fails

---

## 5.0 Out of Scope

- HTTP API client implementation
- Credential validation against the live API
- User-facing config subcommands
