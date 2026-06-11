const DAG = require('aabot/dag.js');
const conf = require('ocore/conf.js');

async function getSymbolByAsset(asset) {
    if (asset === "base") return "GBYTE";

    const symbol = await DAG.readAAStateVar(conf.token_registry_AA_address, 'a2s_' + asset);

    if (!symbol) return asset.replace(/[+=]/g, '').substr(0, 6);

    return symbol
}

module.exports = getSymbolByAsset;
