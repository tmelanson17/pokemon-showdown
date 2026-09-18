#!/usr/bin/env bash
# Runs 3 recreate.js instances in parallel, all recreating the same
# turn-N state from the same replay, then diverging independently from
# there (each gets its own PRNG seed). Uses the same format/log/turn/pastes
# as the example in battle-recreate/README.md -- edit the variables below
# to point at different replay data.
#
# Usage:
#   battle-recreate/run-parallel.sh [outdir]
#
# Writes battle<i>.txt (--out) and actions<i>.json (--actions-out) for
# i in 1..3 into outdir (default: current directory).
set -euo pipefail

FORMAT=gen9championsvgc2026regmb
LOG=~/pokemon-showdown-replays/team_sheets/gen9championsvgc2026regmb-2666983777.json
TURN=2
PASTE1=~/pokemon-showdown-replays/team_sheets/pastes/gen9championsvgc2026regmb-2666983777-p1.txt
PASTE2=~/pokemon-showdown-replays/team_sheets/pastes/gen9championsvgc2026regmb-2666983777-p2.txt

OUTDIR="${1:-.}"
mkdir -p "$OUTDIR"

cd "$(dirname "$0")/.."

pids=()
for j in $(seq 1 50); do
	for i in $(seq 1 3); do
		sum=$((i + j))
		padded=$(printf "%02d" "$sum")
		node battle-recreate/recreate.js "$FORMAT" "$LOG" "$TURN" "$PASTE1" "$PASTE2" \
			--seed="$sum,$((sum + 1)),$((sum + 2)),$((sum + 3))" \
			--out="$OUTDIR/battle${padded}.txt" \
			--actions-out="$OUTDIR/actions${padded}.json" \
			--quiet &
		pids+=("$!")
	done

	status=0
	for i in "${!pids[@]}"; do
		if wait "${pids[$i]}"; then
			echo "instance $((i + 1)): ok -> $OUTDIR/battle$((i + 1)).txt, $OUTDIR/actions$((i + 1)).json"
		else
			echo "instance $((i + 1)): FAILED"
			status=1
		fi
	done
done
exit $status
