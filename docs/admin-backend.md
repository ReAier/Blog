# Single-user administration deployment


## Key-based administrator access

The browser administration workspace accepts only `er-...` administrator keys. Create the first or recovery Owner key over SSH:

```bash
npm run admin:key -- create --data-root /var/lib/aier-blog --role owner --expires permanent --name "Primary owner"
```

The plaintext key is printed once, together with the exact `Admin database:` path that received it. A key can log in only to an administration service using that same database. Use `npm run admin:key -- list` to inspect metadata and `npm run admin:key -- revoke --id <id>` to revoke a key. Browser login exchanges the key for an HttpOnly same-origin session; the key is never persisted in browser storage. Sessions expire after 12 idle hours or seven absolute days, and immediately stop working when the key is revoked, expires, or loses permission.

Administrator keys use the `er-` prefix and support Viewer, Editor, Publisher and Owner templates plus per-operation permission changes. AI automation keys use the separate `ai-` prefix and cannot log in to the browser workspace. Deploying this migration invalidates all former `aier_pat_...` tokens, password/TOTP credentials, recovery codes and existing sessions. If every administrator key is lost, SSH is the only recovery path.

### Key types and lifetimes

| Type | Format | Accepted by | Storage |
| --- | --- | --- | --- |
| Administrator Key | `er-<43 base64url characters>` | `POST /api/auth/login` only | `admin_keys`, SHA-256 hash only |
| AI Key | `ai-<43 base64url characters>` | `/api/v1/*` Bearer authentication only | `api_tokens`, SHA-256 hash only |

Both types are generated from 32 random bytes and support 7-day, 30-day, 365-day, or permanent validity. Plaintext is returned only at creation time. Lists expose only the short identifying prefix, metadata, expiry, last-use time, and revocation state.

### Administrator role templates

- **Viewer**: read content, history, publish status, logs, trash, and backups; download posts, clips, and full backups.
- **Editor**: Viewer plus content creation and editing, imports, history restore, slug migration, clip linking, image upload, and instant preview.
- **Publisher**: Editor plus soft deletion, trash restore/purge, publishing, backup creation, and backup validation. It cannot apply a full-site backup by default.
- **Owner**: every administrator permission, including applying full-site backups and managing both Administrator and AI Keys.

Templates provide initial checkbox values. Permissions may then be customized operation by operation. A key may grant only permissions it currently holds, and it may not create or extend a child key beyond its own expiry. Revocation, expiry, or permission reduction takes effect on existing browser sessions immediately.

This repository keeps the public Astro site static and runs the administration application as a separate Fastify service on `127.0.0.1:4310`. Production content is stored outside code releases and is the source of truth.

## Required platform

- Linux with Nginx and systemd.
- Node.js 24 LTS. The package manifest rejects Node.js 25 and newer non-baseline runtimes.
- A dedicated non-root user and group named `aier-blog`.
- Existing public release link at `/var/www/aier-blog/current`.

## Persistent layout

Create these paths before starting the service:

```text
/var/lib/aier-blog/
├── content/
│   ├── blog/
│   ├── clips/
│   ├── images/
│   └── redirects.json
├── state/
├── history/blobs/
├── trash/
├── jobs/
└── publish-requests/
```

The service user needs write access to `/var/lib/aier-blog`. Code releases under `/opt/aier-blog/releases` and public releases under `/var/www/aier-blog/releases` remain separate from content.

## Administrator key initialization

After installing a release, create the first Owner key from an SSH shell. The command needs only the persistent data root and prints the plaintext once:

```bash
cd /opt/aier-blog/current
sudo -u aier-blog -- \
  npm run admin:key -- create --data-root /var/lib/aier-blog --role owner --expires permanent --name "Primary owner"
```

List or revoke keys from SSH when browser access is unavailable:

```bash
npm run admin:key -- list --data-root /var/lib/aier-blog
npm run admin:key -- revoke --data-root /var/lib/aier-blog --id <key-id>
```

