'use strict';

/**
 * Turns a raw `battle.choose()` choice string (e.g. "move 3 2, switch 3")
 * into a human-readable description (e.g. "Primarina: Moonblast -> slot 2;
 * Iron Hands: switch to Ursaluna"), by resolving move-slot/switch-target
 * indices against the same `ChoiceRequest` that the choice was picked from.
 */

function pokemonName(reqData) {
	if (!reqData) return '?';
	const idx = reqData.ident.indexOf(': ');
	return idx >= 0 ? reqData.ident.slice(idx + 2) : reqData.ident;
}

function moveName(active, slot) {
	if (!active) return `move ${slot}`;
	const fromMoves = active.moves && active.moves[slot - 1];
	if (fromMoves) return fromMoves.move;
	const fromMax = active.maxMoves && active.maxMoves.maxMoves && active.maxMoves.maxMoves[slot - 1];
	if (fromMax) return fromMax.move;
	return `move ${slot}`;
}

function describeChoice(request, choiceStr) {
	if (!choiceStr) return '';
	if (choiceStr === 'default') return 'default (team preview)';

	const pokemon = request.side && request.side.pokemon;
	const actives = request.active;

	const described = choiceStr.split(', ').map((segment, i) => {
		if (segment === 'pass') return null; // omit no-ops from the readable form
		const actor = pokemonName(pokemon && pokemon[i]);

		const switchMatch = segment.match(/^switch (\d+)$/);
		if (switchMatch) {
			const target = pokemonName(pokemon && pokemon[Number(switchMatch[1]) - 1]);
			return `${actor}: switch to ${target}`;
		}

		const moveMatch = segment.match(/^move (\d+)( -?\d+)?( zmove)?( terastallize)?$/);
		if (moveMatch) {
			const [, slotStr, targetLoc, zmove, tera] = moveMatch;
			const active = actives && actives[i];
			const name = moveName(active, Number(slotStr));
			let desc = `${actor}: ${zmove ? `Z-${name}` : name}`;
			if (targetLoc) desc += ` -> slot ${targetLoc.trim()}`;
			if (tera) desc += ' (Terastallize)';
			return desc;
		}

		// Unrecognized shape (e.g. "instaswitch", "shift") -- fall back to raw.
		return `${actor}: ${segment}`;
	}).filter(Boolean);

	return described.join('; ');
}

module.exports = { describeChoice };
