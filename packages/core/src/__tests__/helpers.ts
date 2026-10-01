import type { Catalog } from '../model/catalog.js';
import type { SaunaConfig } from '../model/config.js';
import type { Evaluation } from '../model/results.js';
import { evaluate } from '../evaluate.js';
import { DEMO_CATALOG } from '../fixtures/demoCatalog.js';

export const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

export function run(base: SaunaConfig, mutate?: (c: SaunaConfig) => void, catalogMutate?: (k: Catalog) => void): Evaluation {
  const c = clone(base);
  mutate?.(c);
  const k = catalogMutate ? clone(DEMO_CATALOG) : DEMO_CATALOG;
  catalogMutate?.(k);
  return evaluate(c, k);
}

export const byRule = (e: Evaluation, id: string) => e.violations.filter((v) => v.ruleId === id);
export const variants = (e: Evaluation, id: string) => byRule(e, id).map((v) => v.message.cs);
export const errors = (e: Evaluation) => e.violations.filter((v) => v.level === 'error');
