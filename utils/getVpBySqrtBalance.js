// The COOP governance AA stores support as a sum of sqrt(total_balance), where
// total_balance is denominated in the COOP token's smallest units. Dividing by
// 10^(decimals/2) converts that back to "voting power" = sqrt(display balance).
const getVPBySqrtBalance = (sqrtCoopBalance = 0, decimals = 9) => {
  return sqrtCoopBalance / (10 ** (decimals / 2));
}

exports.getVPBySqrtBalance = getVPBySqrtBalance;
