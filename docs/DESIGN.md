# Helm: design notes

Working document. Decisions are added as they are made.

## Goal

A tool for anyone who uses Claude Code: a control panel that assists a project from its first chat to its last. New skills, plugins and tools appear every week; Helm keeps the right ones loaded for the work at hand and makes the rest easy to find, vet and add.

## Decided

- **Form:** a Claude Code plugin only (hooks, a pane, a line below the prompt, a few skills). No separate app.
- **Name:** Helm. Command: `/helm`.
- **Start of a project:** never automatic. In a folder Helm has not seen, a notice under the prompt offers to set the project up, with *Open* and *Not here*. *Not here* is remembered per folder, so a project can opt out for good.
- **Choosing tools:** a free local shortlist from the installed catalog, then one call to the small model that picks precisely. The cost is shown before it runs.
- **During work:** when a skill that is not active is needed, a line offers two ways to say yes (*for this chat*, *always in this project*) and one to say no (*ignore*).

## To decide

- The screen: layout of the control panel, the first-prompt box, the GitHub checkbox (only when the GitHub connector is linked).
- The live graph of everything installed, lit by category, and what the engine can draw.
- The research box (paste a link or a name; Helm vets, installs, configures; a tool added for one project becomes a candidate everywhere).
- A global tab with the same research box and list input.
- What is kept about each project, and where.
