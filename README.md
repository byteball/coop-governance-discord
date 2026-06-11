# Obyte COOP Governance Discord bot

Watches the [Obyte COOP](https://coop.obyte.org) governance AA and posts a
notification to Discord whenever something happens:

- **Support added** — a member votes for a value of a governable parameter
- **Support removed** — a member withdraws their vote
- **New value committed** — a leader value is committed after the 3-day
  challenging period

Each notification shows the parameter, the (human-readable) value, the voter's
added voting power, the total support for that value, and the current leader.

This is the COOP counterpart of
[`friend-governance-discord`](https://github.com/byteball/friend-governance-discord)
and follows the same structure.

## How it works

1. On startup the bot reads the COOP main AA's `constants` state var to discover
   the governance AA address, the COOP token asset, and (via the token registry)
   its symbol and decimals.
2. It watches the governance AA and listens for `aa_response` events from it.
3. `lib/governance_events.js` turns each raw response into a normalized event by
   reading the relevant governance state vars (`leader_<name>`,
   `support_<name>_<value>`, the committed `<name>`, and the voter's
   `user_<address>` balance on the main AA).
4. `lib/formatEvent.js` renders that event into a Discord embed (values are
   formatted exactly like the web app: shares as `%`, amounts as `COOP`,
   attestor lists as truncated addresses), and `lib/governance_discord.js` posts
   it.

Voting power matches the AA's weighting: support is stored as a sum of
`sqrt(total_balance)`, so the displayed votes are `sqrt(balance in COOP)`.

## Setup

Requires Node.js >= 18 (discord.js v14).

- `npm install`
- Run once with `npm start`; it creates an app-data directory under
  `~/.config/coop-governance-discord` and then exits because the configuration
  is missing.
- While logged into the Discord web app, create an application at
  https://discord.com/developers/applications
- Select the application → **Bot** in the menu → copy the bot token.
- Copy `.env.sample` to `.env` and fill in the bot token and the channel id the
  bot will post to (enable Developer Mode in Discord, then right-click the
  channel → **Copy ID**).
- Add the bot to your server with (replace `client_id` with your application's
  ID, found under General Information; permission `2048` allows only posting
  messages):
  `https://discord.com/oauth2/authorize?client_id=YOUR_APP_ID&scope=bot&permissions=2048`
- Run the bot with `npm start`.

## Configuration (`.env`)

| Variable | Description |
| --- | --- |
| `discord_token` | Discord bot token (required) |
| `channel` | Discord channel id(s) to post to, comma-separated (required) |
| `testnet` | `1`/`true`/`yes` for testnet, anything else for mainnet |
| `coop_aa` | COOP main AA address (a testnet default is used when `testnet=1`) |
| `TOKEN_REGISTRY_AA_ADDRESS` | Token registry AA, for symbol/decimals lookup |
| `coop_decimals` | Fallback decimals if the token isn't registered yet (default `9`) |
| `coop_url` | Web app the notifications link to (default `https://coop.obyte.org`) |
| `coop_name` | Display name in notifications (default `Obyte COOP`) |

Set `mute=1` in the environment to log messages instead of posting them
(useful while testing).

Every announced event is appended to `events.log` in the app data directory
(`~/Library/Application Support/coop-governance-discord/` on macOS,
`~/.config/coop-governance-discord/` on Linux) as a tab-separated line:
timestamp, delivery status (`sent` / `muted` / `failed: ...`), channel id,
event type, parameter, value, trigger unit.

## Tests

```bash
npm test
```

Unit tests (Mocha + Chai) cover the event translation, the embed formatting, and
the voting-power / value-formatting helpers. They inject a fake DAG and never
touch the network, so they run without a hub connection. See `test/`.

## Running in production

A `check_daemon.js` + `crontab.txt` pair (same as the Friends bot) restarts the
bot if it dies. Start it with `./start` (logs stderr to `errlog`).
