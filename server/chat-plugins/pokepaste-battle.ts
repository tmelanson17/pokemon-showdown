import { FS } from '../../lib/fs';

const pokepasteBattles = new Set<RoomID>();
/**
 * PokePaste Battle
 * Pokemon Showdown - http://pokemonshowdown.com/
 *
 * Creates a battle room directly between two online users, loading each
 * side's team from a PokePaste URL instead of going through the normal
 * ladder/challenge team-validation flow.
 *
 * @license MIT
 */

async function fetchPokePasteTeam(url: string): Promise<PokemonSet[]> {
	let rawUrl = url.trim();
	if (!/^https?:\/\/pokepast\.es\//.test(rawUrl)) {
		throw new Chat.ErrorMessage(`"${url}" doesn't look like a PokePaste URL.`);
	}
	rawUrl = rawUrl.replace(/\/raw\/?$/, '').replace(/\/$/, '') + '/raw';

	let res;
	try {
		res = await fetch(rawUrl);
	} catch (e: any) {
		throw new Chat.ErrorMessage(`Failed to fetch ${url}: ${e.message}`);
	}
	if (!res.ok) {
		throw new Chat.ErrorMessage(`Failed to fetch ${url} (HTTP ${res.status}).`);
	}
	const text = await res.text();
	const team = Teams.import(text);
	if (!team || !team.length) {
		throw new Chat.ErrorMessage(`Could not parse a team from ${url}.`);
	}
	// Ignore whatever level the paste specifies (or defaults to, e.g. Teams.import
	// falls back to 100 if a set's `Level:` line wasn't parsed) - these battles are
	// always level 50.
	for (const set of team) set.level = 50;
	return team;
}

export const commands: Chat.ChatCommands = {
	async pokepastebattle(target, room, user, connection) {
		const parts = target.split(',').map(s => s.trim());
		if (parts.length !== 5) {
			throw new Chat.ErrorMessage(
				`Usage: /pokepastebattle format, name1, pokepasteurl1, name2, pokepasteurl2`
			);
		}
		const [formatid, name1, paste1, name2, paste2] = parts;

		const format = Dex.formats.get(formatid);
		if (format.effectType !== 'Format' || !format.id) {
			throw new Chat.ErrorMessage(`"${formatid}" is not a valid format.`);
		}

		const user1 = Users.get(name1);
		const user2 = Users.get(name2);
		if (!user1) throw new Chat.ErrorMessage(`User "${name1}" not found (they must be online).`);
		if (!user2) throw new Chat.ErrorMessage(`User "${name2}" not found (they must be online).`);
		if (user1 === user2) throw new Chat.ErrorMessage(`The two players must be different users.`);

		// Self-service: the command runner must be one of the two players.
		// (No `checkCan` gate here, unlike a production deployment of this command,
		// since this is meant to be usable without an admin account.)
		if (user.id !== user1.id && user.id !== user2.id) {
			throw new Chat.ErrorMessage(`You must be one of the two players (${name1} or ${name2}) to use this.`);
		}

		this.sendReply(`Fetching teams from PokePaste...`);
		const [team1, team2] = await Promise.all([
			fetchPokePasteTeam(paste1),
			fetchPokePasteTeam(paste2),
		]);

		const battleRoom = Rooms.createBattle({
			format: format.id,
			players: [
				{ user: user1, team: Teams.pack(team1), rating: 0 },
				{ user: user2, team: Teams.pack(team2), rating: 0 },
			],
			rated: 0,
		});
		if (!battleRoom) {
			throw new Chat.ErrorMessage(`Failed to create battle room.`);
		}
		pokepasteBattles.add(battleRoom.roomid);

		this.sendReply(`Created battle: ${battleRoom.roomid}`);
		user1.popup(`|html|A battle has been created for you: <a href="/${battleRoom.roomid}">${battleRoom.roomid}</a>`);
		user2.popup(`|html|A battle has been created for you: <a href="/${battleRoom.roomid}">${battleRoom.roomid}</a>`);
	},
	pokepastebattlehelp: [
		`/pokepastebattle format, name1, pokepasteurl1, name2, pokepasteurl2 - Creates a battle between two online users using teams loaded from PokePaste. Requires: & ~`,
	],
};

export const handlers: Chat.Handlers = {
	onBattleEnd(battle, winner, players) {
		const roomid = battle.room.roomid;
		if (!pokepasteBattles.has(roomid)) return;
		pokepasteBattles.delete(roomid);

		const log = battle.room.getLog(-1);
		void (async () => {
			await FS('logs/pokepastebattle').mkdirp();
			await FS(`logs/pokepastebattle/${roomid}.log.txt`).write(log);
		})();
	},
};
