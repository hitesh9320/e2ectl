# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added

- Internal MyAccount API client with credential validation and node list/get/create/delete support.
- Config profile commands with masked listings and deterministic JSON output.
- Expanded unit coverage plus a manual read-only API test lane that is skipped by default.

### Changed

- CI now documents and enforces the lint, unit test, and build gate across Node 18, 20, and 22.

## [0.1.0] - Mar 11, 2026

- Initial scaffold for the `e2ectl` CLI prototype.
- M0 and M1 foundations: CLI wiring, config store, auth resolution, and test harness.
