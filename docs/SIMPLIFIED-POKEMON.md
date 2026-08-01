# Simplified Pokemon: custom-state 2-player battles

This fork adds a way to boot the real Showdown server with a battle
already set up from two team sheets and a custom starting state (turn
number, each Pokemon's HP/status, and which are active vs. benched),
so two people can log in and play it out as normal Showdown battle
participants.

## How it works

1. You provide two team sheets in standard Showdown export/paste format,
   and a JSON config describing the starting state and the two usernames.
2. You start the server with `SIMPLIFIED_BATTLE_CONFIG` pointing at that
   JSON file. The server prints the two usernames and how to connect.
3. Each person opens a Showdown client pointed at this server and logs in
   as their assigned username (see "Connecting", below - no account or
   password needed).
4. As soon as **both** usernames are online, the server automatically
   creates the battle, seeds it with the configured state, and joins both
   players into the battle room.

This is a one-shot setup: it applies once, when the battle is created. It
does not describe a live/spectator view of an in-progress battle.

## Config file format

```json
{
	"turn": 5,
	"p1": {
		"name": "PlayerOne",
		"team": "team1.txt",
		"active": [0],
		"pokemon": [
			{ "slot": 0, "hp": 120, "status": "brn" }
		]
	},
	"p2": {
		"name": "PlayerTwo",
		"team": "team2.txt",
		"active": [0],
		"pokemon": [
			{ "slot": 1, "hp": 0 }
		]
	}
}
```

- `turn` (optional): the turn counter to start from. Omit to just start
  at turn 1 normally.
- `p1` / `p2`:
  - `name`: the username this player will log in as.
  - `team`: path to that side's team sheet, relative to the config file.
    Standard Showdown export/paste format (what you get from "Export" in
    the team builder, or `/showteam` in-game).
  - `active`: 0-based indices into that side's team (in the order the
    team sheet lists them), for the Pokemon that start on the field. List
    order is field-position order (matters for doubles/etc.).
  - `pokemon` (optional): per-Pokemon overrides, by the same 0-based
    `slot` index:
    - `hp` (optional): exact HP points, clamped to that Pokemon's max HP.
      `0` marks it fainted. Omit to leave a Pokemon at full HP.
    - `status` (optional): one of `brn`, `par`, `psn`, `tox`, `slp`,
      `frz`, or `''`. Applied regardless of normal type/ability immunity,
      since this is meant to recreate an exact snapshot. Sleep/toxic
      counters get the game's normal default duration, not a specific
      remaining-turn count.
    - Pokemon not listed keep full HP and no status.

`format` (optional): override the base format string. Defaults to
`gen9customgame@@@!Team Preview` (no legality checks, and Team Preview
stripped out so the pre-set leads take effect immediately instead of
asking players to pick their lead).

**Note on entry hazards/abilities:** the configured leads are sent out
through the normal switch-in process, so things like Stealth Rock,
Intimidate, or weather-setting abilities will fire as usual on the first
switch-in. If you're recreating a snapshot where hazards were already in
play, account for that in the `hp` you specify.

## Running it

```sh
SIMPLIFIED_BATTLE_CONFIG=examples/simplified-pokemon/battle-setup.json npm start
```

The server prints something like:

```
[simplified-pokemon] Battle ready to be created for "playerone" and "playertwo".
[simplified-pokemon] Connect to ws://localhost:8000/showdown/websocket (or the client pointed at this server) and log in as either name - no password needed.
```

## Connecting

This server runs with `noguestsecurity = true` (see `config/config.js`),
which is meant for local/dev servers with no login server backing it:
anyone can claim any unregistered name without a password. So each
player just needs to:

1. Open a Showdown client (e.g. the public client at
   `play.pokemonshowdown.com`, which lets you point it at a custom
   server, or run your own copy of the client) pointed at this server's
   address/port.
2. Log in / rename to the exact username from the config (`p1.name` or
   `p2.name`).

Once both are connected, the battle room is created automatically and
both players are joined into it.

## Example

See `examples/simplified-pokemon/` for a runnable example: two 2-Pokemon
teams, and a state config where player one leads with a burned, damaged
Pikachu (Charizard full-HP on the bench), and player two leads with a
full-HP Snorlax while their Gengar starts already fainted on the bench,
at turn 5.
