#!/usr/bin/env bash
# Read-only remote operations. No existing working tree is touched.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:-$ROOT/branch-review}"
if [[ -e "$OUT" ]]; then echo "Map bestaat al. Kies een nieuwe uitvoermap." >&2; exit 1; fi
mkdir -p "$OUT"
OUT="$(cd "$OUT" && pwd)"
repo=https://github.com/TeunHSytrius/soc3Managment.git
git clone --no-checkout --no-single-branch "$repo" "$OUT/git-source"
GIT="$OUT/git-source"
# Make accidental pushes from the clone fail; keep the remote fetch URL intact.
git -C "$GIT" remote set-url --push origin 'disabled://read-only'
mkdir "$OUT/snapshots" "$OUT/diffs"
base=9b03c4c07010cfd7660c359eea10b2b54c48ca5b
while IFS=$'\t' read -r branch sha; do
  name=${branch//\//__}
  git -C "$GIT" cat-file -e "$sha^{commit}"
  current=$(git -C "$GIT" rev-parse "refs/remotes/origin/$branch")
  printf '%s\t%s\t%s\n' "$branch" "$sha" "$current" >> "$OUT/refs.tsv"
  mkdir "$OUT/snapshots/$name"
  git -C "$GIT" archive "$sha" | tar -xf - -C "$OUT/snapshots/$name"
  git -C "$GIT" diff --stat "$base" "$sha" > "$OUT/diffs/$name.stat.txt"
  git -C "$GIT" diff --binary "$base" "$sha" > "$OUT/diffs/$name.patch"
  if [[ "$sha" != "$current" ]]; then echo "NIEUWE HEAD: $branch ($current). Review extra wijzigingen vóór integratie."; fi
done < "$ROOT/scripts/branches.tsv"
echo "Originele snapshots, patches en actuele HEADs staan in $OUT. Geen merges of pushes uitgevoerd."
