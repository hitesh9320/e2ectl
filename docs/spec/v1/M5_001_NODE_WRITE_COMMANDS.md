# M5_001: Node Write Commands

**Prototype:** v0.1.0
**Milestone:** M5
**Workstream:** 001
**Date:** Mar 11, 2026
**Status:** DONE
**Priority:** P0 — Enable minimal but safe node mutations
**Depends on:** M4_001

---

## 1.0 Write Operations

**Status:** DONE

Implement the prototype node mutation commands on top of the internal API client.

**Dimensions:**

- 1.1 DONE Add `node create`
- 1.2 DONE Add `node delete`
- 1.3 DONE Reuse profile and env credential resolution for write commands

---

## 2.0 Safety And Defaults

**Status:** DONE

Keep the write surface minimal and safe for the prototype.

**Dimensions:**

- 2.1 DONE `node create` requires only `--name`, `--plan`, and `--image`
- 2.2 DONE `node create` applies documented prototype defaults to optional fields
- 2.3 DONE `node delete` prompts unless `--force` is provided

---

## 3.0 Acceptance Criteria

**Status:** DONE

- [x] 3.1 Create and delete commands are wired into the CLI
- [x] 3.2 Delete avoids destructive execution when confirmation is declined
- [x] 3.3 Unit tests cover request shaping and delete confirmation behavior

---

## 4.0 Out of Scope

- Additional node action endpoints
- Extended create flags beyond the prototype-required inputs
- Bulk delete or multi-node orchestration
