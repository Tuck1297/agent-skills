---
description: "Update changelog from staged changes and draft a commit message for review"
argument-hint: "[optional context about the changes]"
---

# Changelog + Commit

Analyzes staged changes, updates CHANGELOG.md, and drafts a commit message for user review.

## Context

- Current branch: !`git branch --show-current`
- Staged changes summary: !`git diff --cached --stat`
- Staged diff: !`git diff --cached`
- Recent commits (for style reference): !`git log --oneline -5`
- User context: $ARGUMENTS

---

## Step 1: Validate Staged Changes

If `git diff --cached --stat` is empty, tell the user there are nothing staged and stop. Suggest they stage files first with `git add`.

---

## Step 2: Analyze Staged Changes

Review the staged diff to understand:
- What was added, changed, fixed, or removed
- Which files and areas of the codebase are affected
- The intent behind the changes (use $ARGUMENTS for additional context if provided)

---

## Step 3: Update CHANGELOG.md

### If CHANGELOG.md does not exist

1. Create it using [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format
2. Add entries under `## [Unreleased]` based on the staged changes

### If CHANGELOG.md exists

1. Read the existing file
2. Add new entries under `## [Unreleased]` (create this section if missing)
3. Categorize changes into the appropriate sections:
   - **Added**: New features or capabilities
   - **Changed**: Changes to existing functionality
   - **Fixed**: Bug fixes
   - **Removed**: Removed features or deprecated items

### Changelog Rules

- Write clear, human-readable descriptions (not raw file paths or code)
- Group related changes into single entries
- Keep entries concise: one line per change
- Only include sections that have entries (don't add empty sections)
- Present the draft to the user for review before writing

---

## Step 4: Stage the Changelog

After the user approves the changelog update:

```bash
git add CHANGELOG.md
```

---

## Step 5: Draft Commit Message

Based on ALL staged changes (including the updated changelog), draft a commit message:

- Use conventional commit format: `<type>(<scope>): <short description>`
- Types: feat, fix, refactor, docs, style, test, chore
- Include a body if the changes warrant explanation
<!-- agent: claude -->
- Always include `Co-Authored-By: Claude <noreply@anthropic.com>`
<!-- /agent -->

Present the commit message for user review. **Do not commit until the user approves.**

---

## Step 6: Commit

Once the user approves (or edits) the message, create the commit:

```bash
git commit -m "$(cat <<'EOF'
<approved message>
<!-- agent: claude -->

Co-Authored-By: Claude <noreply@anthropic.com>
<!-- /agent -->
EOF
)"
```

---

## Rules

1. **Never commit without user approval** of both changelog and commit message
2. **Never stage additional files** beyond CHANGELOG.md — only work with what the user already staged
3. **Human-readable changelog entries** — describe the change, not the file
4. **Match existing commit style** from recent history when possible
5. **If no staged changes exist, stop immediately** — don't proceed
