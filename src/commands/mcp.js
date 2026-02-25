'use strict';

const fs = require('fs');
const path = require('path');
const { output, error, debugLog } = require('../lib/output');

// --- Known MCP Server Database ------------------------------------------------

/**
 * Static lookup table mapping server identifiers to approximate token cost data.
 * Token estimates based on typical tool definition sizes (~150 tokens/tool).
 *
 * Each entry:
 * - patterns: array of regex/string patterns to match server name or command
 * - tool_count: approximate number of tools the server exposes
 * - base_tokens: fixed overhead (server description, protocol, etc.)
 * - total_estimate: pre-calculated total token estimate
 */
const MCP_KNOWN_SERVERS = [
  { name: 'postgres', patterns: [/postgres/i, /toolbox.*postgres/i], tool_count: 12, base_tokens: 700, total_estimate: 4500 },
  { name: 'github', patterns: [/github/i], tool_count: 30, base_tokens: 1500, total_estimate: 46000 },
  { name: 'brave-search', patterns: [/brave[_-]?search/i, /server-brave-search/i], tool_count: 3, base_tokens: 500, total_estimate: 2500 },
  { name: 'context7', patterns: [/context7/i], tool_count: 2, base_tokens: 300, total_estimate: 1500 },
  { name: 'terraform', patterns: [/terraform/i], tool_count: 8, base_tokens: 800, total_estimate: 6000 },
  { name: 'docker', patterns: [/^docker$/i, /docker-mcp/i], tool_count: 10, base_tokens: 500, total_estimate: 5000 },
  { name: 'podman', patterns: [/podman/i], tool_count: 10, base_tokens: 500, total_estimate: 5000 },
  { name: 'filesystem', patterns: [/filesystem/i, /server-filesystem/i], tool_count: 8, base_tokens: 500, total_estimate: 3000 },
  { name: 'puppeteer', patterns: [/puppeteer/i], tool_count: 12, base_tokens: 800, total_estimate: 8000 },
  { name: 'sqlite', patterns: [/sqlite/i], tool_count: 6, base_tokens: 500, total_estimate: 3000 },
  { name: 'redis', patterns: [/redis/i], tool_count: 8, base_tokens: 500, total_estimate: 3500 },
  { name: 'rabbitmq', patterns: [/rabbitmq/i, /queue[_-]?pilot/i], tool_count: 6, base_tokens: 500, total_estimate: 3000 },
  { name: 'pulsar', patterns: [/pulsar/i, /snmcp/i], tool_count: 8, base_tokens: 500, total_estimate: 4000 },
  { name: 'consul', patterns: [/consul/i], tool_count: 5, base_tokens: 400, total_estimate: 2500 },
  { name: 'vault', patterns: [/vault/i], tool_count: 8, base_tokens: 500, total_estimate: 4000 },
  { name: 'slack', patterns: [/slack/i], tool_count: 15, base_tokens: 1000, total_estimate: 12000 },
  { name: 'linear', patterns: [/linear/i], tool_count: 20, base_tokens: 1000, total_estimate: 15000 },
  { name: 'notion', patterns: [/notion/i], tool_count: 12, base_tokens: 800, total_estimate: 6000 },
  { name: 'sentry', patterns: [/sentry/i], tool_count: 8, base_tokens: 600, total_estimate: 4000 },
  { name: 'datadog', patterns: [/datadog/i], tool_count: 10, base_tokens: 800, total_estimate: 5000 },
];

const DEFAULT_TOKENS_PER_TOOL = 150;
const DEFAULT_BASE_TOKENS = 400;
const DEFAULT_CONTEXT_WINDOW = 200000;


// --- Server Discovery ---------------------------------------------------------

/**
 * Read and parse a JSON file, returning null on any error.
 */
function safeReadJson(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    debugLog('mcp.discovery', `failed to parse ${filePath}`);
    return null;
  }
}

