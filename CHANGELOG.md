# Changelog

All notable changes are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project follows
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.12.3] - 2026-10-06

### Changed

- **The research box is the plain field again**, like the others in the panel: native caret and native paste. The custom text area of 0.12.1 could not take a paste and moved the text when its caret blinked.

## [0.12.2] - 2026-10-06

### Added

- **Repositories with skills in subfolders, or a plugin without a catalog, can now be installed.** Helm reads the repository tree, writes a one-plugin catalog beside the Claude config and installs through it with the normal `claude plugin` commands, so the skills load like any other plugin. Checked against a real collection: the plugin installed and listed all its skills.

### Changed

- **A copy switched off beside an active twin of the same name is listed once**, in the counts and in the tool list.

### Removed

- **The Security dot and button above the prompt.** The scan result lives in the Status section of the Global tab, where it can be acted on.

## [0.12.1] - 2026-10-06

### Added

- **A real text area in "Find a new tool".** It wraps, grows with what you paste or type, and keeps line breaks, so a list with one name per line is read as a list. Enter adds a line, **Ctrl+Enter** or the search button looks, Clear empties it. Surfaces without a `Client` element keep the one-line field.
- **"Already installed".** A name in a pasted list that matches something you already have is marked as such and is not looked up or scanned again.

### Changed

- **A repository that is no skill or plugin is greyed, not red.** "Nothing Helm can install here" is not a danger, so it no longer reads as "do not install".
- **The scan ignores what Claude never loads.** Findings in CI config (`.github`), evaluation harnesses, editor config, and the repository's own README and install notes no longer count toward a verdict. A known-good skill that scored 100/100 because of its CI files now scores on its real files.

## [0.12.0] - 2026-10-06

### Added

- **Paste a whole text into "Find a new tool".** A list of links, `owner/name` entries and plain names (one per line or comma), with notes around them, is read as a list: each item is checked (a repository directly, a name by searching and taking the first hit that fits), scanned, and shown with its verdict, and **nothing is installed until you tick it and press the install button**. Two lines meaning the same repository install once; links that are not GitHub are listed as not supported. A text with no link or name in it is read once by the small model. A single link still gives the single verdict card.
- **Changes apply at once.** After installing, updating, removing, or switching a plugin, Helm asks Claude Code to reload plugins (`/reload-plugins`) and re-reads what is installed, so every list and bar in Helm changes immediately. If this build of Claude Code does not offer that command to a mod, the message says "Active from the next chat" instead of claiming otherwise.

### Changed

- **Status says only what was looked at.** A green mark now means the whole thing was checked and nothing is left to do:
  - *Security*: green only when every installed tool was scanned and none is flagged or under caution. Tools that timed out get a second, patient try; anything still unscanned is named. The dot above the prompt follows the same rule. New or changed tools are scanned in the background once a day.
  - *Updates*: every plugin is updated one by one (trying each scope) and the result of each is read: current, updated or failed, with the reason. Skill folders that are git checkouts are pulled too; skills with no source are counted, not hidden.
  - *Health*: beyond broken files it now suggests switching off tools that do the same job as another (it keeps the one you use more) and skills that were never used, with a one-press switch-off. "Never used" is judged only after two weeks of watching, until then the tile says it is still learning.
- **Better categories, automatically.** Two new categories (Science, Business) and a larger vocabulary sort what used to land in Other (lab, quantum and clinical tools; career and sales tools; Claude Code workflow tools); a tool whose name runs words together is read by the stems inside it. Nothing is set by hand: a new install is sorted from what it says about itself.

## [0.11.0] - 2026-10-06

### Changed

- **The Map tab is gone; its job moved into Project.** The top of the Project page now shows **what Claude used in this project**, by category: each tool with a bar for how often, the count and how long ago; a skill that has just run is lit. Global already lists every tool, so nothing is repeated.
- **Only this project.** Use is now counted per folder (`puses:<folder>`), so another project's activity never shows here. The count starts with this version: what was used before is not attributed to any folder, because it was never recorded per folder.
- The tab bar is two tabs, Project and Global.

### Fixed

- A fading glow or a refresh that was still running when a session ended could raise an unhandled error; both now stop quietly.

## [0.10.1] - 2026-10-06

### Changed

- Cleanup after the Map rebuild: the drawn-wheel code, its test and its picture are removed (the README now shows the real Map), nine phrases nobody reads are gone from all 16 languages, and the navigation state lost two fields it no longer used.
- The documentation now says what Helm really does: the Status section and its automatic health check, removal in any scope with the registry fallback and its backup, the other programs it runs (`skillspector`, `uv`), and the three-tab design with the card-based Map.

## [0.10.0] - 2026-10-06

### Changed

