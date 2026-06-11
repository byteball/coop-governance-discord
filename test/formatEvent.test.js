const { expect } = require('chai');

const { buildEmbedData, EMBED_COLOR } = require('../lib/formatEvent');

const COOP_NAME = 'Obyte COOP';
const URL = 'https://coop.obyte.org/governance';
const EXPLORER = 'https://explorer.obyte.org/UNIT123';
const VOTER = 'VOTERVOTERVOTERVOTERVOTERVOTERVO';

const baseOpts = { coopName: COOP_NAME, url: URL, explorerUrl: EXPLORER, decimals: 9, symbol: 'COOP' };

function field(embed, name) {
	return embed.fields.find((f) => f.name === name);
}

describe('buildEmbedData', () => {
	it('formats an added_support event', () => {
		const event = {
			type: 'added_support',
			name: 'daily_locked_reward',
			value: 0.02,
			support: 10,
			added_support: 10,
			leader_value: 0.01,
			leader_support: 20,
			trigger_address: VOTER,
			trigger_unit: 'UNIT123',
		};

		const embed = buildEmbedData(event, baseOpts);

		expect(embed.color).to.equal(EMBED_COLOR);
		expect(embed.title).to.equal('Support added in Obyte COOP');
		expect(embed.description).to.contain('adds 10 votes');
		// value rendered as a percentage via the COOP param formatter
		expect(embed.description).to.contain('`2%`');
		expect(embed.description).to.contain('`daily_locked_reward`');
		expect(embed.description).to.contain(VOTER);
		expect(embed.description).to.contain('[View at Obyte COOP](' + URL + ')');

		expect(field(embed, 'Value').value).to.equal('2%');
		expect(field(embed, 'Support').value).to.equal('10 votes');
		expect(field(embed, 'Leader value').value).to.equal('1%');
		// "Support" appears twice (current + leader); just ensure both render votes
		expect(embed.fields.filter((f) => f.name === 'Support').map((f) => f.value)).to.deep.equal(['10 votes', '20 votes']);
		expect(field(embed, 'Trigger unit').value).to.equal('[UNIT123](' + EXPLORER + ')');
	});

	it('formats a removed_support event with only leader info', () => {
		const event = {
			type: 'removed_support',
			name: 'by_votes_share',
			leader_value: 0.5,
			leader_support: 30,
			trigger_address: VOTER,
			trigger_unit: 'UNIT123',
		};

		const embed = buildEmbedData(event, baseOpts);

		expect(embed.title).to.equal('Support removed in Obyte COOP');
		expect(embed.description).to.contain('removes its vote on parameter `by_votes_share`');
		expect(field(embed, 'Leader value').value).to.equal('50%');
		expect(field(embed, 'Support').value).to.equal('30 votes');
		expect(field(embed, 'Value')).to.equal(undefined);
		expect(field(embed, 'Trigger unit')).to.not.equal(undefined);
	});

	it('formats a commit event with the COOP-denominated value', () => {
		const event = {
			type: 'commit',
			name: 'referral_reward',
			value: 20e9,
			trigger_address: VOTER,
			trigger_unit: 'UNIT123',
		};

		const embed = buildEmbedData(event, baseOpts);

		expect(embed.title).to.equal('New value committed in Obyte COOP');
		expect(embed.description).to.contain('has committed value `20 COOP`');
		expect(field(embed, 'Parameter').value).to.equal('referral_reward');
		expect(field(embed, 'Value').value).to.equal('20 COOP');
	});

	it('omits leader fields (and never prints "undefined") when no leader exists yet', () => {
		const event = {
			type: 'removed_support',
			name: 'bytes_reducer',
			leader_value: undefined,
			leader_support: 0,
			trigger_address: VOTER,
			trigger_unit: 'UNIT123',
		};

		const embed = buildEmbedData(event, baseOpts);

		expect(field(embed, 'Leader value')).to.equal(undefined);
		expect(JSON.stringify(embed)).to.not.contain('undefined');
		// only the trigger-unit field remains
		expect(embed.fields.length).to.equal(1);
		expect(field(embed, 'Trigger unit')).to.not.equal(undefined);
	});

	it('respects a custom symbol for testnet tokens', () => {
		const event = {
			type: 'commit', name: 'referral_reward', value: 20e9,
			trigger_address: VOTER, trigger_unit: 'UNIT123',
		};
		const embed = buildEmbedData(event, { ...baseOpts, symbol: 'tCOOP' });
		expect(field(embed, 'Value').value).to.equal('20 tCOOP');
	});

	it('returns null for an event with no recognized type', () => {
		expect(buildEmbedData({ trigger_unit: 'X' }, baseOpts)).to.equal(null);
	});
});
