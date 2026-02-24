const fs = require('fs');
const path = require('path');
const { output, error, debugLog } = require('../lib/output');

// ─── Memory Commands ─────────────────────────────────────────────────────────

const VALID_STORES = ['decisions', 'bookmarks', 'lessons', 'todos'];
const SACRED_STORES = ['decisions', 'lessons'];
const BOOKMARKS_MAX = 20;
const COMPACT_THRESHOLD = 50;
const COMPACT_KEEP_RECENT = 10;

/**
 * Ensure .planning/memory/ directory exists.
 * Returns the directory path.
 */
function cmdMemoryEnsureDir(cwd) {
  const dir = path.join(cwd, '.planning', 'memory');
  fs.mkdirSync(dir, { recursive: true });
  output({ ensured: true, memory_dir: dir });
}

/**
 * Write an entry to a memory store.
 * Options: store (required), entry (required, JSON string)
 */
function cmdMemoryWrite(cwd, options, raw) {
  const { store, entry: entryJson } = options;

  if (!store || !VALID_STORES.includes(store)) {
    error(`Invalid or missing store. Must be one of: ${VALID_STORES.join(', ')}`);
  }
  if (!entryJson) {
    error('Missing --entry (JSON string)');
  }

  let entry;
  try {
    entry = JSON.parse(entryJson);
  } catch (e) {
    error(`Invalid JSON in --entry: ${e.message}`);
  }

  // Ensure directory exists
  const memDir = path.join(cwd, '.planning', 'memory');
  fs.mkdirSync(memDir, { recursive: true });

  const filePath = path.join(memDir, `${store}.json`);

  // Read existing entries
  let entries = [];
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    entries = JSON.parse(raw);
    if (!Array.isArray(entries)) entries = [];
  } catch (e) {
    debugLog('memory.write', 'read failed, starting fresh', e);
    entries = [];
  }

  // Add timestamp if not present
  if (!entry.timestamp) {
    entry.timestamp = new Date().toISOString();
  }

  // Store-specific behavior
  if (store === 'bookmarks') {
    // New entry at index 0, trim to max
    entries.unshift(entry);
    if (entries.length > BOOKMARKS_MAX) {
      entries = entries.slice(0, BOOKMARKS_MAX);
    }
  } else {
    // decisions, lessons, todos: simple append, NEVER prune decisions/lessons
    entries.push(entry);
  }

  // Write back
  fs.writeFileSync(filePath, JSON.stringify(entries, null, 2), 'utf-8');

  const result = { written: true, store, entry_count: entries.length };

  // Warn if store exceeds compaction threshold (not for sacred stores)
  if (!SACRED_STORES.includes(store) && entries.length > COMPACT_THRESHOLD) {
    result.compact_needed = true;
    result.threshold = COMPACT_THRESHOLD;
  }

  output(result);
}

/**
 * Read entries from a memory store.
 * Options: store (required), limit, query, phase
 */
function cmdMemoryRead(cwd, options, raw) {
  const { store, limit, query, phase } = options;

  if (!store || !VALID_STORES.includes(store)) {
    error(`Invalid or missing store. Must be one of: ${VALID_STORES.join(', ')}`);
  }

  const filePath = path.join(cwd, '.planning', 'memory', `${store}.json`);

  let entries = [];
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    entries = JSON.parse(raw);
    if (!Array.isArray(entries)) entries = [];
  } catch (e) {
    debugLog('memory.read', 'read failed', e);
    entries = [];
  }

  const total = entries.length;

  // Filter by phase
  if (phase) {
    entries = entries.filter(e => e.phase && String(e.phase) === String(phase));
  }

  // Filter by query (case-insensitive match on all string values)
  if (query) {
    const q = query.toLowerCase();
    entries = entries.filter(e => {
      return Object.values(e).some(v => {
        if (typeof v === 'string') return v.toLowerCase().includes(q);
        return false;
      });
    });
  }

  // Slice by limit
  if (limit && parseInt(limit, 10) > 0) {
    entries = entries.slice(0, parseInt(limit, 10));
  }

  output({ entries, count: entries.length, store, total });
}

/**
 * List memory stores with stats.
 */
function cmdMemoryList(cwd, options, raw) {
  const memDir = path.join(cwd, '.planning', 'memory');

  const stores = [];
  try {
    const files = fs.readdirSync(memDir);
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      const filePath = path.join(memDir, file);
      const stat = fs.statSync(filePath);
      let entryCount = 0;
      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        if (Array.isArray(data)) entryCount = data.length;
      } catch (e) {
        debugLog('memory.list', `parse failed for ${file}`, e);
      }
      stores.push({
        name: file.replace('.json', ''),
        entry_count: entryCount,
        size_bytes: stat.size,
        last_modified: stat.mtime.toISOString(),
      });
    }
  } catch (e) {
    debugLog('memory.list', 'readdir failed', e);
    // No memory dir yet — return empty list
  }

  output({ stores, memory_dir: memDir });
}

