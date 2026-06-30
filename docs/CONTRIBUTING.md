# Contributing to StockFlow vNext

StockFlow is a React 19 + TypeScript + Supabase application. This guide covers the workflow and quality gates expected for every contribution.

## Prerequisites

- Node.js `24.16.0` (use `.nvmrc`)
- npm 10+
- Optional: Supabase CLI for local database work

## Setup

```bash
nvm use
npm install --legacy-peer-deps
cp .env.example .env.local
```

## Branching model

- `main` is the production branch.
- Create feature branches from `main`: `git checkout -b feature/<short-desc>`.
- For security fixes use `security/<short-desc>`.

## Quality gates

Run these locally before pushing:

```bash
npm run lint
npm run format:check
npm run test
npm run build
```

Husky runs `lint-staged` on pre-commit. CI runs lint, unit tests, E2E tests, audit and build.

## Commit messages

Use conventional style:

- `feat:` new feature
- `fix:` bug fix
- `security:` security hardening
- `chore:` tooling, deps, docs
- `refactor:` code change without behavior change

## Edge Functions

Deno Edge Functions live under `supabase/functions/`. Keep them stateless, rate-limit public endpoints and log sensitive actions to `activity_logs`.

## Opening a pull request

- Link the related ticket (SF-NNN)
- Describe what changed and why
- Ensure CI is green
- Request review from a maintainer
