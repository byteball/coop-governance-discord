const { expect } = require('chai');

const { treatResponseFromGovernanceAA, getValueKey } = require('../lib/governance_events');

const GOV_AA = 'GOVAAGOVAAGOVAAGOVAAGOVAAGOVAAGO';
const MAIN_AA = 'COOPCOOPCOOPCOOPCOOPCOOPCOOPCOOP';
const VOTER = 'VOTERVOTERVOTERVOTERVOTERVOTERVO';
const DECIMALS = 9;

// Minimal fake of aabot/dag.js backed by plain maps, injected via the deps arg.
// Mirrors the real contract: readJoint THROWS for an unknown unit (aabot retries
// then throws 'unit not found'), it never resolves with null.
//   joints: { [unit]: triggerUnitObject }
//   vars:   { [aaAddress]: { [stateVarKey]: value } }
// Every readAAStateVar key is recorded in dag.reads for assertions.
function makeDag({ joints = {}, vars = {} } = {}) {
	const dag = {
		reads: [],
		readJoint: async (unit) => {
			if (!joints[unit])
				throw Error('unit not found: ' + unit);
			return { unit: joints[unit] };
		},
		readAAStateVar: async (address, key) => {
			dag.reads.push(address + '/' + key);
			const bucket = vars[address] || {};
			return key in bucket ? bucket[key] : undefined;
		},
	};
	return dag;
}

// Build a trigger joint whose single data message carries `data`.
function dataJoint(unit, data) {
	return {
		[unit]: {
			messages: [
				{ app: 'payment', payload: { outputs: [] } },
				{ app: 'data', payload: data },
			],
		},
	};
}

function response(unit, extra = {}) {
	return {
		aa_address: GOV_AA,
		trigger_address: VOTER,
		trigger_unit: unit,
		...extra,
	};
}

