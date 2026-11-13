# ledger-journal — tasks
- [x] hash.ts: pure SHA-256, canonical form, `GENESIS`
- [x] journal.ts: `createJournal`, `append`, `validateEntry`, `verifyChain`, `deepFreeze`
- [x] contra.ts: `contra` (mirror entry), `isReversed`
- [x] properties: chain verifies after any append/reversal (seed 20261113)
- [x] chain verification on 12 000 entries < 150 ms (bench, LED-N-03)
