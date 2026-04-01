'use strict';

// Barrel re-export combining all verify subdomain modules
const quality = require('./quality');
const references = require('./references');
const search = require('./search');
const health = require('./health');

module.exports = Object.assign(
  {},
  quality,
  references,
  search,
  health
);
