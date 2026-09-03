# PinjamAkun workspace instructions

- Use strict TypeScript and pnpm workspace commands.
- Keep browser-safe packages separate from server-only database and secret handling.
- Treat cookies, tokens, private keys, and decrypted snapshots as sensitive; never log them.
- Browser host permissions must remain optional and be requested from an explicit user gesture.
- Do not add automatic cookie monitoring, password sharing, MFA bypass, or broad install-time host access.
- Every mutation and sync operation must be idempotent and authorization-scoped.
- Run formatting, lint, typecheck, tests, and builds before considering a change complete.
- Commit validated workspace changes; push only when a GitHub remote is configured.
