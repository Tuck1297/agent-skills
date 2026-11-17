# Agent skills

Skills, subagents and slash commands for **Claude Code**, **Gemini CLI and Antigravity**, and **Codex**. Each is written once and installed in each agent's own format, so the same skill works in all of them.

## Install

You need [Node.js](https://nodejs.org) 18 or later and Git (on Windows, run these in Git Bash).

```bash
git clone https://github.com/Tuck1297/agent-skills.git
cd agent-skills
./install.sh                    # everything, for every agent
./install.sh --agent gemini     # one agent: claude, gemini or codex (or claude,codex)
./install.sh <name> <name>      # only the skills you name
./install.sh --list             # what's here and which agents get it
```

Update later with `git pull` and `./install.sh --replace`. Without `--replace`, installed files you've edited are left alone. `--dry-run` shows what would change.

Where it installs:

| Agent | Skills | Guides |
| --- | --- | --- |
| Claude Code | `~/.claude/skills` (subagents in `~/.claude/agents`, commands in `~/.claude/commands`) | `~/.claude/guides` |
| Gemini CLI and Antigravity | `~/.gemini/skills` and `~/.gemini/config/skills` | `~/.gemini/antigravity/guides` |
| Codex | `~/.codex/skills` | `~/.codex/guides` |

Claude Code's subagents and slash commands become skills for Gemini and Codex, which run them the same way.

## What's here

<!-- skills:start -->
| Name | Kind | What it does |
| --- | --- | --- |
| [html-slides](skills/html-slides) | Skill | Makes presentation decks from a prompt as ONE self-contained interactive HTML file (its own slide engine with click builds, motion-graphic transitions, presenter view, live data and clickable app demos) and/or a PowerPoint (.pptx) that plays the same slides, steps and transitions. |
<!-- skills:end -->

## How one source becomes each agent's version

Every skill is written in Claude Code's format: `skills/<name>/SKILL.md` with its scripts, references and assets beside it, `agents/<name>.md`, `commands/<name>.md`, and the shared `guides/`, `scripts/` and `templates/` they read. `tools/install.mjs` makes each agent's version as it installs:

- paths into Claude's folders become that agent's (`~/.claude/guides/x.md` becomes `~/.codex/guides/x.md`);
- "Claude Code" and `CLAUDE.md` become the agent's name and instructions file, and Claude's model names become the agent's;
- text for some agents only sits between `<!-- agent: gemini, codex -->` and `<!-- /agent -->`, and `<!-- as-is -->` … `<!-- /as-is -->` keeps paths as written.

`tools/agents.json` holds the folders, names and models for each agent. Scripts, images and other files are copied unchanged.

## License

[MIT](LICENSE)
