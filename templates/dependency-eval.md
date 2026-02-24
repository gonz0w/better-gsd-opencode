# Dependency Evaluation: [package-name]

## Assessment Criteria
- **Bundle impact:** [size in KB after bundling via esbuild]
- **Token impact:** [estimated tokens added to workflow context]
- **License:** [MIT/Apache-2.0/etc — must be compatible]
- **Maintenance:** [active/stale/abandoned — check last commit, open issues]
- **Alternatives:** [what native Node.js alternatives exist]
- **Tree-shakeable:** [yes/no — does esbuild eliminate unused exports]

## Decision
- **Include?** [Yes/No]
- **Rationale:** [why this dependency is or isn't worth the cost]

## Constraints Check
- [ ] Zero runtime dependency constraint honored (bundled via esbuild only)
- [ ] Bundle stays under 400KB budget
- [ ] Node.js 18+ compatible