/**
 * Extract servers from .mcp.json (Claude Code format).
 * Format: { mcpServers: { name: { command, args?, env? } } }
 */
function extractFromMcpJson(filePath) {
  const data = safeReadJson(filePath);
  if (!data || !data.mcpServers || typeof data.mcpServers !== 'object') return [];

  const servers = [];
  for (const [name, config] of Object.entries(data.mcpServers)) {
    if (!config || typeof config !== 'object') continue;

    const command = typeof config.command === 'string' ? config.command : null;
    const args = Array.isArray(config.args) ? config.args : [];

    servers.push({
      name,
      source: '.mcp.json',
      transport: 'stdio',
      command: command || 'unknown',
      args,
    });
  }
  return servers;
}

/**
 * Extract servers from opencode.json (OpenCode format).
 * Format: { mcp: { name: { type, command, environment? } } }
 */
function extractFromOpencodeJson(filePath, sourceName) {
  const data = safeReadJson(filePath);
  if (!data || !data.mcp || typeof data.mcp !== 'object') return [];

  const servers = [];
  for (const [name, config] of Object.entries(data.mcp)) {
    if (!config || typeof config !== 'object') continue;

    // Determine transport
    const transport = config.type === 'remote' ? 'remote' : 'stdio';

    // Extract command — can be string or array
    let command = 'unknown';
    let args = [];

    if (transport === 'remote') {
      command = config.url || 'unknown';
    } else if (Array.isArray(config.command)) {
      command = config.command[0] || 'unknown';
      args = config.command.slice(1);
    } else if (typeof config.command === 'string') {
      command = config.command;
    }

    servers.push({
      name,
      source: sourceName || path.basename(filePath),
      transport,
      command,
      args,
    });
  }
  return servers;
}

/**
 * Discover MCP servers from 3 locations:
 * 1. Project .mcp.json (Claude Code format)
 * 2. Project opencode.json (OpenCode format)
 * 3. User-level ~/.config/opencode/opencode.json (lower priority)
 *
 * Deduplication: project-level wins over user-level. Same name in both
 * project configs → merge (keep both but deduplicate by name, preferring
 * project .mcp.json entry but keeping opencode.json metadata when richer).
 *
 * @param {string} cwd - Project root directory
 * @returns {object[]} Array of server objects sorted by name
 */
function discoverMcpServers(cwd) {
  // 1. Project .mcp.json
  const mcpJsonServers = extractFromMcpJson(path.join(cwd, '.mcp.json'));

  // 2. Project opencode.json
  const opencodeServers = extractFromOpencodeJson(
    path.join(cwd, 'opencode.json'),
    'opencode.json'
  );

  // 3. User-level opencode.json
  const homeConfig = path.join(
    process.env.HOME || process.env.USERPROFILE || '~',
    '.config', 'opencode', 'opencode.json'
  );
  const userServers = extractFromOpencodeJson(homeConfig, '~/.config/opencode/opencode.json');

  // Merge with deduplication:
  // Project .mcp.json + project opencode.json are both project-level
  // User-level servers only included if name not already present
  const serverMap = new Map();

  // Project .mcp.json first
  for (const s of mcpJsonServers) {
    serverMap.set(s.name, s);
  }

  // Project opencode.json — only add if not already present from .mcp.json
  for (const s of opencodeServers) {
    if (!serverMap.has(s.name)) {
      serverMap.set(s.name, s);
    }
    // If already present, keep .mcp.json version (project-level dedup)
  }

  // User-level — only add if not already present from project configs
  for (const s of userServers) {
    if (!serverMap.has(s.name)) {
      serverMap.set(s.name, s);
    }
  }

  // Sort by name
  return Array.from(serverMap.values()).sort((a, b) => a.name.localeCompare(b.name));
}


// --- Token Cost Estimation ----------------------------------------------------