- **The Map is rebuilt from the panel's own elements.** The drawn wheel needed exact pixels and could not follow the window: dots overlapped, names were cut, a hover card ran off the edge. The Map is now one card per category, sized by how many tools it holds, each tool a dot: filled when on, a ring when off, a lit disc while Claude has just used it. The cards wrap and resize with the window, so nothing is cut or overlapped, and the same view serves the terminal and the desktop. Below it, the tools used most recently.
- The old wheel (SVG and character grid) is no longer drawn in the panel; it remains only for the README picture (`scripts/map.mjs`).

### Fixed

- **The limit bars follow the session.** They were read when a turn ended, so during a long turn they lagged behind the figures the app shows (32% against 35%). They are now read again after every tool call, at every prompt and while the row redraws during a turn, at most once every three seconds, and the row is only redrawn when a figure moved.
- **The security dot above the prompt turned grey forever** until a scan had finished, and a scan of 190 tools takes several minutes (the scanner needs about 8 seconds just to start). Each result now counts as soon as it arrives: the dot turns green, amber or red from the first result, shows `Security 12/190` while it runs, and a run that is cut short keeps what it found. Results are also saved every eight tools.

## [0.9.5] - 2026-10-06

### Changed

- **The Map changes shape with the panel.** Wide panels get a wide arrangement, narrow ones a taller and tighter one with smaller dots, down to about 360 pixels, instead of one wide picture shrunk to fit. The width follows the panel's own measure (a column is taken as 8 pixels).
- A small dim line under the map shows the measure it used (`cols · width×height`). If the map does not follow a resized panel, that line says whether the panel reported a new width or not.

## [0.9.4] - 2026-10-06

### Changed

- **The Map is drawn for the window it is in.** It was laid out on a fixed canvas and then shrunk to fit, which made the type and the dots about 25% too small to read. The picture is now laid out in real pixels for the width the panel has (a column is about 9 pixels), so names and dots keep their size, and it is laid out again when the panel is widened or opened full screen.
- **One quiet picker instead of eleven buttons.** The row of category buttons above the map is gone; a single **Zoom** menu next to the hint picks the whole map or one category.

## [0.9.3] - 2026-10-06

### Changed

- **Tools and skills: press a name to see what it is.** The hover card could not be made opaque (the engine does not paint a background behind an overlay) and the reserved gap under each list was empty space. Names are now buttons: press one and a card with its category, state, use count and description appears right under that list, as part of the page; press it again to hide it. Nothing is reserved when nothing is chosen.

## [0.9.2] - 2026-10-06

### Fixed

- **Removing a plugin works whatever its scope.** The command only removes a plugin from the scope it was installed in, and the default scope failed for plugins listed under another one ("Could not fix"). Helm now tries every scope, and if none works it takes the entry out of the plugin registry itself, keeping a copy next to it (`installed_plugins.json.helm-backup`). A failure is shown in red with the reason, not as a green check.
- **No white bars around the Map.** The frame behind the picture is white; the picture now paints the whole canvas itself, so a frame of any shape shows only the map.
- **The info on a tool no longer covers the list.** Hovering a name in Tools and skills shows its card in a fixed place under that category's list: nothing is overlaid, so nothing can show through.
- **Zooming the Map is clean.** A zoomed category shows bigger dots with their hover cards, without a wall of overlapping names.

### Known limit

- The mouse wheel cannot zoom the Map: the engine gives a mod no wheel or drag events, and the picture runs no script. Zoom is by category chips.

## [0.9.1] - 2026-10-06

### Fixed

- **Hover cards are opaque.** The card no longer lets the list show through: every line is painted on its own background.
- **Scanning no longer stalls.** Skills were scanned one at a time with a three minute limit each, so one huge plugin could hold the whole run on "1 of 192". Four are scanned at once, a tool that takes more than 45 seconds is skipped (and the summary says how many), and the count moves after every finished tool.
- **Nothing happens silently.** The top of the panel now shows what is under way with a mark (checking, removing, updating, scanning) and the result when it ends. A removal that fails says so there instead of in a footer below the fold, and a removed plugin disappears from the lists and the map at once.
- **Health checks itself** when a session starts and after every removal, so it is never "not checked". The button is now **Check again**.

### Changed

- **The Map has focus chips.** Press a category to zoom on its cluster, with every tool in it named; press **Whole map** to go back. The picture is drawn at a fixed larger size instead of the small default.

## [0.9.0] - 2026-10-06

### Changed

- **The Map is only a map.** A dark canvas with a slow ripple from the middle, pulsing category hubs, curved spokes, and every tool as a dot: filled when on, a ring when off, named when Claude used it. **Hover a dot** and a card shows what it is, its category, whether it is on, and how often it was used. The inspector is gone. Big and small categories alternate around the wheel and each gets room for its size, so clusters no longer overlap.
- **Tools and skills in Global show a card on hover** with the name, category, state, use count and what the tool does.
- **A tidier Status section:** three equal tiles that fill the width, buttons pinned to the bottom of each, plain buttons instead of white ones, and "Not checked yet" instead of a stray dot.

### Fixed

- **A tool is offered for a prompt only when the prompt names it** (a word of its name) and a second word fits. Long descriptions matched almost any prompt, which is why Claude SEO kept being suggested.

