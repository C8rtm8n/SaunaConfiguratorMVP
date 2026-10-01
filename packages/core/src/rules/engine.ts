import type { BuildContext } from '../model/component.js';
import type { AutoFn, CheckFn, FixFn } from '../model/productLine.js';
import type { AutoAddition, Facts, RuleDef, Violation } from '../model/rules.js';
import { conditionParams, evalCondition } from './condition.js';

export interface RuleRegistry {
  checks: Record<string, CheckFn>;
  autos: Record<string, AutoFn>;
  fixes: Record<string, FixFn>;
}

export class RuleError extends Error {}

function applies(rule: RuleDef, ctx: BuildContext, facts: Facts): boolean {
  return !rule.when || evalCondition(rule.when, facts, ctx.catalog.catalog.limits);
}

export function runAutoRules(rules: readonly RuleDef[], ctx: BuildContext, facts: Facts, reg: RuleRegistry): AutoAddition[] {
  const out: AutoAddition[] = [];
  for (const rule of rules) {
    if (rule.level !== 'auto' || !rule.action || !applies(rule, ctx, facts)) continue;
    const fn = reg.autos[rule.action.fn];
    if (!fn) throw new RuleError(`rule ${rule.id}: unknown auto fn '${rule.action.fn}'`);
    for (const a of fn(ctx, facts, rule.action.params ?? {})) out.push({ ruleId: rule.id, ...a });
  }
  return out;
}

export function runCheckRules(rules: readonly RuleDef[], ctx: BuildContext, facts: Facts, reg: RuleRegistry): Violation[] {
  const limits = ctx.catalog.catalog.limits;
  const out: Violation[] = [];
  for (const rule of rules) {
    if (rule.level === 'auto' || !rule.check || !applies(rule, ctx, facts)) continue;
    const level = rule.level;
    let memo: { v: Violation['suggestedFix'] } | undefined;
    const ruleFix = () => (memo ??= { v: computeFix() }).v;
    const computeFix = () => {
      if (!rule.fix) return undefined;
      const fn = reg.fixes[rule.fix.fn];
      if (!fn) throw new RuleError(`rule ${rule.id}: unknown fix fn '${rule.fix.fn}'`);
      const patch = fn(ctx, facts);
      return patch ? { label: rule.fix.label_i18n, patch } : undefined;
    };
    if (rule.check.kind === 'expr') {
      if (evalCondition(rule.check.assert, facts, limits)) continue;
      const v: Violation = { ruleId: rule.id, level, message: rule.message_i18n, params: conditionParams(rule.check.assert, facts, limits), affectedIds: [] };
      const fix = ruleFix();
      if (fix) v.suggestedFix = fix;
      out.push(v);
      continue;
    }
    const fn = reg.checks[rule.check.fn];
    if (!fn) throw new RuleError(`rule ${rule.id}: unknown check fn '${rule.check.fn}'`);
    for (const f of fn(ctx, facts, rule.check.params ?? {})) {
      const v: Violation = {
        ruleId: rule.id,
        level,
        message: (f.variant && rule.messages?.[f.variant]) || rule.message_i18n,
        params: f.params,
        affectedIds: f.affectedIds,
      };
      if (f.patch) v.suggestedFix = { label: rule.fix?.label_i18n ?? { cs: 'Opravit', de: 'Beheben', en: 'Fix' }, patch: f.patch };
      else {
        const fix = ruleFix();
        if (fix) v.suggestedFix = fix;
      }
      out.push(v);
    }
  }
  return out;
}
