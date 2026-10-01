import type { I18nTemplate, I18nText } from './i18n.js';
import type { Id } from './units.js';

/**
 * Rules are data (stored in the catalog, editable per tenant later).
 * Simple rules are pure expressions over `Facts`; geometric checks
 * (collision envelopes, door swing…) call a named, pure check function
 * from the product-line registry with data parameters (D-009).
 */

export type RuleLevel = 'error' | 'warning' | 'auto';

/** Flat derived values, e.g. 'heater.fuel', 'sauna.eqVolume_m3', 'zone.sauna.length_mm'. */
export type FactValue = number | string | boolean | null;
export type Facts = Readonly<Record<string, FactValue>>;

/** Reference to a fact or to a catalog limit: { fact: 'sauna.eqVolume_m3' } | { limit: 'doorMinClearWidth_mm' }. */
export type Operand = { fact: string } | { limit: string } | { value: FactValue };

export type Condition =
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition }
  | { op: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte'; a: Operand; b: Operand }
  | { op: 'in'; a: Operand; values: FactValue[] }
  | { op: 'between'; a: Operand; min: Operand; max: Operand };

/** Name of a registered check function, e.g. 'heaterClearance', 'doorSwing'. */
export type CheckFnId = string;

export type RuleCheck =
  /** Violated when `assert` is false. */
  | { kind: 'expr'; assert: Condition }
  /** Registered pure function; returns 0..n findings. */
  | { kind: 'fn'; fn: CheckFnId; params?: Record<string, FactValue> };

/** What an 'auto' rule adds to the resolved config. */
export type AutoActionDef =
  | { kind: 'fn'; fn: CheckFnId; params?: Record<string, FactValue> };

export interface RuleDef {
  /** 'R01'…'R10' for MVP; stable, referenced from tests and UI. */
  id: string;
  level: RuleLevel;
  title: I18nText;
  /** Applicability; omitted = always. */
  when?: Condition;
  /** For 'error' / 'warning'. */
  check?: RuleCheck;
  /** For 'auto'. */
  action?: AutoActionDef;
  message_i18n: I18nTemplate;
  /** Fix strategy name; the check fn computes the concrete patch. */
  fix?: { fn: CheckFnId; label_i18n: I18nText };
  source?: string;
}

/** RFC 6902 subset; paths into Config. One-click fix in UI = apply patch. */
export type ConfigPatchOp =
  | { op: 'replace' | 'add'; path: string; value: unknown }
  | { op: 'remove'; path: string };

export interface Violation {
  ruleId: string;
  level: Exclude<RuleLevel, 'auto'>;
  message: I18nTemplate;
  /** Values for template placeholders (core units). */
  params: Record<string, FactValue>;
  /** Config entity ids (opening, zone, attachment, 'heater', 'benches'…). */
  affectedIds: Id[];
  suggestedFix?: { label: I18nText; patch: ConfigPatchOp[] };
}

/** Result of an 'auto' rule: extra components / roof slot / BOM, never a config mutation. */
export interface AutoAddition {
  ruleId: string;
  /** Component instances appended to the build. */
  components: import('./component.js').ComponentInstance[];
  /** Human-readable note for the summary and tech PDF. */
  note: I18nTemplate;
  params: Record<string, FactValue>;
}
