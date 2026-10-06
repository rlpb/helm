# Security policy

## Reporting a vulnerability

Report privately through GitHub: open the repository's **Security** tab and use
**Report a vulnerability**. That creates a draft advisory only the maintainers
can see.

Please do not open a public issue for a security problem.

You can expect a first reply within 7 days. If a fix is needed, the advisory
stays private until a patched release is out, and you are credited in it unless
you ask otherwise.

## What counts

Helm edits a person's Claude Code setup and can install tools, so these are in
scope:

- a way to make Helm write outside the project's own `.claude/settings.local.json`
  or the user's Claude Code configuration folder
- a way for a repository name, a link or a search result to make Helm run a command
  it was not meant to run (the install plan accepts only plain names, and only after
  a yes)
- an install that happens without the person's confirmation
- an Undo that restores something other than what it saved
- anything that makes Helm's own code reach the network: it never does. The only
  outside calls are the `gh` and `claude` commands it runs on the person's behalf.

## Verifying a download

Releases carry a zip of the mod, built only by the release workflow from a
tagged commit. Two checks tell you it is the file that workflow produced, and
both work without trusting the release page.

**Where it was built.** Every archive carries a build-provenance attestation,
signed with a short-lived certificate GitHub issues to the workflow run that
made it. It names the repository, the workflow and the commit:

```bash
gh attestation verify helm-0.4.0.zip --repo rlpb/helm
```

The command exits with an error for a file this repository's release workflow
did not build, including the same file with one byte changed. It prints
nothing when its output is not a terminal, so check the exit status.

**That the file is intact.** Each release lists a SHA-256 checksum for every
archive in `SHA256SUMS.txt`. Run it in the folder they are in:

```bash
sha256sum -c SHA256SUMS.txt        # Linux
shasum -a 256 -c SHA256SUMS.txt    # macOS
```

On Windows, compare `Get-FileHash <file>` with the line in `SHA256SUMS.txt`.

Before a release is published, its workflow runs both commands on the files as
GitHub serves them, together with a changed copy and a wrong repository that
have to fail. If any step fails, the release stays a draft.

Installing through `/plugin marketplace add rlpb/helm` fetches this repository
over git instead of a release archive. For a fixed version, download the
archive of a release, verify it as above and load it with
`claude --plugin-dir <folder>`.
