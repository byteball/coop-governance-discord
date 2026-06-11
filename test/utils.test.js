const crypto = require('crypto');
const { expect } = require('chai');

const { getVPByBalance } = require('../utils/getVpByBalance');
const { getVPBySqrtBalance } = require('../utils/getVpBySqrtBalance');
const { getValueKey } = require('../lib/governance_events');
const { formatParamValue, truncateAddress } = require('../utils/formatParamValue');

describe('voting power conversions', () => {
	it('getVPByBalance: VP = sqrt(display balance)', () => {
		// 100 COOP (9 decimals) -> sqrt(100) = 10
		expect(getVPByBalance(100e9, 9)).to.be.closeTo(10, 1e-9);
		expect(getVPByBalance(0, 9)).to.equal(0);
	});

	it('getVPBySqrtBalance: divides the stored sum of sqrt-balances back to VP', () => {
		// the AA stores sqrt(total_balance_in_smallest_units)
		const stored = Math.sqrt(100e9);
		expect(getVPBySqrtBalance(stored, 9)).to.be.closeTo(10, 1e-6);
		expect(getVPBySqrtBalance(0, 9)).to.equal(0);
	});

	it('the two conversions agree for a single voter', () => {
		const balance = 250e9;
		const stored = Math.sqrt(balance);
		expect(getVPBySqrtBalance(stored, 9)).to.be.closeTo(getVPByBalance(balance, 9), 1e-6);
	});
});

describe('getValueKey', () => {
	it('returns short values verbatim', () => {
		expect(getValueKey(0.01)).to.equal('0.01');
		expect(getValueKey('0.5')).to.equal('0.5');
	});

	it('hashes values that would overflow the 128-char key limit', () => {
		// 5 attestor addresses (32 chars) joined by ':' -> 164 chars
		const long = Array(5).fill('WMFLGI2GLAB2MDF2KQAH37VNRRMK7A5N').join(':');
		const expected = 'hash_' + crypto.createHash('sha256').update(long, 'utf8').digest('base64');
		expect(getValueKey(long)).to.equal(expected);
		expect(getValueKey(long).startsWith('hash_')).to.equal(true);
	});

	it('uses the same prefix length as the AA when deciding to hash', () => {
		// boundary: 'support_messaging_attestors_' is 28 chars, so the value may be
		// up to 100 chars before hashing kicks in
		const justUnder = 'a'.repeat(100);
		const justOver = 'a'.repeat(101);
		expect(getValueKey(justUnder)).to.equal(justUnder);
		expect(getValueKey(justOver).startsWith('hash_')).to.equal(true);
	});
});

describe('formatParamValue', () => {
	it('renders shares (number params) as percentages', () => {
		expect(formatParamValue('daily_locked_reward', 0.01)).to.equal('1%');
		expect(formatParamValue('daily_liquid_reward', 0.001)).to.equal('0.1%');
		expect(formatParamValue('by_votes_share', 0.5)).to.equal('50%');
	});

	it('renders integer params as COOP amounts using decimals', () => {
		expect(formatParamValue('referral_reward', 10e9, 9)).to.equal('10 COOP');
		expect(formatParamValue('min_balance_instead_of_real_name', 1e8, 9)).to.equal('0.1 COOP');
	});

	it('uses the provided symbol for integer params', () => {
		expect(formatParamValue('referral_reward', 10e9, 9, 'tCOOP')).to.equal('10 tCOOP');
	});

	it('truncates attestor address lists (string params)', () => {
		const value = 'WMFLGI2GLAB2MDF2KQAH37VNRRMK7A5N:FSJVTTCHUIWALPN7Y6GYEKZACXMEXIG3';
		expect(formatParamValue('messaging_attestors', value)).to.equal('WMFL...7A5N, FSJV...XIG3');
	});

	it('treats unknown parameter names as strings', () => {
		expect(formatParamValue('something_new', 'hello')).to.equal('hello');
	});
});

describe('truncateAddress', () => {
	it('shortens long addresses and leaves short ones alone', () => {
		expect(truncateAddress('WMFLGI2GLAB2MDF2KQAH37VNRRMK7A5N')).to.equal('WMFL...7A5N');
		expect(truncateAddress('short')).to.equal('short');
	});
});
