// discord.js must load BEFORE aabot/ocore: ocore/storage.js freezes
// Array.prototype and String.prototype, which crashes the primordials shim of
// discord.js's @vladfrangu/async_event_emitter dependency with
// "Cannot assign to read only property 'StringPrototypeReplaceAll'"
const governanceDiscord = require('./lib/governance_discord.js');

const DAG = require('aabot/dag.js');
const conf = require('ocore/conf.js');
const network = require('ocore/network.js');
const eventBus = require('ocore/event_bus.js');
const lightWallet = require('ocore/light_wallet.js');
const walletGeneral = require('ocore/wallet_general.js');
const governanceEvents = require('./lib/governance_events.js');

const getSymbolByAsset = require('./utils/getSymbolByAsset');
const getDecimalsByAsset = require('./utils/getDecimalsByAsset');

const ignoreOldResponses = true; // if true, responses older than 24h are ignored

var assocGovernanceAAs = {}; // governance_aa -> { main_aa }
var assocCoopAAs = {};       // main_aa -> { aa_address, governance_aa, asset, decimals, symbol }

lightWallet.setLightVendorHost(conf.hub);

eventBus.once('connected', function (ws) {
	network.initWitnessesIfNecessary(ws, start);
});

async function start() {
	await governanceDiscord.initDiscord();
	if (!conf.coop_aa)
		throw Error("coop_aa missing in conf");
	await watchCoopAA(conf.coop_aa);
	lightWallet.refreshLightClientHistory();
}

eventBus.on('aa_response', async function (objResponse) {
	// ocore won't re-emit a response after a restart, so a thrown error here
	// would both crash the daemon and lose the notification forever — log instead
	try {
		if (objResponse.response.error)
			return console.log('ignored response with error: ' + objResponse.response.error);
		if (ignoreOldResponses && ((Math.ceil(Date.now() / 1000) - objResponse.timestamp) > 3 * 24 * 3600))
			return console.log('ignored old response ' + objResponse.trigger_unit);

		const govInfo = assocGovernanceAAs[objResponse.aa_address];
		if (!govInfo)
			return console.log('ignored response from unknown AA: ' + objResponse.aa_address);

		const { main_aa } = govInfo;
		const { decimals, symbol } = assocCoopAAs[main_aa];

		const event = await governanceEvents.treatResponseFromGovernanceAA(objResponse, decimals, main_aa);
		if (!event.type)
			return console.log('ignored response with no type: ', event);

		governanceDiscord.announceEvent(conf.coop_name, conf.coop_url + '/governance', event, { decimals, symbol });
	} catch (e) {
		console.error('failed to handle aa_response from trigger ' + objResponse.trigger_unit + ':', e);
	}
});

async function watchCoopAA(mainAAAddress) {
	const constants = await DAG.readAAStateVar(mainAAAddress, "constants");
	if (!constants)
		throw Error("no constants in coop AA " + mainAAAddress + " — is it deployed and defined?");

	const { asset, governance_aa } = constants;
	if (!governance_aa)
		throw Error("coop AA " + mainAAAddress + " has no governance_aa yet");

	walletGeneral.addWatchedAddress(governance_aa);

	const decimals = (await getDecimalsByAsset(asset)) ?? conf.coop_decimals;
	const symbol = await getSymbolByAsset(asset);

	assocCoopAAs[mainAAAddress] = {
		aa_address: mainAAAddress,
		governance_aa,
		asset,
		decimals,
		symbol,
	};
	assocGovernanceAAs[governance_aa] = {
		main_aa: mainAAAddress,
	};

	console.log('watching COOP governance AA ' + governance_aa + ' (token ' + symbol + ', ' + decimals + ' decimals)');
}

function handleJustsaying(ws, subject, body) {
	switch (subject) {
		case 'light/have_updates':
			lightWallet.refreshLightClientHistory();
			break;
	}
}

eventBus.on("message_for_light", handleJustsaying);

process.on('unhandledRejection', up => { throw up });
