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
const LOW_COST_THRESHOLD = 1000; // Servers under this are always "relevant"


// --- Relevance Indicators -----------------------------------------------------

/** Static mapping: server type → project file indicators for relevance scoring. */
const RELEVANCE_INDICATORS = {
  postgres: { files: ['prisma/schema.prisma', 'migrations/', 'db/', 'ecto/', 'schema.sql', 'knexfile.js', 'drizzle.config.ts'], patterns: ['*.sql'], description: 'Database schema or migrations detected' },
  github: { files: ['.github/', '.git/'], description: 'Git repository detected' },
  terraform: { files: ['terraform/', '.terraform/'], patterns: ['*.tf'], description: 'Terraform configuration files detected' },
  docker: { files: ['Dockerfile', 'docker-compose.yml', 'docker-compose.yaml', '.dockerignore'], description: 'Docker configuration detected' },
  'brave-search': { description: 'General-purpose web search (always useful)', always_relevant: true },
  context7: { description: 'Documentation lookup (always useful)', always_relevant: true },
  redis: { files: ['redis.conf'], env_hints: ['REDIS_URL', 'REDIS_HOST'], description: 'Redis configuration or environment hints detected' },
  rabbitmq: { files: ['schemas/', 'rabbitmq.conf'], env_hints: ['RABBITMQ_URL', 'AMQP_URL'], description: 'Message queue schemas or config detected' },
  pulsar: { env_hints: ['PULSAR_SERVICE_URL'], description: 'Pulsar connection configured' },
  consul: { files: ['consul.hcl', 'consul/'], env_hints: ['CONSUL_HTTP_ADDR'], description: 'Consul configuration detected' },
  vault: { files: ['vault.hcl', 'vault/'], env_hints: ['VAULT_ADDR'], description: 'Vault configuration detected' },
  sqlite: { patterns: ['*.sqlite', '*.db'], description: 'SQLite database files detected' },
  puppeteer: { files: ['puppeteer.config.js', '.puppeteerrc'], description: 'Puppeteer/browser automation config detected' },
  slack: { files: ['slack.json', '.slack/'], env_hints: ['SLACK_BOT_TOKEN', 'SLACK_WEBHOOK_URL'], description: 'Slack integration detected' },
  filesystem: { description: 'Filesystem access (always useful for coding)', always_relevant: true },
  podman: { files: ['Containerfile', 'Dockerfile', 'podman-compose.yml'], description: 'Container configuration detected' },
};


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


// --- Relevance Scoring --------------------------------------------------------

/** Match server name against RELEVANCE_INDICATORS keys (fuzzy). */
function matchIndicatorKey(serverName) {
  const lower = serverName.toLowerCase();

  // Exact match first
  if (RELEVANCE_INDICATORS[lower]) return lower;

  // Fuzzy: check if server name contains indicator key or vice-versa
  for (const key of Object.keys(RELEVANCE_INDICATORS)) {
    if (lower.includes(key) || key.includes(lower)) return key;
  }

  return null;
}

/** Check if any env hints exist in .env or docker-compose files. */
function checkEnvHints(envHints, cwd) {
  if (!envHints || envHints.length === 0) return false;

  const envFiles = ['.env', '.env.local', '.env.development', 'docker-compose.yml', 'docker-compose.yaml'];

  for (const envFile of envFiles) {
    const filePath = path.join(cwd, envFile);
    try {
      if (!fs.existsSync(filePath)) continue;
      const content = fs.readFileSync(filePath, 'utf-8');
      for (const hint of envHints) {
        if (content.includes(hint)) return true;
      }
    } catch {
      // Ignore read errors
    }
  }
  return false;
}

