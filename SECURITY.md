# Security Policy

## Supported versions

| Version | Supported |
| ------- | --------- |
| 1.0.x | ✅ |

## How AuraVault protects your data

- **Encryption at rest** — the entire vault is one file (`%APPDATA%\AuraVault\vault.avault`)
  encrypted with AES-256-GCM. The key is derived from your master password with
  scrypt (N=16384, r=8, p=1, random 16-byte salt).
- **Zero-knowledge** — the derived key and the decrypted vault exist only in main-process
  memory while the vault is unlocked. They are wiped when you lock, quit, or lock your
  Windows session (if enabled).
- **No network** — the app contains no code that can make a network request. There is no
  sync, no account system, no telemetry and no crash reporter.
- **Sandboxed UI** — the renderer runs with `contextIsolation: true`, `sandbox: true`,
  `nodeIntegration: false` and a strict CSP. It reaches the main process only through a
  small allow-listed IPC surface in `preload.js`.
- **Clipboard hygiene** — copied secrets are cleared from the clipboard automatically
  (configurable, default 20 seconds).
- **Tamper evidence** — GCM authentication tags make wrong passwords and corrupted or
  edited vault files fail cleanly.

## Threat model (honest version)

AuraVault protects data **at rest on your device** and in memory from casual inspection.
It does **not** protect against:

- Malware already running on your PC (a keylogger sees your master password as you type
  it; nothing local-only can defend against that).
- Someone watching your screen over your shoulder.
- A forgotten master password — **there is no recovery path, by design**.

## Reporting a vulnerability

Please report privately — do **not** open a public issue with exploit details.

1. Go to the repo's **Security** tab → **Report a vulnerability**, or
2. Email the maintainer (see the repo profile).

Include reproduction steps and, where possible, a proof of concept. You'll hear back within
a few days. Credit is given in release notes unless you prefer to remain anonymous.
