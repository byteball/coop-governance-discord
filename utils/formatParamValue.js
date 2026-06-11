const { getParamType } = require('./paramDefs');

function truncateAddress(addr) {
  return addr.length > 12 ? addr.slice(0, 4) + '...' + addr.slice(-4) : addr;
}

// Turn a raw AA parameter value into a human-readable string for Discord.
// Mirrors `formatParamValue` in coop-ui so notifications read the same way the
// web app shows them. `decimals` is the COOP token decimals (default 9).
function formatParamValue(name, value, decimals = 9, symbol = 'COOP') {
  if (value === undefined || value === null) return String(value);

  switch (getParamType(name)) {
    case 'number':
      // share -> percentage, trimmed to avoid float noise (0.01 -> "1%")
      return +(Number(value) * 100).toPrecision(15) + '%';
    case 'integer':
      return +(Number(value) / 10 ** decimals).toPrecision(15) + ' ' + symbol;
    case 'string':
    default:
      return String(value).split(':').map(truncateAddress).join(', ');
  }
}

exports.formatParamValue = formatParamValue;
exports.truncateAddress = truncateAddress;
