# 75create

## Agent skills

### Issue tracker

GitHub Issues on `gr8monk3ys/75create`, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical roles, label string equal to role name. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Checks

`bun run check` runs lint, typecheck, dependency boundaries (`.dependency-cruiser.cjs`: `src/lib` never imports UI, no cycles) and tests. A pre-commit hook (simple-git-hooks) runs staged lint and typecheck.