describe('treatResponseFromGovernanceAA', () => {
	it('builds an "added_support" event with leader, support and the voter\'s added VP', async () => {
		const unit = 'TRIG_ADD';
		const dag = makeDag({
			joints: dataJoint(unit, { name: 'daily_locked_reward', value: 0.02 }),
			vars: {
				[GOV_AA]: {
					'leader_daily_locked_reward': 0.01,
					// leader has sqrt(400 COOP) staked -> VP 20
					'support_daily_locked_reward_0.01': Math.sqrt(400e9),
					// current value being supported has sqrt(100 COOP) -> VP 10
					'support_daily_locked_reward_0.02': Math.sqrt(100e9),
				},
				[MAIN_AA]: {
					['user_' + VOTER]: { total_balance: 100e9 }, // 100 COOP -> adds VP 10
				},
			},
		});

		const event = await treatResponseFromGovernanceAA(response(unit), DECIMALS, MAIN_AA, { DAG: dag });

		expect(event.type).to.equal('added_support');
		expect(event.name).to.equal('daily_locked_reward');
		expect(event.value).to.equal(0.02);
		expect(event.leader_value).to.equal(0.01);
		expect(event.leader_support).to.be.closeTo(20, 1e-6);
		expect(event.support).to.be.closeTo(10, 1e-6);
		expect(event.added_support).to.be.closeTo(10, 1e-6);
		// passthrough identifiers
		expect(event.aa_address).to.equal(GOV_AA);
		expect(event.trigger_address).to.equal(VOTER);
		expect(event.trigger_unit).to.equal(unit);
	});

	it('reads the support var only once when the supported value IS the leader', async () => {
		const unit = 'TRIG_SAME';
		const dag = makeDag({
			joints: dataJoint(unit, { name: 'daily_locked_reward', value: 0.02 }),
			vars: {
				[GOV_AA]: {
					'leader_daily_locked_reward': 0.02,
					'support_daily_locked_reward_0.02': Math.sqrt(100e9),
				},
				[MAIN_AA]: {
					['user_' + VOTER]: { total_balance: 100e9 },
				},
			},
		});

		const event = await treatResponseFromGovernanceAA(response(unit), DECIMALS, MAIN_AA, { DAG: dag });

		expect(event.support).to.equal(event.leader_support);
		const supportReads = dag.reads.filter((k) => k.includes('support_daily_locked_reward_0.02'));
		expect(supportReads.length).to.equal(1);
	});

	it('reads support under the hashed key when the value is a long attestor list', async () => {
		const unit = 'TRIG_ATTESTORS';
		const longValue = Array(5).fill('WMFLGI2GLAB2MDF2KQAH37VNRRMK7A5N').join(':');
		const valueKey = getValueKey(longValue); // 'hash_...'
		expect(valueKey.startsWith('hash_')).to.equal(true);

		const dag = makeDag({
			joints: dataJoint(unit, { name: 'messaging_attestors', value: longValue }),
			vars: {
				[GOV_AA]: {
					'leader_messaging_attestors': longValue,
					['support_messaging_attestors_' + valueKey]: Math.sqrt(100e9),
				},
				[MAIN_AA]: {
					['user_' + VOTER]: { total_balance: 100e9 },
				},
			},
		});

		const event = await treatResponseFromGovernanceAA(response(unit), DECIMALS, MAIN_AA, { DAG: dag });

		expect(event.type).to.equal('added_support');
		// support resolved via the hashed key (would be 0 if the raw value were used)
		expect(event.support).to.be.closeTo(10, 1e-6);
		expect(event.leader_support).to.be.closeTo(10, 1e-6);
	});

	it('builds a "removed_support" event when no value is present', async () => {
		const unit = 'TRIG_REMOVE';
		const dag = makeDag({
			joints: dataJoint(unit, { name: 'by_votes_share' }),
			vars: {
				[GOV_AA]: {
					'leader_by_votes_share': 0.5,
					'support_by_votes_share_0.5': Math.sqrt(900e9), // VP 30
				},
			},
		});

		const event = await treatResponseFromGovernanceAA(response(unit), DECIMALS, MAIN_AA, { DAG: dag });

		expect(event.type).to.equal('removed_support');
		expect(event.name).to.equal('by_votes_share');
		expect(event.leader_value).to.equal(0.5);
		expect(event.leader_support).to.be.closeTo(30, 1e-6);
		expect(event).to.not.have.property('value');
		expect(event).to.not.have.property('added_support');
	});

	it('treats value:null like a removal, matching the AA\'s exists() semantics', async () => {
		const unit = 'TRIG_NULL';
		const dag = makeDag({
			joints: dataJoint(unit, { name: 'by_votes_share', value: null }),
			vars: {
				[GOV_AA]: {
					'leader_by_votes_share': 0.5,
					'support_by_votes_share_0.5': Math.sqrt(900e9),
				},
			},
		});

		const event = await treatResponseFromGovernanceAA(response(unit), DECIMALS, MAIN_AA, { DAG: dag });

		expect(event.type).to.equal('removed_support');
		expect(event).to.not.have.property('value');
	});

	it('handles removal on a param nobody ever voted on: no leader, no bogus support read', async () => {
		const unit = 'TRIG_NOLEADER';
		const dag = makeDag({
			joints: dataJoint(unit, { name: 'bytes_reducer' }),
			vars: { [GOV_AA]: {} }, // no leader_ var at all
		});

		const event = await treatResponseFromGovernanceAA(response(unit), DECIMALS, MAIN_AA, { DAG: dag });

		expect(event.type).to.equal('removed_support');
		expect(event.leader_value).to.equal(undefined);
		expect(event.leader_support).to.equal(0);
		// must not construct a 'support_bytes_reducer_undefined' key
		const bogusReads = dag.reads.filter((k) => k.includes('undefined'));
		expect(bogusReads).to.deep.equal([]);
	});

	it('builds a "commit" event from the committed value', async () => {
		const unit = 'TRIG_COMMIT';
		const dag = makeDag({
			joints: dataJoint(unit, { name: 'referral_reward', commit: 1 }),
			vars: {
				[GOV_AA]: {
					'referral_reward': 20e9, // committed value (var[name])
				},
			},
		});

		const event = await treatResponseFromGovernanceAA(response(unit), DECIMALS, MAIN_AA, { DAG: dag });

		expect(event.type).to.equal('commit');
		expect(event.name).to.equal('referral_reward');
		expect(event.value).to.equal(20e9);
		expect(event).to.not.have.property('leader_value');
	});

	it('returns a typeless event for non-governance responses (no data.name)', async () => {
		const unit = 'TRIG_OTHER';
		const dag = makeDag({ joints: dataJoint(unit, { deposit: 1 }) });

		const event = await treatResponseFromGovernanceAA(response(unit), DECIMALS, MAIN_AA, { DAG: dag });

		expect(event).to.not.have.property('type');
		expect(event.aa_address).to.equal(GOV_AA);
		expect(event.trigger_unit).to.equal(unit);
	});

	it('treats a missing/withdrawn voter as zero added VP', async () => {
		const unit = 'TRIG_NOUSER';
		const dag = makeDag({
			joints: dataJoint(unit, { name: 'daily_locked_reward', value: 0.02 }),
			vars: {
				[GOV_AA]: {
					'leader_daily_locked_reward': 0.02,
					'support_daily_locked_reward_0.02': Math.sqrt(100e9),
				},
				[MAIN_AA]: {}, // no user_ record
			},
		});

		const event = await treatResponseFromGovernanceAA(response(unit), DECIMALS, MAIN_AA, { DAG: dag });

		expect(event.type).to.equal('added_support');
		expect(event.added_support).to.equal(0);
	});

	it('propagates the DAG error when the trigger unit cannot be fetched', async () => {
		const dag = makeDag({ joints: {} });
		let threw = false;
		try {
			await treatResponseFromGovernanceAA(response('MISSING'), DECIMALS, MAIN_AA, { DAG: dag });
		} catch (e) {
			threw = true;
			expect(e.message).to.contain('unit not found');
		}
		expect(threw).to.equal(true);
	});
});