## [0.8.1] - 2026-10-06

### Fixed

- The panel said "undefined is not an object (evaluating 'n.open.length')" in a session that was already open when Helm updated: the saved navigation state predates the folded categories. A missing value now means nothing is open.

## [0.8.0] - 2026-10-06

### Changed

- **A calmer, clearer panel.** The panel no longer says Helm in its own header: the window already does. The row above the prompt starts with a small helm mark and the project.
- **Project** is one page: describe, shortlist, GitHub baseline and the search box stacked, no Setup / Discover switch.
- **Global** starts with the search for a new tool, then a **Status** section (Health, Updates and Security side by side with one verdict on top), what you use most, and every tool and skill below, folded by category. Each category opens to its whole list, and one button opens or closes them all.
- **Map** is drawn on its own dark card with curved spokes, a count per category, filled dots for tools that are on and rings for those that are off, and the names of what Claude used. It no longer shows on a white sheet.

## [0.7.3] - 2026-10-06

### Fixed

- **A wrong suggestion.** "Claude SEO is off and fits this" appeared for any prompt that said "claude", because the word is in the tool's name. Words every tool shares ("claude", "code", "plugin", "skill"...) no longer count, and a hint now needs two different words of the prompt to hit, not one.
- **The Map no longer takes the panel down.** The inspector listed every installed tool in one picker (190 or more on a full setup); it now lists one category at a time, picked from the legend, and a failure while drawing the map is reported in the panel instead of an empty pane.

### Changed

- **The new-project notice says Helm once** and no longer repeats the project name: `Helm  New project "shop". Set it up?`
- **A chat already under way is joined, not set up from zero.** When the session already has a conversation, the notice reads `"shop" is already under way. Read the folder and suggest tools?`; **Read it** looks at the folder's files and `package.json` / README, shortlists the fitting tools and opens Setup with them.

## [0.7.2] - 2026-10-06

### Fixed

- **The panel drew nothing** in the desktop app ("Nothing to show yet"). Two elements shared a key (a card and a button named `ask`, another pair `gh`), and the engine refuses a tree with a repeated key. Every box now has its own prefixed key, and a test walks every tab and state on the terminal and the desktop surface and fails on any repeat.
- If the panel ever cannot be drawn, it now says why instead of leaving the pane empty.
- The row above the prompt no longer reads "Helm Helm" in a folder called Helm: it is `Helm › project`.

## [0.7.1] - 2026-10-06

### Changed

- **A calmer verdict.** SkillSpector scores harshly: on a real setup of 168 skills it said "do not install" to 46, almost all because of long docs and forms. Helm now blocks an installation, and lists a skill under Security, only for **one critical finding or three high ones** outside tests and docs. A lesser "do not install" stays a caution with its findings. The security dot is red for a blocking skill, amber for a lesser one, green when clean.

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

[Unreleased]: https://github.com/rlpb/helm/compare/v0.12.3...HEAD
[0.12.3]: https://github.com/rlpb/helm/compare/v0.12.2...v0.12.3
[0.12.2]: https://github.com/rlpb/helm/compare/v0.12.1...v0.12.2
[0.12.1]: https://github.com/rlpb/helm/compare/v0.12.0...v0.12.1
[0.12.0]: https://github.com/rlpb/helm/compare/v0.11.0...v0.12.0
[0.11.0]: https://github.com/rlpb/helm/compare/v0.10.1...v0.11.0
[0.10.1]: https://github.com/rlpb/helm/compare/v0.10.0...v0.10.1
[0.10.0]: https://github.com/rlpb/helm/compare/v0.9.5...v0.10.0
[0.9.5]: https://github.com/rlpb/helm/compare/v0.9.4...v0.9.5
[0.9.4]: https://github.com/rlpb/helm/compare/v0.9.3...v0.9.4
[0.9.3]: https://github.com/rlpb/helm/compare/v0.9.2...v0.9.3
[0.9.2]: https://github.com/rlpb/helm/compare/v0.9.1...v0.9.2
[0.9.1]: https://github.com/rlpb/helm/compare/v0.9.0...v0.9.1
[0.9.0]: https://github.com/rlpb/helm/compare/v0.8.1...v0.9.0
[0.8.1]: https://github.com/rlpb/helm/compare/v0.8.0...v0.8.1
[0.8.0]: https://github.com/rlpb/helm/compare/v0.7.3...v0.8.0
[0.7.3]: https://github.com/rlpb/helm/compare/v0.7.2...v0.7.3
[0.7.2]: https://github.com/rlpb/helm/compare/v0.7.1...v0.7.2
[0.7.1]: https://github.com/rlpb/helm/compare/v0.7.0...v0.7.1
[0.7.0]: https://github.com/rlpb/helm/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/rlpb/helm/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/rlpb/helm/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/rlpb/helm/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/rlpb/helm/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/rlpb/helm/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/rlpb/helm/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/rlpb/helm/releases/tag/v0.1.0
