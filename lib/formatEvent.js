const { formatParamValue } = require('../utils/formatParamValue');

const SPACER = { name: '​', value: '​', inline: true };
const EMBED_COLOR = '#0099ff';

// Build a plain, framework-agnostic description of the Discord embed for a
// governance event. Kept free of discord.js / ocore so it can be unit-tested in
// isolation; `governance_discord.js` turns this into a real MessageEmbed.
//
// opts: { coopName, url, explorerUrl, decimals, symbol }
function buildEmbedData(event, opts) {
	const { coopName, url, explorerUrl, decimals = 9, symbol = 'COOP' } = opts;
	const fmt = (value) => formatParamValue(event.name, value, decimals, symbol);

	const description = '[View at ' + coopName + '](' + url + ')\n\n' + event.trigger_address;

	// a param nobody ever voted on has no leader yet — skip the fields entirely
	const leaderFields = () => event.leader_value === undefined ? [] : [
		{ name: 'Leader value', value: fmt(event.leader_value), inline: true },
		{ name: 'Support', value: event.leader_support + ' votes', inline: true },
		SPACER,
	];

	let embed = { color: EMBED_COLOR, fields: [] };

	switch (event.type) {
		case 'added_support':
			embed.title = 'Support added in ' + coopName;
			embed.description = description + ' adds ' + event.added_support + ' votes'
				+ ' in support of value `' + fmt(event.value) + '` of parameter `' + event.name + '`';
			embed.fields = [
				{ name: 'Value', value: fmt(event.value), inline: true },
				{ name: 'Support', value: event.support + ' votes', inline: true },
				SPACER,
				...leaderFields(),
			];
			break;
		case 'removed_support':
			embed.title = 'Support removed in ' + coopName;
			embed.description = description + ' removes its vote on parameter `' + event.name + '`';
			embed.fields = leaderFields();
			break;
		case 'commit':
			embed.title = 'New value committed in ' + coopName;
			embed.description = description + ' has committed value `' + fmt(event.value)
				+ '` for parameter `' + event.name + '`';
			embed.fields = [
				{ name: 'Parameter', value: event.name, inline: true },
				{ name: 'Value', value: fmt(event.value), inline: true },
				SPACER,
			];
			break;
		default:
			return null; // nothing worth announcing
	}

	embed.fields.push({
		name: 'Trigger unit',
		value: '[' + event.trigger_unit + '](' + explorerUrl + ')',
	});

	return embed;
}

exports.buildEmbedData = buildEmbedData;
exports.EMBED_COLOR = EMBED_COLOR;
