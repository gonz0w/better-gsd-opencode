'use strict';

const state = {
  outputMode: undefined,
  requestedFields: undefined,
  compactMode: undefined,
  manifestMode: undefined,
  dbNotices: undefined,
};

function readState(localKey, globalKey) {
  if (global[globalKey] !== undefined) {
    state[localKey] = global[globalKey];
  }
  return state[localKey];
}

function writeState(localKey, globalKey, value) {
  state[localKey] = value;
  global[globalKey] = value;
  return value;
}

function getOutputMode() {
  return readState('outputMode', '_gsdOutputMode');
}

function setOutputMode(value) {
  return writeState('outputMode', '_gsdOutputMode', value);
}

function getRequestedFields() {
  return readState('requestedFields', '_gsdRequestedFields');
}

function setRequestedFields(value) {
  return writeState('requestedFields', '_gsdRequestedFields', value);
}

function getCompactMode() {
  return readState('compactMode', '_gsdCompactMode');
}

function setCompactMode(value) {
  return writeState('compactMode', '_gsdCompactMode', value);
}

function getManifestMode() {
  return readState('manifestMode', '_gsdManifestMode');
}

function setManifestMode(value) {
  return writeState('manifestMode', '_gsdManifestMode', value);
}

function getDbNotices() {
  return readState('dbNotices', '_gsdDbNotices');
}

function setDbNotices(value) {
  return writeState('dbNotices', '_gsdDbNotices', value);
}

module.exports = {
  getOutputMode,
  setOutputMode,
  getRequestedFields,
  setRequestedFields,
  getCompactMode,
  setCompactMode,
  getManifestMode,
  setManifestMode,
  getDbNotices,
  setDbNotices,
};