/**
 * Compact memory stores by summarizing old entries.
 * Options: store (optional), threshold (default: 50), dryRun (boolean)
 */
function cmdMemoryCompact(cwd, options, raw) {
  const { store, threshold: thresholdStr, dryRun } = options;
  const threshold = thresholdStr ? parseInt(thresholdStr, 10) : COMPACT_THRESHOLD;

  // If a specific store is requested, validate it
  if (store && !VALID_STORES.includes(store)) {
    error(`Invalid store. Must be one of: ${VALID_STORES.join(', ')}`);
  }

  const memDir = path.join(cwd, '.planning', 'memory');
  const storesToProcess = store ? [store] : VALID_STORES;

  const result = {
    compacted: false,
    stores_processed: [],
    entries_before: {},
    entries_after: {},
    summaries_created: {},
    sacred_skipped: [],
  };

  for (const s of storesToProcess) {
    // Sacred data: never compact
    if (SACRED_STORES.includes(s)) {
      result.sacred_skipped.push(s);
      continue;
    }

    const filePath = path.join(memDir, `${s}.json`);

    let entries = [];
    try {
      const rawData = fs.readFileSync(filePath, 'utf-8');
      entries = JSON.parse(rawData);
      if (!Array.isArray(entries)) entries = [];
    } catch (e) {
      debugLog('memory.compact', `read failed for ${s}`, e);
      continue;
    }

    const beforeCount = entries.length;
    result.entries_before[s] = beforeCount;

    // Only compact if above threshold
    if (beforeCount <= threshold) {
      result.entries_after[s] = beforeCount;
      result.summaries_created[s] = 0;
      result.stores_processed.push(s);
      continue;
    }

    let compactedEntries;
    let summariesCreated = 0;

    if (s === 'bookmarks') {
      // Keep COMPACT_KEEP_RECENT most recent entries (index 0 = newest)
      const kept = entries.slice(0, COMPACT_KEEP_RECENT);
      const old = entries.slice(COMPACT_KEEP_RECENT);
      const summarized = old.map(e => {
        const ts = e.timestamp || '';
        const date = ts ? ts.split('T')[0] : 'unknown';
        const phase = e.phase || '?';
        const plan = e.plan || '?';
        const task = e.task !== undefined ? e.task : '?';
        return {
          summary: `${date}: Phase ${phase}, Plan ${plan}, Task ${task}`,
          original_timestamp: ts,
        };
      });
      summariesCreated = summarized.length;
      compactedEntries = [...kept, ...summarized];
    } else if (s === 'todos') {
      // Keep active (non-completed) todos, summarize completed ones
      const active = [];
      const completedSummaries = [];
      for (const e of entries) {
        const isCompleted = e.completed === true || e.status === 'completed' || e.status === 'done';
        if (isCompleted) {
          const ts = e.timestamp || '';
          const date = ts ? ts.split('T')[0] : 'unknown';
          const text = e.text || e.summary || e.title || 'todo';
          completedSummaries.push({
            summary: `${date}: [completed] ${text}`,
            original_timestamp: ts,
          });
        } else {
          active.push(e);
        }
      }
      summariesCreated = completedSummaries.length;
      compactedEntries = [...active, ...completedSummaries];
    } else {
      // Unknown non-sacred store — skip
      result.entries_after[s] = beforeCount;
      result.summaries_created[s] = 0;
      result.stores_processed.push(s);
      continue;
    }

    result.entries_after[s] = compactedEntries.length;
    result.summaries_created[s] = summariesCreated;
    result.stores_processed.push(s);

    if (summariesCreated > 0) {
      result.compacted = true;
    }

    // Write back unless dry-run
    if (!dryRun) {
      fs.mkdirSync(memDir, { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(compactedEntries, null, 2), 'utf-8');
    }
  }

  // If only sacred stores were requested, return special response
  if (store && SACRED_STORES.includes(store)) {
    output({ compacted: false, reason: 'sacred_data' });
    return;
  }

  if (dryRun) {
    result.dry_run = true;
  }

  output(result);
}

module.exports = { cmdMemoryWrite, cmdMemoryRead, cmdMemoryList, cmdMemoryEnsureDir, cmdMemoryCompact };