On Windows PowerShell, run the command on one line. A backslash (`\`) is not a PowerShell line-continuation character. For a non-default database, pass `--data-root <path>` explicitly and confirm the printed `Admin database:` path before using the key.

There is no browser registration, password reset, TOTP recovery, or unauthenticated setup endpoint.

### Troubleshooting an invalid Administrator Key

1. Confirm the Key starts with `er-`; an `ai-` Key can never log in to the browser workspace.
2. Run `npm run admin:key -- list --data-root <the-service-data-root>` and confirm the displayed prefix exists and is not expired or revoked.
3. Compare the CLI `Admin database:` line with the service configuration. Production normally uses `/var/lib/aier-blog/state/admin.sqlite`; local development normally uses `<project>/.admin-data/state/admin.sqlite`.
4. If the Key was created locally but the login page points to production, create a new Key through SSH against `/var/lib/aier-blog`. Copying the SQLite file is not the recovery procedure.
5. Check `journalctl -u aier-blog-admin.service` and `systemctl show aier-blog-admin.service -p Environment` if the configured data root is uncertain.

Login failures intentionally return the same vague 401 response for unknown, expired, and revoked Keys. This prevents the login endpoint from revealing which Key prefixes are valid.

## Install the service and release helpers

1. Copy `deployment/aier-blog-admin.service`, `deployment/aier-blog-publish.service`, and `deployment/aier-blog-publish.path` to `/etc/systemd/system/`.
2. Install `deployment/publish-release.sh` as root-owned mode `0755` at `/usr/local/sbin/aier-blog-publish-release`.
3. Install `deployment/publish-worker.sh` as root-owned mode `0755` at `/usr/local/sbin/aier-blog-publish-worker`.
4. Ensure the publish-request directory is `aier-blog:aier-blog` and mode `0700`.
5. Run `systemctl daemon-reload`, then enable and start `aier-blog-admin.service` and `aier-blog-publish.path`.

The Fastify process never receives general sudo access. It writes a validated request file; the root-owned path unit invokes the fixed worker, which accepts only approved build and redirect paths before calling the fixed release switch helper.

## Nginx

Install `deployment/nginx-admin.conf` in the active Nginx configuration and add the real TLS certificate directives. The public `blog.reaier.top` server must serve `/var/www/aier-blog/current` and include:

```nginx
include /etc/nginx/snippets/aier-blog-redirects.conf;
```

Run `nginx -t` before reload. The admin virtual host disables proxy buffering so SSE build and publish logs arrive immediately.

## Initial content migration

1. Back up the existing private content before changing services.
2. Deploy the code with an empty persistent content tree.
3. Create a permanent Owner `er-` Key through SSH against `/var/lib/aier-blog`.
4. Sign in at `https://admin.blog.reaier.top` and upload a full ZIP through **Backups**.
5. Validate the candidate, confirm apply, and inspect representative posts with the side-effect-free instant preview.
6. Start a publish job only after content review. Until the publish succeeds, leave the previous static `current` link untouched.

Full backups contain only `blog/`, `clips/`, `images/`, `redirects.json`, the versioned manifest, and SHA-256 values. They deliberately exclude Administrator Keys, AI Keys, legacy password/TOTP material, sessions, audit data, and history blobs.

## Code upgrade and public publishing

Always exercise the local workflow first:

```powershell
npm run upgrade -- --dry-run
```

A formal `npm run upgrade` creates a source archive, installs locked dependencies, builds the React admin, performs required persistent-content migrations and validation, atomically switches `/opt/aier-blog/current`, and restarts the admin service. It never builds or switches `/var/www/aier-blog/current`; the previous public site remains active if the code upgrade succeeds or fails.

After the upgrade is healthy, sign in to the management UI and start a publish job from **Publish**. Only that backend pipeline creates the Astro build and asks the restricted root-owned publish worker to switch the public release.

## Operations

- View admin logs: `journalctl -u aier-blog-admin.service`.
- View release-helper logs: `journalctl -u aier-blog-publish.service`.
- Validate service health locally: `curl -fsS http://127.0.0.1:4310/api/health`.
- Keep `/etc/aier-blog/admin.env`, `/var/lib/aier-blog/state/admin.sqlite`, content, trash, history, and jobs out of code deployment archives.
- Image trash is retained for 30 days and cleaned on service startup.
- Successful public switches retain the five newest static release directories.
- Use the management UI to inspect the immutable content hash and full build log before and after every release.

## AI and automation access

Machine clients use scoped `ai-...` Bearer tokens instead of browser cookies or CSRF tokens. Create and revoke tokens from **API 与安全** in the management UI. The protected OpenAPI 3.1 document is available at `/api/v1/openapi.json`. Machine clients cannot publish, delete, restore, migrate slugs, manage backups, or administer credentials. See [AI REST API usage](ai-api.md).
