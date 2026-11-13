/** The application's configuration, reachable from outside `src/`.
 * Screens live in `src/`; this file only re-exports what `defineLedger` froze.
 */
export { default } from "../src/ledger.config";
export { PERIOD, UNIT, BANK_ACCOUNT, UNASSIGNED_ACCOUNT, SALARY_ACCOUNT } from "../src/ledger.config";