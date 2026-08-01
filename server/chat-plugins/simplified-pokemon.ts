/**
 * Simplified Pokemon: custom-state 2-player battle setup
 *
 * When SIMPLIFIED_BATTLE_CONFIG points at a JSON config file (see
 * docs/SIMPLIFIED-POKEMON.md), this plugin waits for both configured
 * usernames to connect (thanks to `noguestsecurity`, no password is
 * needed - see config/config.js) and then creates a battle between them
 * seeded with the configured turn/HP/status/active-vs-bench state.
 *
 * @license MIT
 */

import { readFileSync } from 'fs';
import * as path from 'path';
import { Teams } from '../../sim/teams';
import type { BattleInitialState, InitialStatePokemon } from '../../sim/initial-state';

interface SimplifiedSideConfig {
	name: string;
	/** Path to a Showdown export/paste-format team file, relative to this config file. */
	team: string;
	/** 0-based team slot indices that start on the field, in field-position order. */
	active: number[];
	/** Per-Pokemon HP/status overrides. Pokemon not listed keep full HP and no status. */
	pokemon?: InitialStatePokemon[];
}

interface SimplifiedBattleConfig {
	p1: SimplifiedSideConfig;
	p2: SimplifiedSideConfig;
	/** Battle turn counter to start from. Omit to leave the normal turn-1 start alone. */
	turn?: number;
	/** Defaults to a Gen 9 Custom Game with Team Preview stripped (so the pre-set leads apply immediately). */
	format?: string;
}

interface LoadedSetup {
	p1Name: ID;
	p2Name: ID;
	p1Team: string;
	p2Team: string;
	format: string;
	initialState: BattleInitialState;
}

function readTeam(configDir: string, side: SimplifiedSideConfig): string {
	const teamPath = path.resolve(configDir, side.team);
	const text = readFileSync(teamPath, 'utf8');
	const parsed = Teams.import(text);
	if (!parsed?.length) {
		throw new Error(`simplified-pokemon: couldn't parse team sheet for ${side.name} (${teamPath})`);
	}
	return Teams.pack(parsed);
}

function loadSetup(): LoadedSetup | null {
	const configPath = process.env.SIMPLIFIED_BATTLE_CONFIG;
	if (!configPath) return null;

	const resolvedPath = path.resolve(configPath);
	const configDir = path.dirname(resolvedPath);
	const config: SimplifiedBattleConfig = JSON.parse(readFileSync(resolvedPath, 'utf8'));

	if (!config.p1?.name || !config.p2?.name) {
		throw new Error('simplified-pokemon: config must have p1.name and p2.name');
	}

	return {
		p1Name: toID(config.p1.name),
		p2Name: toID(config.p2.name),
		p1Team: readTeam(configDir, config.p1),
		p2Team: readTeam(configDir, config.p2),
		format: config.format || 'gen9customgame@@@!Team Preview',
		initialState: {
			turn: config.turn,
			p1: { active: config.p1.active, pokemon: config.p1.pokemon },
			p2: { active: config.p2.active, pokemon: config.p2.pokemon },
		},
	};
}

export const setup: LoadedSetup | null = (() => {
	try {
		return loadSetup();
	} catch (err: any) {
		Monitor.crashlog(err, 'simplified-pokemon setup');
		return null;
	}
})();

const connectedUsers = new Map<ID, User>();
let battleCreated = false;

function announceStartup() {
	if (!setup) return;

	console.log(
		`\n[simplified-pokemon] Battle ready to be created for "${setup.p1Name}" and "${setup.p2Name}".\n` +
		`[simplified-pokemon] Connect to ws://localhost:${Config.port}/showdown/websocket ` +
		`(or the client pointed at this server) and log in as either name - no password needed.\n`
	);
}

function maybeCreateBattle() {
	if (!setup || battleCreated) return;
	const p1 = connectedUsers.get(setup.p1Name);
	const p2 = connectedUsers.get(setup.p2Name);
	if (!p1 || !p2) return;

	battleCreated = true;
	const room = Rooms.createBattle({
		format: setup.format,
		players: [
			{ user: p1, team: setup.p1Team },
			{ user: p2, team: setup.p2Team },
		],
		rated: false,
		initialState: setup.initialState,
	});
	if (!room) {
		battleCreated = false;
		return;
	}
	p1.joinRoom(room);
	p2.joinRoom(room);

	console.log(`[simplified-pokemon] Created battle room "${room.roomid}" for ${p1.name} and ${p2.name}.`);
}

announceStartup();

export const handlers: Chat.Handlers = {
	onRename(user, oldID, newID) {
		if (!setup || battleCreated) return;
		if (newID === setup.p1Name || newID === setup.p2Name) {
			connectedUsers.set(newID, user);
			// `user.name` is still mid-update at this point in the rename flow (it finishes
			// synchronously right after this handler returns), so defer a tick to avoid
			// racing it - otherwise the battle room can be created with a stale display name.
			setImmediate(maybeCreateBattle);
		}
	},
};
