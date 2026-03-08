---
name: debugger-research-reasoning
description: Decision framework for debuggers — when to research externally (unfamiliar errors, library behavior, domain gaps, platform differences) vs when to reason through code (your code, logic errors, observable behavior), with a decision tree and balance indicators.
type: agent-specific
agents: [debugger]
sections: [when-to-research, when-to-reason, how-to-research, decision-tree, balance-indicators]
---

## Purpose

Debuggers face a constant choice: search for answers externally or reason through the codebase. Choosing wrong wastes time — researching when you should be reading code, or staring at code when the answer is in documentation. This skill provides the decision framework.

## Placeholders

| Placeholder | Description | Example |
|-------------|-------------|---------|
| (none) | This skill uses no placeholders | — |

## Content

<!-- section: when-to-research -->
### When to Research (External Knowledge)

**1. Error messages you don't recognize**
- Stack traces from unfamiliar libraries, cryptic system errors
- **Action:** Web search exact error message in quotes

**2. Library/framework behavior doesn't match expectations**
- Using library correctly but it's not working, docs contradict behavior
- **Action:** Check official docs (Context7), GitHub issues

**3. Domain knowledge gaps**
- Debugging auth: need to understand OAuth flow. Debugging database: need to understand indexes.
- **Action:** Research the domain concept, not just the specific bug

**4. Platform-specific behavior**
- Works in Chrome but not Safari, works on Mac but not Windows
- **Action:** Research platform differences, compatibility tables

**5. Recent ecosystem changes**
- Package update broke something, new framework version behaves differently
- **Action:** Check changelogs, migration guides
<!-- /section -->

<!-- section: when-to-reason -->
### When to Reason (Your Code)

**1. Bug is in YOUR code** — Your business logic, data structures, code you wrote. Read, trace, add logging.

**2. You have all information needed** — Bug reproducible, can read all relevant code. Use investigation techniques.

**3. Logic error (not knowledge gap)** — Off-by-one, wrong conditional, state management. Trace logic carefully.

**4. Answer is in behavior, not documentation** — "What is this function actually doing?" Add logging, test with different inputs.
<!-- /section -->

<!-- section: how-to-research -->
### How to Research Effectively

**Web Search:** Use exact error messages in quotes. Include version info. Add "github issue" for known bugs.

**Context7 MCP:** For API reference, library concepts, function signatures.

**GitHub Issues:** When experiencing what seems like a library bug. Check both open and closed.

**Official Documentation:** Understanding correct behavior. Version-specific docs.
<!-- /section -->

<!-- section: decision-tree -->
### Decision Tree

```
Error message you don't recognize?
├─ YES → Web search the error message
└─ NO ↓

Library/framework behavior you don't understand?
├─ YES → Check docs (Context7 or official)
└─ NO ↓

Code you/your team wrote?
├─ YES → Reason through it (logging, tracing, hypothesis testing)
└─ NO ↓

Platform/environment difference?
├─ YES → Research platform-specific behavior
└─ NO ↓

Can you observe the behavior directly?
├─ YES → Add observability and reason through it
└─ NO → Research the domain/concept first, then reason
```
<!-- /section -->

<!-- section: balance-indicators -->
### Balance Indicators

**Researching too much if:**
- Read 20 blog posts but haven't looked at your code
- Understand theory but haven't traced actual execution
- Reading for 30+ minutes without testing anything

**Reasoning too much if:**
- Staring at code for an hour without progress
- Keep finding unknowns and guessing instead of looking them up
- Debugging library internals (that's research territory)

**Doing it right if:**
- Alternating between research and reasoning
- Each research session answers a specific question
- Each reasoning session tests a specific hypothesis
- Making steady progress toward understanding

**Balance strategy:**
1. Start with quick research (5-10 min) — search error, check docs
2. If no answers, switch to reasoning — add logging, trace execution
3. If reasoning reveals gaps, research those specific gaps
4. Alternate as needed
<!-- /section -->

## Cross-references

- <skill:research-patterns /> — General research methodology (not debugging-specific)

## Examples

See debugger agent's `<research_vs_reasoning>` section for the original comprehensive reference.