/** Score a server's relevance to the current project. Returns { score, reason }. */
function scoreServerRelevance(server, cwd) {
  const indicatorKey = matchIndicatorKey(server.name);

  if (indicatorKey) {
    const indicator = RELEVANCE_INDICATORS[indicatorKey];

    // Always-relevant servers (brave-search, context7, filesystem)
    if (indicator.always_relevant) {
      return { score: 'relevant', reason: indicator.description };
    }

    // Low-cost servers — not worth disabling
    if (server.token_estimate && server.token_estimate < LOW_COST_THRESHOLD) {
      return { score: 'relevant', reason: 'Low cost (<1K tokens) — not worth disabling' };
    }

    // Check indicator files
    const files = indicator.files || [];
    for (const file of files) {
      try {
        if (fs.existsSync(path.join(cwd, file))) {
          return { score: 'relevant', reason: indicator.description };
        }
      } catch {
        // Ignore access errors
      }
    }

    // Check glob-like patterns (simple check: look for files matching *.ext)
    const patterns = indicator.patterns || [];
    for (const pattern of patterns) {
      if (pattern.startsWith('*.')) {
        const ext = pattern.slice(1); // e.g., '.sql', '.tf'
        try {
          // Check top-level directory for matching files
          const entries = fs.readdirSync(cwd);
          if (entries.some(e => e.endsWith(ext))) {
            return { score: 'relevant', reason: indicator.description };
          }
        } catch {
          // Ignore read errors
        }
      }
    }

    // Check env hints
    if (checkEnvHints(indicator.env_hints, cwd)) {
      return { score: 'possibly-relevant', reason: 'Environment hints found but no project files' };
    }

    // Known server type but no matching indicators
    return { score: 'not-relevant', reason: 'No project files matching this server type' };
  }

  // Low-cost unknown server
  if (server.token_estimate && server.token_estimate < LOW_COST_THRESHOLD) {
    return { score: 'relevant', reason: 'Low cost (<1K tokens) — not worth disabling' };
  }

  // Unknown server — not in RELEVANCE_INDICATORS
  return { score: 'possibly-relevant', reason: 'Unknown server — manual review recommended' };
}

/** Generate keep/disable/review recommendations for all servers. */
function generateRecommendations(servers, cwd, contextWindow) {
  contextWindow = contextWindow || DEFAULT_CONTEXT_WINDOW;

  let totalPotentialSavings = 0;
  const summary = { keep: 0, disable: 0, review: 0 };

  const enriched = servers.map(server => {
    const { score, reason } = scoreServerRelevance(server, cwd);

    let recommendation;
    let recommendationReason;

    if (score === 'relevant') {
      recommendation = 'keep';
      recommendationReason = reason;
      summary.keep++;
    } else if (score === 'possibly-relevant') {
      recommendation = 'review';
      recommendationReason = 'Check if this server is needed for your workflow';
      summary.review++;
    } else {
      // not-relevant
      recommendation = 'disable';
      const tokenSave = server.token_estimate || 0;
      const pct = ((tokenSave / contextWindow) * 100).toFixed(1);
      recommendationReason = `No matching project files found — saves ${tokenSave} tokens (${pct}%)`;
      totalPotentialSavings += tokenSave;
      summary.disable++;
    }

    return {
      ...server,
      relevance: score,
      recommendation,
      recommendation_reason: recommendationReason,
    };
  });

  const totalTokens = servers.reduce((sum, s) => sum + (s.token_estimate || 0), 0);
  const potentialSavingsPercent = totalTokens > 0
    ? ((totalPotentialSavings / contextWindow) * 100).toFixed(1) + '%'
    : '0.0%';

  return {
    servers: enriched,
    total_potential_savings: totalPotentialSavings,
    potential_savings_percent: potentialSavingsPercent,
    recommendations_summary: summary,
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

  // Generate relevance scores and recommendations
  const recommendations = generateRecommendations(serverResults, cwd, contextWindow);

  const totalContextPercent = ((totalTokens / contextWindow) * 100).toFixed(1) + '%';

  const result = {
    servers: recommendations.servers,
    total_tokens: totalTokens,
    total_context_percent: totalContextPercent,
    context_window: contextWindow,
    server_count: servers.length,
    known_count: knownCount,
    unknown_count: unknownCount,
    total_potential_savings: recommendations.total_potential_savings,
    potential_savings_percent: recommendations.potential_savings_percent,
    recommendations_summary: recommendations.recommendations_summary,
  };

  output(result, raw);
}

module.exports = {
  cmdMcpProfile,
  discoverMcpServers,
  estimateTokenCost,
  scoreServerRelevance,
  generateRecommendations,
  MCP_KNOWN_SERVERS,
  RELEVANCE_INDICATORS,
  DEFAULT_CONTEXT_WINDOW,
  DEFAULT_TOKENS_PER_TOOL,
  DEFAULT_BASE_TOKENS,
  LOW_COST_THRESHOLD,
  // Internal helpers exported for testing
  extractFromMcpJson,
  extractFromOpencodeJson,
  safeReadJson,
  matchIndicatorKey,
  checkEnvHints,
};
