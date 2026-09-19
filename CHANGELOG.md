# Changelog

All notable changes to AuraVault are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] — 2026-09-19

### Fixed
- **Critical:** after creating a vault or unlocking, the lock overlay stayed
  rendered — invisible, but still blurring and blocking the whole UI. Overlay
  layers set an explicit `display`, which overrode the browser's `[hidden]`
  handling; `[hidden]` now always wins (`[hidden] { display: none !important }`).
  The E2E suite gained computed-style assertions (overlay visibility, sheet
  removal, post-unlock state) so this class of bug can never regress.

## [1.0.0] — 2026-09-19

First public release.

### Added
- **Vault** — AES-256-GCM encrypted storage, scrypt key derivation (N=16384, r=8, p=1),
  first-run setup wizard, master-password unlock & change.
- **Items** — logins, payment cards and secure notes with colored icons, favorites,
  search, and a 30-day Recently Deleted with undo/restore/empty.
- **Generator** — CSPRNG passwords, live entropy + offline crack-time meter,
  character-class toggles, look-alike avoidance, history of the last five.
- **Security Checkup** — local audit for weak, reused and stale passwords with a
  vault health score.
- **Design** — iOS-inspired glassmorphism in light & dark: frosted sidebar and
  content panels over a living wallpaper, inset-grouped lists, large titles,
  segmented controls, switches, toasts, and spring animations for app open/close,
  page pushes, modal sheets, row add/remove and the sliding sidebar pill.
- **Safety** — auto-lock on inactivity or Windows session lock, clipboard
  auto-wipe with countdown, single-instance lock, encrypted backup export/import.
- **Platform** — frameless window with custom chrome, keyboard shortcuts
  (`Ctrl+N`, `Ctrl+F`, `Ctrl+L`, `Esc`), one-click NSIS installer + portable exe,
  GitHub Actions release workflow, automated E2E suite and docs screenshot pipeline.

### Security
- Zero network code; sandboxed renderer (`contextIsolation` + `sandbox` + strict CSP);
  vault file written with `0600` permissions; all inputs length-capped and sanitized.

[1.0.1]: https://github.com/Sarthak-Patil-tech/auravault/releases/tag/v1.0.1
[1.0.0]: https://github.com/Sarthak-Patil-tech/auravault/releases/tag/v1.0.0
