# Changelog

All notable changes are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project follows
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.7.0] - 2026-10-06

### Added

- **A security dot above the prompt:** green when the last scan was clean, amber for cautions, red for a "do not install", dim when nothing was scanned yet. Next to it, **Security** (with the number flagged) opens the Global tab.

### Changed

- **Scan skills** no longer scans a folder that did not change since its last scan, so the second run is fast. The results are kept between sessions.

## [0.6.0] - 2026-10-06

### Added

- **Security scanning with [SkillSpector](https://github.com/NVIDIA/SkillSpector) (NVIDIA, Apache-2.0).** A **Security** tile in Global with a **Scan skills** button that checks every installed plugin and own skill for prompt injection, data theft and risky code, lists what is flagged with the worst finding, and switches a skill off or on again in one press.
- **Every new tool is scanned before it can be installed.** The result joins the verdict: a clean scan changes nothing, a caution is shown with its findings, and a "do not install" hides the Install button. Only when the scanner alone said no, **Install anyway** appears and needs a second press. Findings that sit only in tests, docs or examples do not count against a tool.
- SkillSpector is installed on a yes (`uv tool install`), updated by **Update all** and once a week on its own. It always runs static-only (`--no-llm`): no model, no API key, nothing leaves the computer.
- Twenty-four new phrases in all 16 languages.

## [0.5.0] - 2026-10-06

### Added

- **16 languages** (English, Italiano, Español, Français, Deutsch, Português, Nederlands, Русский, 中文, 日本語, 한국어, हिन्दी, العربية, Türkçe, Polski, Bahasa Indonesia). The panel follows the computer's language and a picker in the footer changes it; the choice is kept.
- **Limits in the bar:** the 5-hour and weekly limits and the context, as small bars above the prompt that turn amber and red as they fill.
- **Usage history:** how often and when each tool was used, kept privately on your computer.
- **Map:** names on the skills that were used, a "used recently" list and an inspector with what each skill does, how often and when it ran.

### Changed

- **Project** is split into **Setup** (describe, pick, turn on, GitHub baseline, in numbered cards) and **Discover** (find a new tool).
- **Global** is a dashboard: health, updates, most used and what was added for one project as tiles, then every tool by category in colored cards.
- Checkboxes and symbols are plain marks (✓ ○ ●) instead of brackets.

## [0.4.0] - 2026-10-06

### Added

- A resting row above the prompt, always there: the project, how many tools are on, the skill Claude just used, and an **Open Helm** button. The panel is one press away without typing `/helm`.

## [0.3.0] - 2026-10-06

### Changed

- The panel is redrawn: a header with the project and counts, tabs with the current one highlighted, small-caps section titles, the shortlist as rows with a status dot, the main action in the accent color, the verdict in a card colored by its level, and categories as one quiet line. The panel is now one view (`src/views/panel.tsx`) that never touches the engine.

## [0.2.0] - 2026-10-06

### Changed

- A new look: a banner made from generated art with real type set over it, one card per feature around the real panel, an animated demo, and a Map that loops (`scripts/brand.mjs`, `scripts/gif.py`, `scripts/map.mjs`).
- A hint above the prompt when an off tool fits what you just typed: turn it on for this session, for this project, or say No (remembered per folder).
- "Refine with a small model": one call over the shortlist, with its size shown before and the real use after.
- No personal example data in the screenshots, tests or placeholders.

## [0.1.1] - 2026-10-06

### Changed

- The GitHub items sit in one wrapped row instead of one per line, and the category counts hide while a shortlist, a verdict or search results are shown.
- "Turn on for this project" appears only when a shortlisted tool is still off.

### Added

- Screenshots of the real panel in the README, drawn from made-up data by `scripts/shots.mjs`.

## [0.1.0] - 2026-10-06

First release.

### Added

- An index of every installed plugin and own skill, sorted into categories, read from the Claude
  Code configuration folder.
- A notice above the prompt in a folder Helm has not seen: Open, or Not here (remembered per folder).
- A **Project** tab: describe what you are building and Helm shortlists the fitting tools from what is
  installed. One press turns them on for that folder only (its own `settings.local.json`); Undo restores
  the file exactly.
- A **Global** tab: *Tidy up* reports plugins whose files are gone, skill folders without a `SKILL.md`,
  skills without a description and duplicate names, with one guarded fix; *Update all* updates every
  plugin. Neither touches a project's own settings.
- A research box in both tabs: paste a GitHub link, `owner/name` or a name. Helm reads the repository
  (license, archive flag, last update, stars, plugin catalog or `SKILL.md`), gives a verdict and installs
  only after a yes. A tool installed for one project is offered later for all.
- A **Map** tab: an animated graph of everything installed, with a dot lighting up when Claude uses the
  skill. SVG on desktop, editor and phone; colored cells in the terminal. It costs no tokens.
- A GitHub baseline checkbox, shown only when a GitHub connector is available: pick a license and the
  items (README, CI, `SECURITY.md`, Dependabot, branch protection and more); a short brief rides once on
  the first prompt of the project.

[Unreleased]: https://github.com/rlpb/helm/compare/v0.7.0...HEAD
[0.7.0]: https://github.com/rlpb/helm/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/rlpb/helm/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/rlpb/helm/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/rlpb/helm/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/rlpb/helm/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/rlpb/helm/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/rlpb/helm/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/rlpb/helm/releases/tag/v0.1.0
