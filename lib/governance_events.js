const crypto = require('crypto');

const { getVPBySqrtBalance } = require('../utils/getVpBySqrtBalance');
const { getVPByBalance } = require('../utils/getVpByBalance');

// The COOP governance AA (`governance.oscript`) derives the storage key of a
// supported value the same way: short values are used verbatim, long ones
// (only the attestor lists can grow past the limit) are hashed.
function getValueKey(value) {
	const str = String(value);
	return ('support_messaging_attestors_' + str).length > 128
		? 'hash_' + crypto.createHash('sha256').update(str, 'utf8').digest('base64')
		: str;
}

// Read the first `data` message of a unit — the AA only ever looks at that one.
function getTriggerUnitData(objTriggerUnit) {
	for (var i = 0; i < objTriggerUnit.messages.length; i++)
		if (objTriggerUnit.messages[i].app === 'data')
			return objTriggerUnit.messages[i].payload;
	return {};
}

// Translate a raw aa_response from the COOP governance AA into a normalized
// event object the Discord layer can render. Returns an object whose `.type` is
// one of "added_support" | "removed_support" | "commit", or has no `.type` when
// the response isn't a governance action worth announcing.
//
// `deps` lets tests inject a fake DAG; production passes nothing and the real
// `aabot/dag.js` is loaded lazily (so this module stays requireable without a
// full ocore install, e.g. in unit tests).
async function treatResponseFromGovernanceAA(objResponse, decimals, main_aa, deps) {
	const DAG = (deps && deps.DAG) || require('aabot/dag.js');

	// readJoint rejects (after a light-vendor retry) if the unit can't be fetched
	const objTriggerJoint = await DAG.readJoint(objResponse.trigger_unit);
	const objTriggerUnit = objTriggerJoint.unit;
	const data = getTriggerUnitData(objTriggerUnit);
	const governanceAAAddress = objResponse.aa_address;

	let event = {
		aa_address: governanceAAAddress,
		trigger_address: objResponse.trigger_address,
		trigger_unit: objResponse.trigger_unit,
	};

	if (!data.name)
		return event;

	event.name = data.name;
	const name = data.name; // COOP governance has no per-asset suffix, the name is the full key

	if (data.commit) {
		event.type = 'commit';
		event.value = await DAG.readAAStateVar(governanceAAAddress, name);
		return event;
	}

	// support added or removed: surface the current leader either way; a param
	// nobody ever voted on has no leader_ var yet
	event.leader_value = await DAG.readAAStateVar(governanceAAAddress, 'leader_' + name);
	const bHasLeader = event.leader_value !== undefined;
	const leaderKey = bHasLeader ? getValueKey(event.leader_value) : null;
	const readSupport = (key) => DAG.readAAStateVar(governanceAAAddress, 'support_' + name + '_' + key);
	const toVP = (sqrtBalance) => +getVPBySqrtBalance(sqrtBalance, decimals).toPrecision(9);

	// the AA's exists() treats null like undefined: no value means the vote is removed
	if (data.value === undefined || data.value === null) {
		event.type = 'removed_support';
		event.leader_support = bHasLeader ? toVP(await readSupport(leaderKey)) : 0;
		return event;
	}

	event.type = 'added_support';
	event.value = data.value;
	const valueKey = getValueKey(data.value);

	// the three reads are independent — go to the hub in parallel; when the
	// supported value IS the leader, its support var is read only once
	const [leaderSupportInSqrtBalance, user, currentSupportInSqrtBalance] = await Promise.all([
		bHasLeader ? readSupport(leaderKey) : 0,
		DAG.readAAStateVar(main_aa, 'user_' + objResponse.trigger_address),
		valueKey === leaderKey ? undefined : readSupport(valueKey),
	]);

	// total_balance already folds in the locked-bytes contribution (via the AA's
	// ceiling price and bytes_reducer), so it's the right basis for voting power.
	const userBalanceInCoop = (user && user.total_balance) || 0;

	event.leader_support = toVP(leaderSupportInSqrtBalance);
	event.added_support = +getVPByBalance(userBalanceInCoop, decimals).toPrecision(9);
	event.support = (valueKey === leaderKey) ? event.leader_support : toVP(currentSupportInSqrtBalance);

	return event;
}

exports.treatResponseFromGovernanceAA = treatResponseFromGovernanceAA;
exports.getValueKey = getValueKey;
exports.getTriggerUnitData = getTriggerUnitData;
