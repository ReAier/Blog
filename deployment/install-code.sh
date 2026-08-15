#!/usr/bin/env bash
set -Eeuo pipefail

if [[ $# -ne 2 ]]; then
  echo "usage: $0 <release-id> <uploaded-archive>" >&2
  exit 64
fi

RELEASE_ID="$1"
ARCHIVE="$2"
CODE_ROOT=/opt/aier-blog
NEW="$CODE_ROOT/releases/$RELEASE_ID"
CURRENT="$CODE_ROOT/current"
CONTENT_ROOT=/var/lib/aier-blog/content
CONTENT_BACKUP="$NEW/.content-before-migration"
CONTENT_BACKUP_READY=0
PREVIOUS=""
if [[ -L "$CURRENT" ]]; then
  PREVIOUS="$(readlink -f -- "$CURRENT" 2>/dev/null || true)"
fi

rollback_code() {
  local status=$?
  rm -f -- "$CURRENT.next"
  if [[ "$CONTENT_BACKUP_READY" == 1 && -d "$CONTENT_BACKUP" ]]; then
    sudo systemctl stop aier-blog-admin.service || true
    sudo rm -rf -- "$CONTENT_ROOT.restore"
    sudo cp -a -- "$CONTENT_BACKUP" "$CONTENT_ROOT.restore"
    sudo rm -rf -- "$CONTENT_ROOT"
    sudo mv -- "$CONTENT_ROOT.restore" "$CONTENT_ROOT"
  fi
  if [[ -n "$PREVIOUS" && "$PREVIOUS" != "$CURRENT" && -d "$PREVIOUS" ]]; then
    ln -sfn -- "$PREVIOUS" "$CURRENT.next"
    mv -Tf -- "$CURRENT.next" "$CURRENT"
    sudo systemctl restart aier-blog-admin.service || true
  elif [[ -L "$CURRENT" ]]; then
    rm -f -- "$CURRENT"
  fi
  exit "$status"
}
trap rollback_code ERR

cd "$NEW"
npm ci
npm run admin:build
sudo systemctl stop aier-blog-admin.service
sudo rm -rf -- "$CONTENT_BACKUP"
sudo cp -a -- "$CONTENT_ROOT" "$CONTENT_BACKUP"
CONTENT_BACKUP_READY=1
sudo -u aier-blog -- env \
  HOME=/var/lib/aier-blog \
  BLOG_CONTENT_ROOT="$CONTENT_ROOT" \
  BLOG_ADMIN_DATA_ROOT=/var/lib/aier-blog \
  npm run admin:migrate-independent-assets
BLOG_CONTENT_ROOT="$CONTENT_ROOT" npm run admin:validate-content

ln -sfn -- "$NEW" "$CURRENT.next"
mv -Tf -- "$CURRENT.next" "$CURRENT"
sudo systemctl restart aier-blog-admin.service
ADMIN_HEALTHY=0
for attempt in {1..30}; do
  if curl -fsS --max-time 2 http://127.0.0.1:4310/api/health >/dev/null 2>&1; then
    ADMIN_HEALTHY=1
    break
  fi
  sleep 1
done
[[ "$ADMIN_HEALTHY" == 1 ]]

trap - ERR
sudo rm -rf -- "$CONTENT_BACKUP"
rm -f -- "$ARCHIVE"
CURRENT_NAME="$(basename -- "$(readlink -f -- "$CURRENT")")"
find "$CODE_ROOT/releases" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' \
  | sort -r | awk 'NR>5' | while read -r old; do
      [[ "$old" == "$CURRENT_NAME" ]] || rm -rf -- "$CODE_ROOT/releases/$old"
    done
printf 'code-release=%s\n' "$RELEASE_ID"
