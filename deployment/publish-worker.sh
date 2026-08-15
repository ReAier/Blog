#!/usr/bin/env bash
set -Eeuo pipefail

REQUEST_ROOT=/var/lib/aier-blog/publish-requests
SWITCH_HELPER=/usr/local/sbin/aier-blog-publish-release
mkdir -p -- "$REQUEST_ROOT"
shopt -s nullglob

for request in "$REQUEST_ROOT"/*.request.json; do
  base="${request%.request.json}"
  result="${base}.result.json"
  processing="${base}.processing.json"
  mv -- "$request" "$processing"

  if output="$(python3 - "$processing" <<'PY' | xargs -0 -r -- "$SWITCH_HELPER" 2>&1
import json
import os
import re
import sys

path = sys.argv[1]
with open(path, 'r', encoding='utf-8') as handle:
    request = json.load(handle)

required = ['dist', 'contentHash', 'releaseId', 'redirects']
if sorted(request.keys()) != sorted(required + ['id', 'requestedAt']):
    raise SystemExit('unexpected release request fields')
if not re.fullmatch(r'[a-f0-9]{64}', request['contentHash']):
    raise SystemExit('invalid content hash')
if not re.fullmatch(r'[A-Za-z0-9._-]+', request['releaseId']):
    raise SystemExit('invalid release id')
for key in ['dist', 'redirects']:
    value = os.path.realpath(request[key])
    if not value.startswith('/var/lib/aier-blog/jobs/'):
        raise SystemExit(f'{key} is outside the jobs root')
    if not os.path.exists(value):
        raise SystemExit(f'{key} does not exist')
    request[key] = value
for value in [request['dist'], request['contentHash'], request['releaseId'], request['redirects']]:
    sys.stdout.buffer.write(value.encode('utf-8') + b'\0')
PY
  )"; then
    release_id="$(printf '%s\n' "$output" | sed -n 's/.*release=\([^[:space:]]*\).*/\1/p' | tail -n 1)"
    python3 - "$result.tmp" "$release_id" "$output" <<'PY'
import json
import sys
path, release_id, output = sys.argv[1:]
with open(path, 'w', encoding='utf-8') as handle:
    json.dump({'ok': True, 'releaseId': release_id, 'log': output}, handle, ensure_ascii=False)
    handle.write('\n')
PY
  else
    status=$?
    python3 - "$result.tmp" "$status" "$output" <<'PY'
import json
import sys
path, status, output = sys.argv[1:]
with open(path, 'w', encoding='utf-8') as handle:
    json.dump({'ok': False, 'error': f'release helper exited with {status}', 'log': output}, handle, ensure_ascii=False)
    handle.write('\n')
PY
  fi
  chmod 0640 -- "$result.tmp"
  chown aier-blog:aier-blog -- "$result.tmp"
  mv -- "$result.tmp" "$result"
  rm -f -- "$processing"
done
