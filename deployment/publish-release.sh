#!/usr/bin/env bash
set -Eeuo pipefail

if [[ $# -ne 4 ]]; then
  echo "usage: $0 <dist> <content-hash> <release-id> <redirects-include>" >&2
  exit 64
fi

DIST="$(realpath -e -- "$1")"
CONTENT_HASH="$2"
RELEASE_ID="$3"
REDIRECTS="$(realpath -e -- "$4")"
PUBLIC_ROOT=/var/www/aier-blog
RELEASES_ROOT="$PUBLIC_ROOT/releases"
CURRENT_LINK="$PUBLIC_ROOT/current"
REDIRECT_TARGET=/etc/nginx/snippets/aier-blog-redirects.conf
HEALTH_URL=https://blog.reaier.top/

[[ "$CONTENT_HASH" =~ ^[a-f0-9]{64}$ ]] || { echo 'invalid content hash' >&2; exit 65; }
[[ "$RELEASE_ID" =~ ^[A-Za-z0-9._-]+$ ]] || { echo 'invalid release id' >&2; exit 65; }
[[ -s "$DIST/index.html" ]] || { echo 'dist/index.html is missing' >&2; exit 66; }
[[ -f "$REDIRECTS" ]] || { echo 'redirect include is missing' >&2; exit 66; }
case "$DIST" in
  /var/lib/aier-blog/jobs/*/workspace/dist|/opt/aier-blog/releases/*/dist) ;;
  *) echo "dist path is outside the approved roots: $DIST" >&2; exit 65 ;;
esac
case "$REDIRECTS" in
  /var/lib/aier-blog/jobs/*/workspace/.deploy-redirects.conf|/opt/aier-blog/releases/*/.deploy-redirects.conf) ;;
  *) echo "redirect path is outside the approved roots: $REDIRECTS" >&2; exit 65 ;;
esac

DESTINATION="$RELEASES_ROOT/$RELEASE_ID"
PREVIOUS="$(readlink -f -- "$CURRENT_LINK" 2>/dev/null || true)"
PREVIOUS_REDIRECT=""
TEMP_REDIRECT="${REDIRECT_TARGET}.new.$$"
NEXT_LINK="${CURRENT_LINK}.next.$$"

rollback() {
  local exit_code=$?
  rm -f -- "$NEXT_LINK" "$TEMP_REDIRECT"
  if [[ -n "$PREVIOUS" && -d "$PREVIOUS" ]]; then
    ln -sfn -- "$PREVIOUS" "$NEXT_LINK"
    mv -Tf -- "$NEXT_LINK" "$CURRENT_LINK"
  fi
  if [[ -n "$PREVIOUS_REDIRECT" && -f "$PREVIOUS_REDIRECT" ]]; then
    install -o root -g root -m 0644 -- "$PREVIOUS_REDIRECT" "$REDIRECT_TARGET"
  fi
  nginx -t >/dev/null 2>&1 && systemctl reload nginx || true
  exit "$exit_code"
}
trap rollback ERR

mkdir -p -- "$RELEASES_ROOT" "$(dirname -- "$REDIRECT_TARGET")"
rm -rf -- "$DESTINATION"
mkdir -p -- "$DESTINATION"
cp -a -- "$DIST/." "$DESTINATION/"
chown -R root:root -- "$DESTINATION"
find "$DESTINATION" -type d -exec chmod 0755 {} +
find "$DESTINATION" -type f -exec chmod 0644 {} +
printf '%s\n' "$CONTENT_HASH" > "$DESTINATION/.content-hash"

if [[ -f "$REDIRECT_TARGET" ]]; then
  PREVIOUS_REDIRECT="$(mktemp /tmp/aier-blog-redirects.XXXXXX)"
  cp -- "$REDIRECT_TARGET" "$PREVIOUS_REDIRECT"
fi
install -o root -g root -m 0644 -- "$REDIRECTS" "$TEMP_REDIRECT"
nginx -t
mv -f -- "$TEMP_REDIRECT" "$REDIRECT_TARGET"

ln -sfn -- "$DESTINATION" "$NEXT_LINK"
mv -Tf -- "$NEXT_LINK" "$CURRENT_LINK"
nginx -t
systemctl reload nginx
curl -fsS --max-time 15 --resolve blog.reaier.top:443:127.0.0.1 "$HEALTH_URL" >/dev/null

trap - ERR
[[ -n "$PREVIOUS_REDIRECT" ]] && rm -f -- "$PREVIOUS_REDIRECT"
CURRENT="$(basename -- "$(readlink -f -- "$CURRENT_LINK")")"
mapfile -t OLD_RELEASES < <(find "$RELEASES_ROOT" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort -r | tail -n +6)
for old in "${OLD_RELEASES[@]}"; do
  [[ "$old" == "$CURRENT" ]] || rm -rf -- "$RELEASES_ROOT/$old"
done
printf 'release=%s current=%s\n' "$RELEASE_ID" "$CURRENT"
