---
name: verification-reference
description: Verification patterns for checking artifact implementation quality — existence/substantive/wired/functional verification levels, stub detection patterns, artifact-type checklists (components, API routes, schemas, hooks, env vars), wiring verification, and automated verification scripting.
type: shared
agents: [verifier, executor, plan-checker]
sections: [core-principle, stub-detection, artifact-verification, wiring-verification, checklists, automated-script, human-triggers]
---

## Purpose

Verifies that code artifacts are real implementations, not stubs or placeholders. "Existence ≠ Implementation" — a file existing doesn't mean the feature works. This skill provides the four-level verification framework (exists, substantive, wired, functional) and artifact-specific patterns for detecting stubs.

## Placeholders

| Placeholder | Description | Example |
|-------------|-------------|---------|
| (none) | This skill uses no placeholders | — |

## Content

<!-- section: core-principle -->
### Core Principle: Existence ≠ Implementation

Verification must check four levels:
1. **Exists** — File is present at expected path
2. **Substantive** — Content is real implementation, not placeholder
3. **Wired** — Connected to the rest of the system
4. **Functional** — Actually works when invoked

Levels 1-3 can be checked programmatically. Level 4 often requires human verification.
<!-- /section -->

<!-- section: stub-detection -->
### Universal Stub Patterns

**Comment-based stubs:**
```bash
grep -E "(TODO|FIXME|XXX|HACK|PLACEHOLDER)" "$file"
grep -E "implement|add later|coming soon|will be" "$file" -i
```

**Placeholder text:**
```bash
grep -E "placeholder|lorem ipsum|coming soon|under construction" "$file" -i
grep -E "sample|example|test data|dummy" "$file" -i
```

**Empty implementations:**
```bash
grep -E "return null|return undefined|return \{\}|return \[\]" "$file"
grep -E "pass$|\.\.\.|\bnothing\b" "$file"
```

**Hardcoded values where dynamic expected:**
```bash
grep -E "id.*=.*['\"].*['\"]" "$file"
grep -E "\\\$\d+\.\d{2}|\d+ items" "$file"
```
<!-- /section -->

<!-- section: artifact-verification -->
### Artifact-Type Verification

**React Components:**
- Existence: file exists, exports component
- Substantive: returns JSX (not null/empty), has meaningful content, uses props/state
- Wired: imports resolve, props used, API calls exist for data components
- Red flags: `return <div>Placeholder</div>`, `onClick={() => {}}`

**API Routes:**
- Existence: file exists, exports HTTP handlers
- Substantive: >10-15 lines, interacts with data source, has error handling
- Wired: imports DB client, uses request body, validates input
- Red flags: `return Response.json({ message: "Not implemented" })`

**Database Schema:**
- Existence: schema file exists, model/table defined
- Substantive: has expected fields (not just id), has relationships, appropriate types
- Wired: migrations exist and applied, client generated
- Red flags: `model User { id String @id // TODO: add fields }`

**Hooks/Utilities:**
- Existence: file exists, exports function
- Substantive: uses React hooks (for custom hooks), meaningful return value, >10 lines
- Wired: imported and called somewhere in app
- Red flags: `return { user: null, login: () => {}, logout: () => {} }`

**Environment Variables:**
- Existence: .env file exists, variable defined
- Substantive: has real value (not placeholder)
- Wired: used in code (`process.env.VAR_NAME`), in validation schema
- Red flags: `DATABASE_URL=your-database-url-here`
<!-- /section -->

<!-- section: wiring-verification -->
### Wiring Verification

**Component → API:** Does component actually call the API? Check for fetch/axios call, verify response is used.

**API → Database:** Does API route query the database? Check for query, verify result is returned (not static response).

**Form → Handler:** Does form submission do something? Check onSubmit has content beyond `preventDefault`.

**State → Render:** Does component render state, not hardcoded content? Check for `.map()` over state, variable interpolation in JSX.
<!-- /section -->

<!-- section: checklists -->
### Quick Verification Checklists

**Component:** File exists → exports component → returns JSX → no placeholders → uses props/state → handlers implemented → imports resolve → used in app.

**API Route:** File exists → exports handlers → >5 lines → queries DB → returns meaningful response → has error handling → validates input → called from frontend.

**Schema:** Model defined → has all fields → appropriate types → relationships → migrations → client generated.

**Wiring:** Component→API call exists → API→DB query exists → Form→Handler has logic → State→Render uses variables.
<!-- /section -->

<!-- section: automated-script -->
### Automated Verification Pattern

```bash
check_exists() {
  [ -f "$1" ] && echo "EXISTS: $1" || echo "MISSING: $1"
}

check_stubs() {
  local stubs=$(grep -c -E "TODO|FIXME|placeholder|not implemented" "$1" 2>/dev/null || echo 0)
  [ "$stubs" -gt 0 ] && echo "STUB_PATTERNS: $stubs in $1"
}

check_wiring() {
  grep -q "$2" "$1" && echo "WIRED: $1 → $2" || echo "NOT_WIRED: $1 → $2"
}

check_substantive() {
  local lines=$(wc -l < "$1" 2>/dev/null || echo 0)
  local has_pattern=$(grep -c -E "$3" "$1" 2>/dev/null || echo 0)
  [ "$lines" -ge "$2" ] && [ "$has_pattern" -gt 0 ] && echo "SUBSTANTIVE: $1" || echo "THIN: $1"
}
```

Run against each must-have artifact. Aggregate results into VERIFICATION.md.
<!-- /section -->

<!-- section: human-triggers -->
### When to Require Human Verification

**Always human:** Visual appearance, user flow completion, real-time behavior, external service integration, error message clarity, performance feel.

**Human if uncertain:** Complex wiring grep can't trace, dynamic behavior, edge cases, mobile responsiveness, accessibility.
<!-- /section -->

## Cross-references

- <skill:debugger-verification /> — Debugger's fix verification (different from artifact verification)

## Examples

See `references/verification-patterns.md` for the original 612-line reference with detailed code examples for each artifact type.
