import type { Limits } from '../model/catalog.js';
import type { Condition, FactValue, Facts, Operand } from '../model/rules.js';

export function resolveLimit(limits: Limits, path: string): FactValue {
  let cur: unknown = limits;
  for (const k of path.split('.')) {
    if (cur === null || typeof cur !== 'object') return null;
    cur = (cur as Record<string, unknown>)[k];
  }
  if (cur && typeof cur === 'object' && 'value' in cur) cur = (cur as { value: unknown }).value;
  return typeof cur === 'number' || typeof cur === 'string' || typeof cur === 'boolean' ? cur : null;
}

export function operandValue(o: Operand, facts: Facts, limits: Limits): FactValue {
  if ('fact' in o) return facts[o.fact] ?? null;
  if ('limit' in o) return resolveLimit(limits, o.limit);
  return o.value;
}

/** Name used as template parameter for an operand. */
export function operandName(o: Operand): string | undefined {
  if ('fact' in o) return o.fact;
  if ('limit' in o) return `limit.${o.limit}`;
  return undefined;
}

const num = (v: FactValue): v is number => typeof v === 'number' && Number.isFinite(v);

/** Comparisons involving null / non-numbers are false (except eq/ne). */
export function evalCondition(c: Condition, facts: Facts, limits: Limits): boolean {
  if ('all' in c) return c.all.every((x) => evalCondition(x, facts, limits));
  if ('any' in c) return c.any.some((x) => evalCondition(x, facts, limits));
  if ('not' in c) return !evalCondition(c.not, facts, limits);
  const a = operandValue(c.a, facts, limits);
  switch (c.op) {
    case 'eq':
      return a === operandValue(c.b, facts, limits);
    case 'ne':
      return a !== operandValue(c.b, facts, limits);
    case 'in':
      return c.values.includes(a);
    case 'between': {
      const lo = operandValue(c.min, facts, limits);
      const hi = operandValue(c.max, facts, limits);
      return num(a) && num(lo) && num(hi) && a >= lo && a <= hi;
    }
    default: {
      const b = operandValue(c.b, facts, limits);
      if (!num(a) || !num(b)) return false;
      return c.op === 'gt' ? a > b : c.op === 'gte' ? a >= b : c.op === 'lt' ? a < b : a <= b;
    }
  }
}

/** All operand values of a condition, keyed by operandName (template params). */
export function conditionParams(c: Condition, facts: Facts, limits: Limits, out: Record<string, FactValue> = {}): Record<string, FactValue> {
  if ('all' in c) c.all.forEach((x) => conditionParams(x, facts, limits, out));
  else if ('any' in c) c.any.forEach((x) => conditionParams(x, facts, limits, out));
  else if ('not' in c) conditionParams(c.not, facts, limits, out);
  else {
    const ops: Operand[] = [c.a];
    if ('b' in c) ops.push(c.b);
    if (c.op === 'between') ops.push(c.min, c.max);
    for (const o of ops) {
      const n = operandName(o);
      if (n) out[n] = operandValue(o, facts, limits);
    }
  }
  return out;
}
