# M6_001: Test Suite

**Prototype:** v0.1.0
**Milestone:** M6
**Workstream:** 001
**Date:** Mar 11, 2026
**Status:** DONE
**Priority:** P0 — Make the prototype safely changeable
**Depends on:** M5_001

---

## 1.0 Unit Coverage

**Status:** DONE

Expand automated coverage for the prototype command and client layers.

**Dimensions:**

- 1.1 DONE Broaden auth, formatter, config, and node command unit coverage
- 1.2 DONE Add request-shape tests for node create and delete
- 1.3 DONE Keep unit tests isolated from the real home directory and network

---

## 2.0 Manual Read-Only Checks

**Status:** DONE

Provide a manual lane for live MyAccount verification without making it part of CI.

**Dimensions:**

- 2.1 DONE Add a separate manual Vitest config
- 2.2 DONE Add read-only API checks gated by `E2ECTL_RUN_MANUAL_E2E=1`
- 2.3 DONE Keep the manual suite skipped by default

---

## 3.0 Acceptance Criteria

**Status:** DONE

- [x] 3.1 Unit coverage spans config CRUD, auth resolution, formatter behavior, and command wiring
- [x] 3.2 Manual read-only tests exist and are excluded from CI by default
- [x] 3.3 Test helpers keep runtime and config fixtures deterministic

---

## 4.0 Out of Scope

- Destructive live API tests
- Coverage thresholds or reporting gates
- Browser or Playwright-based CLI testing
