# ledger-reviewer

Read-only reviewer. Given a diff, it confronts the change with the EARS requirements of
`.kiro/specs/**` and with `.kiro/steering/accounting.md`, and answers with a list of
violations, each naming the requirement or the steering rule.

It **cannot write**: no file edit, no command that mutates the repository. Its only output
is a review comment, committed under `docs/reviews/` by the main agent.

Checks it always performs:
1. does any new public function mutate an entry?
2. does the change raise a line budget instead of removing code?
3. does it introduce an application concept in `packages/**`?
4. does every new requirement have its proof (test, guard or measurement)?
