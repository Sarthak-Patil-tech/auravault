# Contributing to AuraVault

Thanks for your interest! AuraVault is a small, deliberate codebase — please read this short
guide before opening a PR.

## Ground rules

1. **Security first.** If your change touches crypto, file handling, IPC or the preload
   bridge, explain the threat model in the PR description.
2. **No new runtime dependencies** without discussion. The zero-dependency app runtime is a
   feature (small supply chain, easy review). Dev-tooling is more flexible.
3. **No network code.** Feature requests that require the app to talk to the internet
   (cloud sync, accounts, telemetry) will be declined — that's the point of AuraVault.
4. **Match the design language.** Glass panels, inset groups, spring easings
   (`--spring`), light/dark parity. Reuse the tokens in `src/styles.css`.

## Dev setup

```bash
git clone https://github.com/Sarthak-Patil-tech/auravault.git
cd auravault
npm install
npm start
```

- Node 18+ (20 recommended).
- `npm run shots` runs the E2E suite — needs `xvfb-run` and ImageMagick's `import`
  (Linux) — and asserts the full first-run → unlock → lock → unlock cycle plus DOM/design
  invariants.
- `npm run shots:web` regenerates the documentation screenshots (needs Chromium).
- `npm run icons` regenerates the icon set after touching `src/assets/logo.svg`.

## Before you open a PR

- [ ] `node --check` passes on every file you touched
- [ ] The E2E suite passes: `npm run shots`
- [ ] Light **and** dark themes both look right
- [ ] No console errors during normal use
- [ ] Keyboard-only navigation still works (`Tab`, `Enter`, `Esc`)

## Commit style

Short, imperative subject lines — `Fix pill drift after window resize`, `Add expiry
validation to card sheet`. Squash WIP commits before merging.

## Reporting bugs

Open an issue with: Windows version, AuraVault version, what you expected, what happened,
and steps to reproduce. **Never paste real passwords or vault contents.**
