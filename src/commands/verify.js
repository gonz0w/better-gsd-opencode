'use strict';

// Barrel re-export for backward compatibility
// Original verify.js (3383 LOC) has been extracted into verify/ subdomain
module.exports = Object.assign(
  {},
  require('./verify/quality'),
  require('./verify/references'),
  require('./verify/search'),
  require('./verify/health')
);
