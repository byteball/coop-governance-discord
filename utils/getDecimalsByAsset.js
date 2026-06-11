const DAG = require('aabot/dag.js');
const conf = require('ocore/conf.js');

async function getDecimalsByAsset(asset) {
    if (asset === "base") return 9;

    const current_desc = await DAG.readAAStateVar(conf.token_registry_AA_address, 'current_desc_' + asset);
    if (!current_desc) return null;

    const decimals = await DAG.readAAStateVar(conf.token_registry_AA_address, 'decimals_' + current_desc);

    return (decimals === undefined || decimals === null) ? null : decimals;
}

module.exports = getDecimalsByAsset;
