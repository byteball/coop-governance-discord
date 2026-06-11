// Runtime types of every governable COOP parameter, mirroring the source of
// truth in coop-ui (`src/shared/config/appConfig.ts`). Used to pretty-print
// values in notifications:
//   - "number"  → a share, shown as a percentage  (0.01  -> "1%")
//   - "integer" → a COOP amount in smallest units  (10e9 -> "10 COOP")
//   - "string"  → a colon-separated list of attestor addresses
const paramDefs = {
  daily_locked_reward: 'number',
  daily_liquid_reward: 'number',
  bytes_reducer: 'number',
  by_votes_share: 'number',
  referrer_coop_deposit_reward_share: 'number',
  referrer_bytes_deposit_reward_share: 'number',
  referral_reward: 'integer',
  min_balance_instead_of_real_name: 'integer',
  messaging_attestors: 'string',
  real_name_attestors: 'string',
};

const warnedUnknown = new Set();

function getParamType(name) {
  const type = paramDefs[name];
  if (type) return type;
  // an unknown name means this table drifted from the AA's param list — warn
  // (once per name) instead of silently misformatting the value
  if (!warnedUnknown.has(name)) {
    warnedUnknown.add(name);
    console.warn('unknown governance parameter "' + name + '", formatting its value as a string');
  }
  return 'string';
}

exports.paramDefs = paramDefs;
exports.getParamType = getParamType;
