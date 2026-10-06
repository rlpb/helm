# Changelog

All notable changes are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project follows
[Semantic Versioning](https://semver.org/).

## [Unreleased]

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

[Unreleased]: https://github.com/rlpb/helm/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/rlpb/helm/releases/tag/v0.1.0
