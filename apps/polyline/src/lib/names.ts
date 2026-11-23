import type { Rng } from "./zone";

const FIRST = [
  "Olivia", "Liam", "Emma", "Noah", "Ava", "Oliver", "Sophia", "Elijah", "Isabella", "James",
  "Mia", "William", "Amelia", "Benjamin", "Harper", "Lucas", "Evelyn", "Henry", "Abigail", "Alexander",
  "Emily", "Daniel", "Ella", "Michael", "Grace", "Jack", "Chloe", "Samuel", "Lily", "David",
  "Hannah", "Ethan", "Zoe", "Ryan", "Nora", "Leo", "Ruby", "Adam", "Clara", "Owen",
];
const LAST = [
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Miller", "Davis", "Wilson", "Anderson", "Taylor",
  "Thomas", "Moore", "Martin", "Jackson", "Thompson", "White", "Harris", "Clark", "Lewis", "Walker",
  "Young", "Allen", "King", "Wright", "Scott", "Green", "Baker", "Adams", "Nelson", "Hill",
  "Campbell", "Mitchell", "Carter", "Roberts", "Turner", "Phillips", "Parker", "Evans", "Edwards", "Collins",
];

const pick = <T,>(arr: readonly T[], rng: Rng) => arr[Math.floor(rng() * arr.length)];

/** `count` distinct English full names. */
export function nameOptions(count = 5, rng: Rng = Math.random): string[] {
  const out = new Set<string>();
  while (out.size < count) out.add(`${pick(FIRST, rng)} ${pick(LAST, rng)}`);
  return [...out];
}

export const MEMO_TEMPLATES = [
  "I'm {contact_name}, I will be waiting for you at {pickup.address_en} between {pickup_window_start} and {pickup_window_end}.",
  "Hi, this is {contact_name}. Please pick up the order at {pickup.address_en} any time from {pickup_window_start} to {pickup_window_end}.",
  "{contact_name} here. I'll meet you at {pickup.address_en} between {pickup_window_start} and {pickup_window_end}. Please call me when you arrive.",
  "Hello! {contact_name} will hand over the package at {pickup.address_en}. Available from {pickup_window_start} until {pickup_window_end}.",
] as const;

/** Fill {column} placeholders from the row; empty values stay visible as {column}. */
export function fillTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{([^{}]+)\}/g, (m, key: string) => values[key] || m);
}

export function memoOptions(values: Record<string, string>): string[] {
  return MEMO_TEMPLATES.map((t) => fillTemplate(t, values));
}
