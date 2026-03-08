---
name: goal-backward
description: Goal-backward verification methodology — deriving observable truths, required artifacts, wiring connections, and key links from a stated goal. Used to create must-haves for plans and verify phase achievement.
type: shared
agents: [planner, verifier, plan-checker, roadmapper]
---

## Purpose

Goal-backward thinking inverts the planning/verification process: instead of asking "What should we build?" (forward planning), it asks "What must be TRUE for the goal to be achieved?" This produces requirements that tasks must satisfy, not just tasks to execute. The methodology is used by:

- **Planner:** Derives must-haves (truths, artifacts, key_links) for each plan
- **Verifier:** Validates the codebase delivers what the phase promised
- **Plan-checker:** Confirms plans will achieve the goal before execution
- **Roadmapper:** Creates success criteria for each phase

## Placeholders

| Placeholder | Description | Example |
|---|---|---|

## Content

### The 5-Step Process

**Step 0: Extract Requirement IDs** (planner only)

Read ROADMAP.md `**Requirements:**` line for the phase. Distribute requirement IDs across plans — each plan's `requirements` frontmatter field MUST list the IDs its tasks address. Every requirement ID MUST appear in at least one plan.

**Step 1: State the Goal**

Take the phase goal from ROADMAP.md. The goal must be outcome-shaped, not task-shaped.

| Shape | Example | Quality |
|---|---|---|
| Outcome | "Working chat interface" | Good |
| Task | "Build chat components" | Bad |
| Outcome | "Users can authenticate and access protected content" | Good |
| Task | "Implement authentication" | Bad |

**Step 2: Derive Observable Truths**

Ask: "What must be TRUE for this goal to be achieved?" List 3-7 truths from the USER's perspective.

For "working chat interface":
- User can see existing messages
- User can type a new message
- User can send the message
- Sent message appears in the list
- Messages persist across page refresh

**Test:** Each truth must be verifiable by a human using the application. If you can't observe it, it's not a truth — it's an assumption.

**Step 3: Derive Required Artifacts**

For each truth, ask: "What must EXIST for this to be true?"

"User can see existing messages" requires:
- Message list component (renders Message[])
- Messages state (loaded from somewhere)
- API route or data source (provides messages)
- Message type definition (shapes the data)

**Test:** Each artifact = a specific file or database object. Not abstract concepts.

**Step 4: Derive Required Wiring**

For each artifact, ask: "What must be CONNECTED for this to function?"

Message list component wiring:
- Imports Message type (not using `any`)
- Receives messages prop or fetches from API
- Maps over messages to render (not hardcoded)
- Handles empty state (not just crashes)

This is where stubs hide. An artifact can exist but do nothing if it isn't wired correctly.

**Step 5: Identify Key Links**

Ask: "Where is this most likely to break?" Key links are critical connections where breakage causes cascading failures.

For chat interface:
- Input onSubmit -> API call (if broken: typing works but sending doesn't)
- API save -> database (if broken: appears to send but doesn't persist)
- Component -> real data (if broken: shows placeholder, not actual messages)

### Must-Haves Output Format

```yaml
must_haves:
  truths:
    - "User can see existing messages"
    - "User can send a message"
    - "Messages persist across refresh"
  artifacts:
    - path: "src/components/Chat.tsx"
      provides: "Message list rendering"
      contains: "model Message"
    - path: "src/app/api/chat/route.ts"
      provides: "Message CRUD operations"
      exports: ["GET", "POST"]
  key_links:
    - from: "src/components/Chat.tsx"
      to: "/api/chat"
      via: "fetch in useEffect"
      pattern: "fetch.*api/chat"
    - from: "src/app/api/chat/route.ts"
      to: "prisma.message"
      via: "database query"
      pattern: "prisma\\.message\\.(find|create)"
```

### Common Failures

**Truths too vague:**
- Bad: "User can use chat" (what does "use" mean?)
- Good: "User can see messages", "User can send message", "Messages persist"

**Artifacts too abstract:**
- Bad: "Chat system", "Auth module" (not files)
- Good: "src/components/Chat.tsx", "src/app/api/auth/login/route.ts"

**Missing wiring:**
- Bad: Listing components without how they connect
- Good: "Chat.tsx fetches from /api/chat via useEffect on mount"

**Key links too broad:**
- Bad: "Frontend connects to backend" (everything does)
- Good: "Input onSubmit triggers POST to /api/chat with message body"

### Verification Approach (verifier/plan-checker)

For each truth, determine if the codebase enables it:
- **VERIFIED:** All supporting artifacts pass all checks
- **FAILED:** One or more artifacts missing, stub, or unwired
- **UNCERTAIN:** Can't verify programmatically (needs human)

Three-level artifact verification:
1. **Exists:** File is present on disk
2. **Substantive:** File has real implementation (not placeholder/stub)
3. **Wired:** File is imported and used by other code

## Cross-references

- <skill:structured-returns /> — Must-haves feed into structured return formats
- <skill:checkpoint-protocol /> — Verification failures may trigger checkpoints

## Examples

**Planner creating must-haves for an auth phase:**
```yaml
must_haves:
  truths:
    - "User can register with email and password"
    - "User can log in with valid credentials"
    - "Invalid credentials are rejected with 401"
    - "Authenticated user can access protected routes"
    - "Unauthenticated user is redirected to login"
  artifacts:
    - path: "src/app/api/auth/login/route.ts"
      provides: "Login endpoint"
      exports: ["POST"]
    - path: "src/middleware.ts"
      provides: "Route protection"
      contains: "matcher"
  key_links:
    - from: "src/middleware.ts"
      to: "src/lib/auth.ts"
      via: "JWT verification"
      pattern: "verifyToken|jwtVerify"
```

**Verifier checking an artifact:**
```
Artifact: src/app/api/auth/login/route.ts
  Level 1 (Exists): FOUND
  Level 2 (Substantive): 45 lines, exports POST handler, contains bcrypt.compare
  Level 3 (Wired): Imported by 0 files (API routes are called by URL, not import — WIRED via fetch)
  Status: VERIFIED
```
