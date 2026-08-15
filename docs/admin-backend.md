# Single-user administration deployment

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

## Secrets and administrator initialization

Create `/etc/aier-blog/admin.env` as root with mode `0600`:

```dotenv
ADMIN_MASTER_KEY=<64 lowercase hexadecimal characters>
```

Generate the key with `openssl rand -hex 32`. Never copy it into this repository or a content backup.

After installing a code release, initialize the only administrator from an interactive root shell. Do not put the password in shell history; omit `--password` to receive a hidden prompt:

```bash
cd /opt/aier-blog/current
sudo -u aier-blog \
  ADMIN_MASTER_KEY="$(sudo cat /etc/aier-blog/admin.env | sed -n 's/^ADMIN_MASTER_KEY=//p')" \
  BLOG_ADMIN_DATA_ROOT=/var/lib/aier-blog \
  npm run admin:init -- --username owner
```

The command prints the TOTP URI, an ANSI QR code, and ten one-time recovery codes. Store the recovery codes offline. There is no registration, invitation, user-list, or password-reset web endpoint.

Emergency credential rotation is server-only and revokes all existing sessions:

```bash
sudo -u aier-blog \
  ADMIN_MASTER_KEY="<same-master-key>" \
  BLOG_ADMIN_DATA_ROOT=/var/lib/aier-blog \
  npm run admin:reset -- --username owner
```

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
3. Initialize the administrator.
4. Sign in at `https://admin.blog.reaier.top` and upload a full ZIP through **Backups**.
5. Validate the candidate, confirm apply, and inspect representative posts with the side-effect-free instant preview.
6. Start a publish job only after content review. Until the publish succeeds, leave the previous static `current` link untouched.

Full backups contain only `blog/`, `clips/`, `images/`, `redirects.json`, the versioned manifest, and SHA-256 values. They deliberately exclude credentials, TOTP, sessions, audit data, and history blobs.

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

Machine clients use scoped `aier_pat_...` Bearer tokens instead of browser cookies or CSRF tokens. Create and revoke tokens from **API 与安全** in the management UI. The protected OpenAPI 3.1 document is available at `/api/v1/openapi.json`. Machine clients cannot publish, delete, restore, migrate slugs, manage backups, or administer credentials. See [AI REST API usage](ai-api.md).
