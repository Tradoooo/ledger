#!/usr/bin/env node
/** Deterministic fixtures: same seed, same bytes. No real data, ever. */
import { mkdirSync, writeFileSync } from "node:fs";

const SEED = Number(process.env.LEDGER_FIXTURE_SEED ?? 20261103);

/** mulberry32: small, fast, reproducible. */
const rng = (seed) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const random = rng(SEED);
const pick = (list) => list[Math.floor(random() * list.length)];
const between = (min, max) => min + Math.floor(random() * (max - min + 1));
const money = (cents) => (cents / 100).toFixed(2).replace(".", ",");
const iso = (year, month, day) => `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
const french = (year, month, day) => `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;

const SPEND = [
  ["CARREFOUR MARKET PARIS 12", 2500, 14500],
  ["CB BOULANGERIE DU COIN", 180, 1450],
  ["CB PHARMACIE DE LA PLACE", 420, 6800],
  ["PRLV SEPA EDF ENERGIE", 8500, 18500],
  ["PRLV SEPA LOYER", 78000, 78000],
  ["CB SNCF CONNECT", 1200, 9800],
  ["CB CAFE DU COMMERCE", 350, 3200],
  ["CB LIBRAIRIE PAPETERIE", 500, 4500],
  ["PRLV SEPA ASSURANCE HABITATION", 3400, 3400],
  ["CB ESSENCE TOTAL", 4200, 8200],
];
const INCOME = [
  ["VIR SALAIRE ACME FRANCE", 248000, 248000],
  ["VIR REMBOURSEMENT CPAM", 1500, 9000],
  ["VIR CAF ALLOCATIONS", 12000, 14000],
];

const household = ["Date;Libellé;Débit;Crédit;Devise"];
let day = 1;
let year = 2024;
let month = 1;
while (household.length <= 12000) {
  const roll = random();
  if (roll < 0.04) {
    const [label, min, max] = pick(INCOME);
    household.push(`${french(year, month, Math.min(day, 28))};"${label}";;${money(between(min, max))};EUR`);
  } else {
    const [label, min, max] = pick(SPEND);
    household.push(`${french(year, month, Math.min(day, 28))};"${label}";${money(between(min, max))};;EUR`);
  }
  day += between(1, 3);
  if (day > 28) { day = 1; month += 1; if (month > 12) { month = 1; year += 1; } }
}
mkdirSync("fixtures", { recursive: true });
writeFileSync("fixtures/household-3y.csv", `${household.join("\n")}\n`);

const donors = ["M. Dupont", "Mme K.", "Famille Rossi", "Association Les Amis", "Anonyme", "M. Bernard", "Mme Nguyen"];
const aid = ["Bon alimentaire", "Aide au loyer", "Cantine scolaire", "Caution logement", "Facture énergie"];
const fund = ["Date;Libellé;Débit;Crédit;Devise"];
for (let index = 0; index < 214; index += 1) {
  const isDonation = index % 3 !== 2;
  const date = french(2026, between(1, 11), between(1, 28));
  if (isDonation) fund.push(`${date};"Don — ${pick(donors)}";;${money(between(1000, 25000))};EUR`);
  else fund.push(`${date};"${pick(aid)}";${money(between(1500, 40000))};;EUR`);
}
writeFileSync("fixtures/mutual-aid-2026.csv", `${fund.join("\n")}\n`);

mkdirSync("fixtures/messy-csv", { recursive: true });
writeFileSync("fixtures/messy-csv/bom-semicolon.csv", `\uFEFFDate;Libellé;Débit;Crédit;Devise\n03/11/2026;"CARREFOUR MARKET";84,20;;EUR\n05/11/2026;"VIR SALAIRE";;2480,00;EUR\n`);
writeFileSync("fixtures/messy-csv/comma-decimal-point.csv", `Date,Libellé,Débit,Crédit,Devise\n03/11/2026,"CAFE DU COIN",4.80,,EUR\n05/11/2026,"VIR SALAIRE",,2480.00,EUR\n`);
writeFileSync("fixtures/messy-csv/single-amount.csv", `Date;Libellé;Montant\n03/11/2026;"CB SNCF";-12,50\n05/11/2026;"VIR SALAIRE";2480,00\n`);
writeFileSync("fixtures/messy-csv/parentheses-negative.csv", `Date;Libellé;Montant\n03/11/2026;"CB PHARMACIE";(42,10)\n`);
writeFileSync("fixtures/messy-csv/quoted-newline.csv", `Date;Libellé;Débit;Crédit;Devise\n03/11/2026;"CB LIBRAIRIE\nPAPETERIE";12,00;;EUR\n`);
writeFileSync("fixtures/messy-csv/english-headers.csv", `Date,Label,Debit,Credit,Currency\n2026-11-03,"BOOKSHOP",12.00,,EUR\n`);
writeFileSync("fixtures/messy-csv/accents-windows1252.csv", Buffer.from(`Date;Libellé;Débit;Crédit;Devise\n03/11/2026;"ÉLECTRICITÉ ÉCOLE";12,00;;EUR\n`, "latin1"));

const counts = { household: household.length - 1, mutualAid: 214, messy: 6 };
writeFileSync("fixtures/FIXTURES.json", `${JSON.stringify({ seed: SEED, counts }, null, 2)}\n`);
console.log(`fixtures written: ${JSON.stringify(counts)} (seed ${SEED})`);
