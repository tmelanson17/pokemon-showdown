#!/usr/bin/env bash
# Runs recreate.js in parallel, BATCH_SIZE instances at a time, across
# NUM_BATCHES batches, all recreating the same turn-N state from the same
# replay and then diverging independently (each instance gets its own PRNG
# seed). Uses the same format/log/turn/pastes as the example in
# battle-recreate/README.md -- edit the variables below to point at
# different replay data.
#
# Usage:
#   battle-recreate/run-parallel.sh [outdir]
#
# Writes battle<NNN>.txt (--out) and actions<NNN>.json (--actions-out) for
# NNN = zero-padded 1..(BATCH_SIZE * NUM_BATCHES), into outdir (default:
# current directory).
set -euo pipefail

FORMAT=gen9championsvgc2026regmb
LOG=~/pokemon-showdown-replays/team_sheets/gen9championsvgc2026regmb-2666983777.json
TURN=2
PASTE1=~/pokemon-showdown-replays/team_sheets/pastes/gen9championsvgc2026regmb-2666983777-p1.txt
PASTE2=~/pokemon-showdown-replays/team_sheets/pastes/gen9championsvgc2026regmb-2666983777-p2.txt

BATCH_SIZE=3
NUM_BATCHES=50
TOTAL=$((BATCH_SIZE * NUM_BATCHES))
WIDTH=${#TOTAL}

OUTDIR="${1:-.}"
mkdir -p "$OUTDIR"

cd "$(dirname "$0")/.."

status=0
for j in $(seq 1 "$NUM_BATCHES"); do
	pids=()
	names=()
	for i in $(seq 1 "$BATCH_SIZE"); do
		# Unique per (i, j) -- a plain `i + j` sum collides across different
		# (i, j) pairs (e.g. (1,3), (2,2), (3,1) all give 4), which silently
		# overwrote earlier batches' output files under the same name.
		idx=$(((j - 1) * BATCH_SIZE + i))
		padded=$(printf "%0${WIDTH}d" "$idx")
		node battle-recreate/recreate.js "$FORMAT" "$LOG" "$TURN" "$PASTE1" "$PASTE2" \
			--seed="$idx,$((idx + 1)),$((idx + 2)),$((idx + 3))" \
			--out="$OUTDIR/battle${padded}.txt" \
			--actions-out="$OUTDIR/actions${padded}.json" \
			--quiet &
		pids+=("$!")
		names+=("$padded")
	done

	for k in "${!pids[@]}"; do
		if wait "${pids[$k]}"; then
			echo "instance ${names[$k]}: ok -> $OUTDIR/battle${names[$k]}.txt, $OUTDIR/actions${names[$k]}.json"
		else
			echo "instance ${names[$k]}: FAILED"
			status=1
		fi
	done
done

exit $status
