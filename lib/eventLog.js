const fs = require('fs');
const path = require('path');

// One tab-separated line per announced event: when it was sent, the delivery
// status (sent | muted | failed: ... | skipped: ...), the channel, what was
// announced (type/name/value) and the trigger unit it came from.
function formatEventLogLine(event, status, channelId, date) {
	return [
		date.toISOString(),
		status,
		channelId || '-',
		event.type,
		event.name,
		event.value !== undefined ? JSON.stringify(event.value) : '-',
		event.trigger_unit,
	].join('\t');
}

// events.log lives next to ocore's own log.txt in the app data directory;
// resolved lazily so this module stays requireable in unit tests without ocore.
let logPath;
function getLogPath() {
	if (!logPath) {
		const desktopApp = require('ocore/desktop_app.js');
		logPath = path.join(desktopApp.getAppDataDir(), 'events.log');
	}
	return logPath;
}

function logEvent(event, status, channelId) {
	console.error('event ' + status + (channelId ? ' to channel ' + channelId : '') + ': '
		+ event.type + ' ' + event.name + ' (trigger ' + event.trigger_unit + ')');
	fs.appendFile(getLogPath(), formatEventLogLine(event, status, channelId, new Date()) + '\n', (err) => {
		if (err)
			console.error('failed to write events.log: ' + err);
	});
}

exports.formatEventLogLine = formatEventLogLine;
exports.logEvent = logEvent;
