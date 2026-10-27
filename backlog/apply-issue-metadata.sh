#!/usr/bin/env bash
# Syncs backlog item files -> existing GitHub issues.
# Each item file embeds its own metadata:
#   - **GitHub issue:**   <url>
#   - **GitHub labels:**  `label`, ...
#   - **GitHub milestone:** <name>
# For every item this script:
#   1. rewrites the issue DESCRIPTION from the file (so labels + milestone data live inside the issue body)
#   2. attaches the real labels
#   3. assigns the milestone
#
# Requires a token with issues:write. If you see "Resource not accessible by
# integration" (403), reconnect GitHub in Arena and re-run — the script is idempotent.
set -u
cd "$(dirname "$0")/.."   # repo root

ok=0; fail=0
for f in backlog/phase-*/*.md backlog/post-mvp/*.md; do
  num=$(grep -m1 'GitHub issue:'   "$f" | sed 's|.*/issues/||')
  labels=$(grep -m1 'GitHub labels:' "$f" | sed 's/.*:\*\* //' | tr -d '\`' | tr -d ' ')
  ms=$(grep -m1 'GitHub milestone:' "$f" | sed 's/.*:\*\* //')

  if [ -z "$num" ] || [ -z "$labels" ] || [ -z "$ms" ]; then
    echo "SKIP  metadata missing in $f"; fail=$((fail+1)); continue
  fi

  errs=""
  gh issue edit "$num" --body-file "$f" >/dev/null 2>&1        || errs="$errs desc"
  gh issue edit "$num" --add-label "$labels" >/dev/null 2>&1    || errs="$errs labels"
  gh issue edit "$num" --milestone "$ms" >/dev/null 2>&1        || errs="$errs milestone"

  if [ -z "$errs" ]; then
    echo "OK    #$num  $(basename "$f")"
    ok=$((ok+1))
  else
    echo "FAIL  #$num  $(basename "$f")  (missing:$errs)"
    fail=$((fail+1))
  fi
done

echo "----"
echo "applied=$ok failed=$fail"
[ "$fail" -eq 0 ]
