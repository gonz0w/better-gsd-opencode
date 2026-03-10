---
name: questioning
description: Collaborative questioning methodology for project initialization — dream extraction philosophy, question types (motivation, concreteness, clarification, success), context checklist, decision gates, and anti-patterns to avoid during user questioning.
type: shared
agents: [planner, roadmapper, debugger]
sections: [philosophy, question-types, context-checklist, decision-gate, anti-patterns]
---

## Purpose

Project initialization is dream extraction, not requirements gathering. The agent helps users discover and articulate what they want to build. This isn't a contract negotiation — it's collaborative thinking. The goal is a PROJECT.md clear enough for downstream phases to act on without guessing.

## Placeholders

| Placeholder | Description | Example |
|-------------|-------------|---------|
| (none) | This skill uses no placeholders | — |

## Content

<!-- section: philosophy -->
### Philosophy

**You are a thinking partner, not an interviewer.**

The user often has a fuzzy idea. Help them sharpen it. Ask questions that make them think "oh, I hadn't considered that" or "yes, that's exactly what I mean."

Don't interrogate. Collaborate. Don't follow a script. Follow the thread.

A vague PROJECT.md forces every downstream phase to guess. The cost compounds:
- **Research** needs to know what domain to research
- **Requirements** needs clear enough vision to scope v1
- **Roadmap** needs clear enough vision to decompose into phases
- **plan-phase** needs specific requirements to break into tasks
- **execute-phase** needs success criteria to verify against
<!-- /section -->

<!-- section: question-types -->
### Question Types

Use as inspiration, not a checklist. Pick what's relevant to the thread.

**Motivation — why this exists:**
- "What prompted this?"
- "What are you doing today that this replaces?"
- "What would you do if this existed?"

**Concreteness — what it actually is:**
- "Walk me through using this"
- "You said X — what does that actually look like?"
- "Give me an example"

**Clarification — what they mean:**
- "When you say Z, do you mean A or B?"
- "You mentioned X — tell me more"

**Success — how you'll know:**
- "How will you know this is working?"
- "What does done look like?"

**Presenting options to react to:**
- Interpretations of what they might mean
- Specific examples to confirm or deny
- Concrete choices that reveal priorities
- 2-4 options (not too many)
<!-- /section -->

<!-- section: context-checklist -->
### Context Checklist

Background checklist — not a conversation structure. Check mentally as you go:

- [ ] What they're building (concrete enough to explain to a stranger)
- [ ] Why it needs to exist (the problem or desire)
- [ ] Who it's for (even if just themselves)
- [ ] What "done" looks like (observable outcomes)

Four things. If they volunteer more, capture it.
<!-- /section -->

<!-- section: decision-gate -->
### Decision Gate

When you could write a clear PROJECT.md, offer to proceed:

- "I think I understand what you're after. Ready to create PROJECT.md?"
- Options: "Create PROJECT.md" or "Keep exploring"

If "Keep exploring" — ask what they want to add or identify gaps and probe naturally. Loop until ready.
<!-- /section -->

<!-- section: anti-patterns -->
### Anti-Patterns

- **Checklist walking** — Going through domains regardless of what they said
- **Canned questions** — "What are your success criteria?" regardless of context
- **Corporate speak** — "Who are your stakeholders?"
- **Interrogation** — Firing questions without building on answers
- **Rushing** — Minimizing questions to get to "the work"
- **Shallow acceptance** — Taking vague answers without probing
- **Premature constraints** — Asking about tech stack before understanding the idea
- **User skills** — NEVER ask about user's technical experience. The agent builds.
<!-- /section -->

## Cross-references

- <skill:research-patterns /> — Research methodology follows questioning

## Examples

See `references/questioning.md` for the original 145-line reference with detailed option-presenting patterns.
