// Voting power of a single user given their total_balance (in the COOP token's
// smallest units). Matches the AA's sqrt(total_balance) weighting.
const getVPByBalance = (balanceInCoop = 0, decimals = 9) => {
  return Math.sqrt(balanceInCoop / 10 ** decimals);
}

exports.getVPByBalance = getVPByBalance;
