#!/usr/bin/env bash
# Clean-checkout verification (spec 14 §5, DOC-15): clones the COMMITTED HEAD of this repository into
# a temporary folder (no node_modules, no ignored files, no .env.local, no browser state) and runs
# the delivery gate there. Uncommitted changes are not part of the check.
#
#   scripts/delivery-check.sh                 install, typecheck, lint, format, test, build, E2E
#   SKIP_E2E=1 scripts/delivery-check.sh      everything but the E2E suite
#   E2E_PORT=4190 E2E_WORKERS=3 scripts/delivery-check.sh
#   DELIVERY_TMP=/path scripts/delivery-check.sh   where to put the clone (default: $TMPDIR or /tmp)
set -euo pipefail

root="$(git rev-parse --show-toplevel)"
base="${DELIVERY_TMP:-${TMPDIR:-/tmp}}"
work="$(mktemp -d "$base/kurio-delivery.XXXXXX")"
clone="$work/repo"
workers="${E2E_WORKERS:-3}"
timings=()
current="clone"

cleanup() {
  status=$?
  rm -rf "$work"
  if [ "$status" -ne 0 ]; then
    echo
    echo "FAILED at step: $current"
  fi
  if [ "${#timings[@]}" -gt 0 ]; then
    echo
    echo "Timings:"
    printf '  %s\n' "${timings[@]}"
  fi
  exit "$status"
}
trap cleanup EXIT

if [ -n "$(git -C "$root" status --porcelain)" ]; then
  echo "note: the working tree has uncommitted changes; only the committed HEAD is checked."
fi

step() {
  current="$1"
  shift
  echo
  echo "== $current"
  local start=$SECONDS
  "$@"
  timings+=("$current: $((SECONDS - start))s")
}

step "clone $(git -C "$root" rev-parse --short=7 HEAD)" git clone --quiet --no-local "$root" "$clone"
cd "$clone"

if command -v mise >/dev/null 2>&1; then
  step "mise install" mise install
fi
step "pnpm install --frozen-lockfile" pnpm install --frozen-lockfile
step "pnpm typecheck" pnpm typecheck
step "pnpm lint" pnpm lint
step "pnpm format:check" pnpm format:check
step "pnpm test" pnpm test
step "pnpm build" pnpm build

# What the deploy must look like (DOC-16, R10): the commit in the page head, no developer harnesses.
build_assertions() {
  expected="$(git rev-parse --short=7 HEAD)"
  grep -q "name=\"kurio-build\" content=\"$expected\"" dist/index.html \
    || { echo "dist/index.html has no kurio-build=$expected"; return 1; }
  if ls dist/assets | grep -Eq 'ui-kit|dev-realtime'; then
    echo "a /dev harness chunk reached dist/"
    return 1
  fi
  if grep -rq 'Kurio#Ana2026' dist; then
    echo "a plaintext demo password reached dist/"
    return 1
  fi
}
step "build assertions (kurio-build, no /dev, no passwords)" build_assertions

if [ "${SKIP_E2E:-0}" = "1" ]; then
  echo
  echo "== E2E skipped (SKIP_E2E=1)"
else
  step "pnpm test:e2e" env CI= pnpm test:e2e --workers="$workers"
fi

echo
echo "Delivery check passed on $(git rev-parse --short=7 HEAD)."