/**
 * Estimate token cost for a discovered server.
 * Matches server name and command against known-server patterns.
 *
 * @param {object} server - Discovered server object
 * @param {object[]} [knownServers] - Known server database (default: MCP_KNOWN_SERVERS)
 * @returns {object} Token cost estimate
 */
function estimateTokenCost(server, knownServers) {
  const db = knownServers || MCP_KNOWN_SERVERS;

  // Match against known servers by name, then command
  for (const known of db) {
    for (const pattern of known.patterns) {
      const testStr = `${server.name} ${server.command} ${(server.args || []).join(' ')}`;
      if (pattern instanceof RegExp) {
        if (pattern.test(server.name) || pattern.test(server.command) || pattern.test(testStr)) {
          return {
            matched: true,
            server_name: known.name,
            tool_count: known.tool_count,
            token_estimate: known.total_estimate,
            source: 'known-db',
          };
        }
      } else if (typeof pattern === 'string') {
        const lowerTest = testStr.toLowerCase();
        if (lowerTest.includes(pattern.toLowerCase())) {
          return {
            matched: true,
            server_name: known.name,
            tool_count: known.tool_count,
            token_estimate: known.total_estimate,
            source: 'known-db',
          };
        }
      }
    }
  }

  // Unknown server — default estimate
  const defaultToolCount = 5;
  const estimate = (defaultToolCount * DEFAULT_TOKENS_PER_TOOL) + DEFAULT_BASE_TOKENS;
  return {
    matched: false,
    server_name: server.name,
    tool_count: defaultToolCount,
    token_estimate: estimate,
    source: 'default-estimate',
  };
}


// --- Main Command Function ----------------------------------------------------

/**
 * cmdMcpProfile - MCP server profiling command.
 * Discovers servers, estimates token cost, reports context window usage.
 *
 * @param {string} cwd - Project root directory
 * @param {string[]} args - CLI arguments
 * @param {boolean} raw - Raw JSON output mode
 */
function cmdMcpProfile(cwd, args, raw) {
  // Parse --window flag
  let contextWindow = DEFAULT_CONTEXT_WINDOW;
  const windowIdx = args.indexOf('--window');
  if (windowIdx !== -1 && args[windowIdx + 1]) {
    const parsed = parseInt(args[windowIdx + 1], 10);
    if (!isNaN(parsed) && parsed > 0) {
      contextWindow = parsed;
    }
  }

  // Discover servers
  const servers = discoverMcpServers(cwd);

  // Estimate token costs
  let totalTokens = 0;
  let knownCount = 0;
  let unknownCount = 0;

  const serverResults = servers.map(server => {
    const cost = estimateTokenCost(server);
    totalTokens += cost.token_estimate;
    if (cost.source === 'known-db') {
      knownCount++;
    } else {
      unknownCount++;
    }

    const contextPercent = ((cost.token_estimate / contextWindow) * 100).toFixed(1) + '%';

    return {
      name: server.name,
      source: server.source,
      transport: server.transport,
      command: server.command,
      tool_count: cost.tool_count,
      token_estimate: cost.token_estimate,
      token_source: cost.source,
      context_percent: contextPercent,
    };
  });

  const totalContextPercent = ((totalTokens / contextWindow) * 100).toFixed(1) + '%';

  const result = {
    servers: serverResults,
    total_tokens: totalTokens,
    total_context_percent: totalContextPercent,
    context_window: contextWindow,
    server_count: servers.length,
    known_count: knownCount,
    unknown_count: unknownCount,
  };

  output(result, raw);
}

module.exports = {
  cmdMcpProfile,
  discoverMcpServers,
  estimateTokenCost,
  MCP_KNOWN_SERVERS,
  DEFAULT_CONTEXT_WINDOW,
  DEFAULT_TOKENS_PER_TOOL,
  DEFAULT_BASE_TOKENS,
  // Internal helpers exported for testing
  extractFromMcpJson,
  extractFromOpencodeJson,
  safeReadJson,
};
