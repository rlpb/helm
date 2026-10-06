## What this changes

<!-- One or two sentences. Link the issue if there is one. -->

## How it was tested

<!-- Paste the command and its output. "Should work" is not a test. -->

```
```

## Checklist

- [ ] `claude plugin validate .` and `claude plugin test .` pass locally
- [ ] Anything decided from plain data lives in `src/` with a test in
      `tests/pure.test.ts`; `hooks/register.tsx` only holds effects
- [ ] If the guard for the configurator changed (`src/guard.ts`), its tests
      changed with it
- [ ] No new network call, no new file written outside `~/.claude`, or the
      reason is explained above
- [ ] For anything visual: screenshots regenerated with `node scripts/shots.mjs`
- [ ] `CHANGELOG.md` has a line under Unreleased
