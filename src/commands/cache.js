'use strict';

const fs = require('fs');
const path = require('path');
const { output, debugLog } = require('../lib/output');

// Lazy-loaded cache engine
let _cacheEngine = null;

function getCacheEngine() {
  if (!_cacheEngine) {
    try {
      const { CacheEngine } = require('../lib/cache');
      _cacheEngine = new CacheEngine();
    } catch (e) {
      debugLog('cache', 'failed to load CacheEngine', e);
      return null;
    }
  }
  return _cacheEngine;
}

/**
 * Cache status command - reports backend type, entry count, hit/miss stats
 */
function cmdCacheStatus(cwd, args, raw) {
  const cacheEngine = getCacheEngine();
  
  if (!cacheEngine) {
    output({ 
      backend: 'unavailable', 
      count: 0, 
      hits: 0, 
      misses: 0,
      error: 'CacheEngine failed to load'
    }, raw, 'Cache unavailable');
    return;
  }
  
  const status = cacheEngine.status();
  output(status, raw, `${status.backend}: ${status.count} entries`);
}

/**
 * Cache clear command - clears all cache entries
 */
function cmdCacheClear(cwd, args, raw) {
  const cacheEngine = getCacheEngine();
  
  if (!cacheEngine) {
    output({ cleared: false, error: 'CacheEngine failed to load' }, raw, 'Failed to clear cache');
    return;
  }
  
  cacheEngine.clear();
  output({ cleared: true }, raw, 'Cache cleared');
}

/**
 * Cache warm command - populates cache with file contents
 */
function cmdCacheWarm(cwd, args, raw) {
  const cacheEngine = getCacheEngine();
  
  if (!cacheEngine) {
    output({ warmed: 0, error: 'CacheEngine failed to load' }, raw, 'Failed to warm cache');
    return;
  }
  
  // Get file paths from args (skip 'warm' subcommand)
  const filePaths = args.slice(1);
  
  if (filePaths.length === 0) {
    output({ warmed: 0, error: 'No files specified' }, raw, 'No files to warm');
    return;
  }
  
  // Resolve relative paths to absolute
  const resolvedPaths = filePaths.map(p => {
    if (path.isAbsolute(p)) return p;
    return path.join(cwd, p);
  });
  
  const warmed = cacheEngine.warm(resolvedPaths);
  output({ warmed }, raw, `Warmed ${warmed} file(s)`);
}

/**
 * Register cache commands with router
 * Called from router.js to add cache command handling
 */
function registerCacheCommand(router) {
  // This function is kept for API compatibility but commands are 
  // handled directly in router.js via the 'cache' case
  return router;
}

module.exports = {
  cmdCacheStatus,
  cmdCacheClear,
  cmdCacheWarm,
  registerCacheCommand
};
