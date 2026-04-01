// Command registry for natural language command mapping
// Maps phrases to canonical commands and provides alias/intent data

// Phrase to command mapping
const PHRASES = [
  { phrase: 'plan phase', command: 'plan:phase', intent: 'plan' },
  { phrase: 'create plan', command: 'plan:phase', intent: 'plan' },
  { phrase: 'new phase', command: 'plan:phase', intent: 'plan' },
  { phrase: 'add phase', command: 'plan:phase', intent: 'plan' },
  
  { phrase: 'execute phase', command: '/bgsd-execute-phase', intent: 'execute' },
  { phrase: 'run phase', command: '/bgsd-execute-phase', intent: 'execute' },
  { phrase: 'run the tests', command: '/bgsd-quick', intent: 'execute' },
  { phrase: 'run tests', command: '/bgsd-quick', intent: 'execute' },
  { phrase: 'run all', command: '/bgsd-execute-phase', intent: 'execute' },
  
  { phrase: 'verify work', command: '/bgsd-verify-work', intent: 'verify' },
  { phrase: 'check work', command: '/bgsd-verify-work', intent: 'verify' },
  { phrase: 'verify phase', command: 'verify:state', intent: 'verify' },
  { phrase: 'validate phase', command: 'verify:state', intent: 'verify' },
  { phrase: 'check status', command: 'verify:state', intent: 'verify' },
  
  { phrase: 'show progress', command: 'verify:state', intent: 'verify' },
  { phrase: 'display progress', command: 'verify:state', intent: 'verify' },
  { phrase: 'status', command: 'verify:state', intent: 'verify' },
  { phrase: 'what is the status', command: 'verify:state', intent: 'verify' },
  { phrase: 'show roadmap', command: 'verify:state', intent: 'verify' },
  { phrase: 'list phases', command: 'verify:state', intent: 'verify' },
  
  { phrase: 'resume work', command: '/bgsd-resume', intent: 'execute' },
  { phrase: 'continue work', command: '/bgsd-resume', intent: 'execute' },
  
  { phrase: 'pause work', command: '/bgsd-pause', intent: 'query' },
  { phrase: 'take a break', command: '/bgsd-pause', intent: 'query' },
  
  { phrase: 'new milestone', command: 'plan:milestone', intent: 'plan' },
  { phrase: 'create milestone', command: 'plan:milestone', intent: 'plan' },
  
  { phrase: 'complete milestone', command: 'plan:milestone', intent: 'plan' },
  { phrase: 'finish milestone', command: 'plan:milestone', intent: 'plan' },
  
  { phrase: 'health check', command: 'health', intent: 'query' },
  { phrase: 'project health', command: 'health', intent: 'query' },
  
  { phrase: 'search decisions', command: 'util:search-decisions', intent: 'query' },
  { phrase: 'find lessons', command: 'verify:search-lessons', intent: 'query' }
];

// Short aliases (backward compatibility)
const ALIASES = {
  'p': 'plan:phase',
  'e': '/bgsd-execute-phase',
  'ep': '/bgsd-execute-phase',
  'ev': 'verify:state',
  'v': '/bgsd-verify-work',
  'w': '/bgsd-verify-work',
  'q': 'query',
  's': 'verify:state',
  'st': 'verify:state',
  'pr': 'verify:state',
  'r': '/bgsd-resume',
  'rs': '/bgsd-resume',
  'pa': '/bgsd-pause',
  'pp': '/bgsd-pause',
  'h': 'help',
  '?': 'help'
};

// Intent keywords for classification
const INTENTS = {
  plan: ['plan', 'planning', 'create', 'new', 'make', 'add'],
  execute: ['execute', 'run', 'start', 'go', 'do', 'implement', 'run the'],
  verify: ['verify', 'check', 'test', 'validate', 'confirm', 'audit'],
  query: ['show', 'display', 'list', 'get', 'find', 'search', 'what', 'how', 'status', 'progress']
};

module.exports = { PHRASES, ALIASES, INTENTS };
