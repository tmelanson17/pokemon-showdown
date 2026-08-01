/**
 * Custom initial battle state
 * Pokemon Showdown - http://pokemonshowdown.com/
 *
 * Lets a battle be seeded with a starting turn number, per-Pokemon HP/status,
 * and which Pokemon are active vs. benched, instead of always starting fresh
 * at turn 1 with full-HP leads. See docs/SIMPLIFIED-POKEMON.md.
 *
 * @license MIT
 */

import type { Battle } from './battle';
import type { Side } from './side';

export interface InitialStatePokemon {
	/** 0-based index into the team as originally passed to the battle. */
	slot: number;
	/** Current HP in exact points, clamped to the Pokemon's max HP. Omit to keep full HP. */
	hp?: number;
	/** Status condition id: '', 'brn', 'par', 'psn', 'tox', 'slp', or 'frz'. Omit to keep healthy. */
	status?: string;
}

export interface InitialStateSide {
	/** 0-based team slot indices that start on the field, in field-position order. */
	active: number[];
	/** Per-Pokemon HP/status overrides. Pokemon not listed keep full HP and no status. */
	pokemon?: InitialStatePokemon[];
}

export interface BattleInitialState {
	/** Battle turn counter to start from. Omit to leave the normal turn-1 start alone. */
	turn?: number;
	p1: InitialStateSide;
	p2: InitialStateSide;
}

function applySideState(side: Side, state: InitialStateSide) {
	if (!state.active.length) {
		throw new Error(`Custom State Setup: side ${side.id} must have at least one active Pokemon slot`);
	}

	// side.pokemon is still in original import order at this point (before we reorder it below),
	// so `slot` in the config always refers to that original order.
	const originalOrder = side.pokemon.slice();
	const bySlot = (slot: number) => {
		const pokemon = originalOrder[slot];
		if (!pokemon) throw new Error(`Custom State Setup: side ${side.id} has no Pokemon at slot ${slot}`);
		return pokemon;
	};

	let newlyFainted = 0;
	for (const override of state.pokemon || []) {
		const pokemon = bySlot(override.slot);
		if (override.hp !== undefined) {
			const wasFainted = pokemon.fainted;
			pokemon.hp = Math.max(0, Math.min(pokemon.maxhp, override.hp));
			if (pokemon.hp <= 0) {
				pokemon.hp = 0;
				if (!wasFainted) {
					pokemon.fainted = true;
					newlyFainted++;
				}
			}
		}
		if (override.status && pokemon.hp > 0) {
			pokemon.setStatus(override.status, null, null, true);
		}
	}
	// side.pokemonLeft was just set to side.pokemon.length by the 'start' action; correct it
	// for any Pokemon we just marked fainted directly (bypassing the normal faint() pipeline).
	side.pokemonLeft -= newlyFainted;

	const leadSlots = new Set(state.active);
	const leads = state.active.map(bySlot);
	for (const lead of leads) {
		if (lead.fainted) {
			throw new Error(`Custom State Setup: side ${side.id} can't start with a fainted Pokemon active`);
		}
	}
	const bench = originalOrder.filter((pokemon, i) => !leadSlots.has(i));
	side.pokemon = [...leads, ...bench];
	side.pokemon.forEach((pokemon, i) => { pokemon.position = i; });
}

export function applyInitialState(battle: Battle, state: BattleInitialState) {
	applySideState(battle.sides[0], state.p1);
	applySideState(battle.sides[1], state.p2);
	// The normal turn-1 increment happens right after this runs, so subtract 1 here
	// to make `state.turn` match the turn number players actually see for their first move.
	if (state.turn !== undefined) battle.turn = state.turn - 1;
}
