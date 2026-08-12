"use strict";
const path = require('path');
require('dotenv').config({ path: path.dirname(process.mainModule.paths[0]) + '/.env' });

exports.bServeAsHub = false;
exports.bLight = true;

exports.bNoPassphrase = true;

exports.discord_token = process.env.discord_token;
// one channel id or several comma-separated ones; falsy entries are dropped so
// a missing `channel` fails fast at startup instead of at send time
exports.discord_channels = (process.env.channel || '').split(',').map(s => s.trim()).filter(Boolean);
// only explicit truthy values enable testnet — `testnet=0`/`false` mean mainnet
exports.testnet = /^(1|true|yes)$/i.test(process.env.testnet || '');
exports.hub = process.env.testnet ? 'obyte.org/bb-test' : 'obyte.org/bb';

exports.explorer_base_url = process.env.testnet ? 'https://testnetexplorer.obyte.org/' : 'https://explorer.obyte.org/';

// The COOP main AA. The governance AA is discovered from its `constants` state var.
exports.coop_aa = process.env.coop_aa || (process.env.testnet ? 'SUOLWPFSOJ3VRM3GDYNEOJLFKAELGBR7' : 'COOPT6NEILHN4ZGPKXGNLCKMSD5LIKIU');

// Web app the notifications link back to.
exports.coop_url = process.env.coop_url || 'https://coop.obyte.org';
exports.coop_name = process.env.coop_name || 'Obyte COOP';

// Used to resolve the COOP token symbol/decimals; falls back to coop_decimals if absent.
exports.token_registry_AA_address = process.env.TOKEN_REGISTRY_AA_ADDRESS || 'O6H6ZIFI57X3PLTYHOCVYPP5A553CYFQ';
exports.coop_decimals = process.env.coop_decimals ? Number(process.env.coop_decimals) : 9;

console.log('finished coop gov conf');
