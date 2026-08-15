# Admin first-run setup and blog visual parity

Date: 2026-08-13

## Scope

The administration application will use the public blog's visual language and add a one-time, token-protected first-run setup. It will not expose permanent public registration.

## Security model

- `GET /api/auth/setup/status` is public and reveals only whether first-run setup is required and whether a non-expired server-generated token exists.
- A server CLI creates a 256-bit one-time setup token. Only its SHA-256 hash is stored in SQLite; the plaintext is shown once.
- `POST /api/auth/setup/begin` requires the one-time token, username and a password of at least 14 characters. It stores only a password hash, an AES-256-GCM encrypted TOTP secret, and an opaque challenge hash. The challenge expires after 15 minutes.
- The begin response returns the TOTP secret and `otpauth` URI so the browser can render a QR code.
- `POST /api/auth/setup/confirm` requires the opaque challenge and a valid six-digit TOTP. It atomically creates the only administrator, generates ten recovery codes, consumes the setup token, creates a session and permanently closes setup.
- Existing `/api/auth/register` remains absent. If an administrator exists, all setup write endpoints return `409 SETUP_ALREADY_COMPLETED`.
- A server-only `admin:prepare-setup` command can, with an explicit replacement flag, revoke sessions and remove only authentication rows while preserving content, history, publish jobs and audit data. Production use requires a database backup first.

## First-run interface

1. Account card: one-time token, username, password and confirmation.
2. Authenticator card: QR code, manual Base32 secret and six-digit confirmation field.
3. Recovery card: ten codes, copy/download controls and an acknowledgement before entering the dashboard.
4. Successful confirmation creates the browser session; no second login is required.

## Visual direction

- Reuse the public blog variables: rose accent `#c74776`, warm paper background, serif display type, sans-serif controls, translucent surfaces, fine borders and the existing site background artwork.
- Add the same light/dark/system, accent and background preferences using the same local-storage keys as the public site.
- Keep the administration information density, editor dimensions, keyboard behavior and accessibility while restyling shell navigation, forms, cards, tables, dialogs and login/setup pages.
- The memorable motif is an “editorial desk”: masthead navigation over the blog background with layered paper panels and restrained rose annotations.

## Production rollout

1. Deploy code while the existing `owner` remains active.
2. Verify normal login and that setup status reports completed.
3. Back up `/var/lib/aier-blog/state/admin.sqlite`.
4. Run the explicit prepare-setup CLI, which preserves non-authentication state and prints a one-time setup token.
5. Verify the public setup page and deliver the token to the owner.