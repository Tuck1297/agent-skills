---
name: lint-typecheck
description: Run ESLint and TypeScript compilation checks on frontend code. Use when validating code quality before commits.
globs: ["**/frontend/**/*.ts", "**/frontend/**/*.tsx"]
---

# Lint and Type Check

## Instructions
1. Navigate to frontend directory and run lint:
   ```bash
   cd frontend && npm run lint
   ```

2. Run TypeScript compilation check (no emit):
   ```bash
   cd frontend && npx tsc -b --noEmit
   ```

3. If errors are found:
   - List all errors with file locations
   - Offer to fix auto-fixable ESLint issues: `npm run lint -- --fix`
   - For TypeScript errors, identify the type mismatches

4. Report summary: X lint warnings, Y lint errors, Z type errors

## Examples
- "Run lint on the frontend"
- "Check for type errors"
- "Validate code before commit"

## Guardrails
- Run in read-only mode first; only apply `--fix` with user confirmation
- Do not modify tsconfig.json to suppress errors
- Report all issues before attempting fixes