# Contributing to Helm

Thanks for taking a look. Issues, ideas and pull requests are all welcome.

## Getting set up

You need Claude Code **2.1.289 or newer** and Node 22 for the scripts. There is
no build step and no dependency to install: a mod is TypeScript that Claude Code
loads as it is.

```bash
git clone https://github.com/rlpb/helm
cd helm
claude plugin validate .claude-plugin/plugin.json
claude plugin test .
```

To try your changes in a real session:

```bash
claude --plugin-dir .
```

## The one rule that shapes the code

A mod may not pass the engine handle `$` to anything but a function declared at the top of
`hooks/register.tsx`, nor return or bind it. `claude plugin validate` rejects the rest. So the code
is split on purpose:

- `hooks/register.tsx` holds every effect: reading files, running commands, drawing.
- `src/` holds everything that can be decided from plain data: the index, the shortlist, the
  settings edit and its Undo, the verdict on a repository, the map. It never sees `$`, so the tests
  call it with literals.

If you want `$` in `src/`, the decision belongs in `src/` and the effect in `register.tsx`.

## Tests

```bash
claude plugin test .
```

`tests/mod.test.tsx` runs the whole mod against an in-memory home folder (`tests/world.ts`): it
boots through `session.start`, mounts the real panel and presses its real buttons. The other test
files cover the pure modules. CI runs them on Linux, Windows and macOS against a pinned Claude Code,
and on Linux against the latest one.

## Pull requests

- One change per pull request, with a test that fails without it.
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/) and explain
  why, not only what.
- Everything in the repository is in English, except `README.it.md`.
- Add a line under `[Unreleased]` in `CHANGELOG.md`.
- No personal paths, keys or screenshots of private data. CI scans for them, in the history too.
