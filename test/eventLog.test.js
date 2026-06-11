const { expect } = require('chai');

const { formatEventLogLine } = require('../lib/eventLog');

const DATE = new Date('2026-06-11T00:30:00.000Z');

const baseEvent = {
	type: 'added_support',
	name: 'daily_locked_reward',
	value: 0.02,
	trigger_unit: 'UNIT123',
};

describe('formatEventLogLine', () => {
	it('formats a sent event as a tab-separated line', () => {
		const line = formatEventLogLine(baseEvent, 'sent', '123456789', DATE);
		expect(line).to.equal(
			'2026-06-11T00:30:00.000Z\tsent\t123456789\tadded_support\tdaily_locked_reward\t0.02\tUNIT123',
		);
	});

	it('uses "-" for a missing channel and a missing value', () => {
		const event = { type: 'removed_support', name: 'by_votes_share', trigger_unit: 'UNIT123' };
		const line = formatEventLogLine(event, 'muted', undefined, DATE);
		expect(line).to.equal(
			'2026-06-11T00:30:00.000Z\tmuted\t-\tremoved_support\tby_votes_share\t-\tUNIT123',
		);
	});

	it('JSON-quotes string values so attestor lists stay one column', () => {
		const event = {
			type: 'commit',
			name: 'messaging_attestors',
			value: 'ADDR1:ADDR2',
			trigger_unit: 'UNIT123',
		};
		const line = formatEventLogLine(event, 'sent', 'chan', DATE);
		expect(line.split('\t')[5]).to.equal('"ADDR1:ADDR2"');
	});

	it('keeps the failure reason in the status column', () => {
		const line = formatEventLogLine(baseEvent, 'failed: Error: Missing Access', 'chan', DATE);
		expect(line.split('\t')[1]).to.equal('failed: Error: Missing Access');
	});
});
