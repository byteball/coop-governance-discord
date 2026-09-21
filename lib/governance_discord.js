const { Client, EmbedBuilder, GatewayIntentBits, ActivityType, Events } = require('discord.js');
const conf = require('ocore/conf.js');

const { buildEmbedData } = require('./formatEvent');
const { logEvent } = require('./eventLog');
const wait = require('../utils/wait');

// fail fast on missing configuration at load time, before any network activity
if (!conf.discord_token)
	throw Error("discord_token missing in conf");
if (!conf.discord_channels || !conf.discord_channels.length)
	throw Error("channel missing in conf");

var discordClient = null;

async function initDiscord() {
	if (discordClient)
		return discordClient;
	discordClient = new Client({ intents: [GatewayIntentBits.Guilds] });
	discordClient.on(Events.ClientReady, () => {
		console.log(`Logged in Discord as ${discordClient.user.tag}!`);
		setBotActivity();
	});
	discordClient.on(Events.Error, (error) => {
		console.error(`Discord error: ${error}`);
	});
	await discordClient.login(conf.discord_token);
	return discordClient;
}

function setBotActivity(prefix) {
	prefix = prefix ? (prefix + " ") : "";
	if (discordClient && discordClient.user)
		discordClient.user.setActivity(prefix + "COOP governance", { type: ActivityType.Watching });
}

function announceEvent(coopName, url, event, opts) {
	opts = opts || {};
	const explorerUrl = opts.fullExplorerURL || (conf.explorer_base_url + event.trigger_unit);

	const embedData = buildEmbedData(event, {
		coopName,
		url,
		explorerUrl,
		decimals: opts.decimals,
		symbol: opts.symbol,
	});
	if (!embedData)
		return console.log('no embed built for event: ', event);

	const embed = new EmbedBuilder()
		.setColor(embedData.color)
		.setTitle(embedData.title)
		.setDescription(embedData.description)
		.addFields(embedData.fields);

	return sendToDiscord(embed, event);
}

const RETRY_DELAY_MS = 5000;

async function sendToChannel(channelId, embed) {
	const channel = await discordClient.channels.fetch(channelId);
	await channel.send({ embeds: [embed] });
}

async function sendToDiscord(embed, event) {
	if (!discordClient)
		return logEvent(event, 'skipped: discord client not initialized');
	if (process.env.mute)
		return logEvent(event, 'muted');
	for (const channelId of conf.discord_channels) {
		try {
			await sendToChannel(channelId, embed);
			logEvent(event, 'sent', channelId);
			continue;
		} catch (error) {
			logEvent(event, 'failed: ' + error + ', retrying in ' + RETRY_DELAY_MS + 'ms', channelId);
		}
		await wait(RETRY_DELAY_MS);
		
		try {
			await sendToChannel(channelId, embed);
			logEvent(event, 'sent on retry', channelId);
		} catch (error) {
			await logEvent(event, 'failed on retry: ' + error, channelId);
			console.error('fatal: could not deliver event to Discord channel ' + channelId + ' after retry, exiting');
			process.exit(1);
		}
	}
}

exports.initDiscord = initDiscord;
exports.setBotActivity = setBotActivity;
exports.announceEvent = announceEvent;
