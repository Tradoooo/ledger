/** « À classer » et « règles apprises » : les règles proposent, l'utilisateur décide (LED-F-13). */
import { useState } from "react";
import { formatMinor } from "@ledger/core";
import type { Account, Rule } from "@ledger/core";
import type { Locale } from "@ledger/ui";
import { UNASSIGNED_ACCOUNT } from "./ledger.config";
import type { Proposal } from "./store";

export interface ClassifyProps {
  proposals: readonly Proposal[]; accounts: readonly Account[]; learned: readonly Rule[]; unit: string;
  locale: Locale; onDecide: (proposal: Proposal, accountId: string) => void; onForget: (ruleId: string) => void;
}

const TARGET_TYPES = new Set(["expense", "income"]);

/** Une écriture à classer : la proposition, le select, la décision. Changer le compte apprend une règle. */
function Item({ proposal, accounts, labelOf, unit, locale, onDecide }: {
  proposal: Proposal; accounts: readonly Account[]; labelOf: (id: string) => string;
  unit: string; locale: Locale; onDecide: (proposal: Proposal, accountId: string) => void;
}) {
  const [chosen, setChosen] = useState(proposal.accountId ?? UNASSIGNED_ACCOUNT);
  const shown = proposal.accountId === null ? <em>aucune règle ne propose</em> : <><code>{labelOf(proposal.accountId)}</code>{proposal.learned ? <> <span className="bb-pill">apprise</span></> : null}</>;
  return (
    <li>
      <strong>{proposal.note}</strong> — {proposal.date} — {formatMinor(Math.abs(proposal.amountMinor), unit, locale)}
      <br />Proposition : {shown}
      <br />
      <select value={chosen} aria-label={`Affecter ${proposal.note}`} onChange={(e) => setChosen(e.target.value)}>
        {accounts.map((account) => <option key={account.id} value={account.id}>{account.label}</option>)}
      </select>{" "}
      <button className="bb-btn" type="button" onClick={() => onDecide(proposal, chosen)}>
        {chosen === proposal.accountId ? "Confirmer" : "Corriger et retenir"}
      </button>
    </li>
  );
}

export function ClassifyScreen({ proposals, accounts, learned, unit, locale, onDecide, onForget }: ClassifyProps) {
  const targets = accounts.filter((account) => TARGET_TYPES.has(account.type));
  const labelOf = (id: string): string => accounts.find((account) => account.id === id)?.label ?? id;
  return (
    <>
      <section className="bb-card">
        <h2>À classer — {proposals.length} écriture(s) sans enveloppe</h2>
        <p className="bb-sub">L'application propose, vous décidez : rien n'entre dans une enveloppe avant confirmation,
          et le journal n'est jamais réécrit.</p>
        {proposals.length === 0 ? <p className="bb-empty">Tout est classé.</p> : (
          <ul>{proposals.map((proposal) => (
            <Item
              key={proposal.entryId} proposal={proposal} accounts={targets} labelOf={labelOf} unit={unit}
              locale={locale} onDecide={onDecide}
            />
          ))}</ul>
        )}
      </section>
      <section className="bb-card">
        <h2>Règles apprises ({learned.length})</h2>
        <p className="bb-sub">Chaque correction retient le motif du libellé. Une règle propose, elle n'écrit jamais.</p>
        {learned.length === 0 ? <p className="bb-empty">Aucune règle apprise : corrigez une affectation ci-dessus.</p> : (
          <ul>{learned.map((rule) => (
            <li key={rule.id}>
              <code>{rule.when.value}</code> → {labelOf(rule.then.accountId)} — {rule.uses} usage(s){" "}
              <button className="bb-btn" type="button" onClick={() => onForget(rule.id)}>Supprimer</button>
            </li>
          ))}</ul>
        )}
      </section>
    </>
  );
}
