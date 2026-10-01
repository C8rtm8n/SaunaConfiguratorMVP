import type { ComponentInstance } from './component.js';
import type { I18nTemplate, I18nText } from './i18n.js';
import type { Id } from './units.js';

/**
 * Rules are data (stored in the catalog, editable per tenant later).
 * Simple rules are pure expressions over `Facts`; geometric checks
 * (collision envelopes, door swing…) call a named, pure check function
 * from the registry with data parameters (D-009).
 */

export type RuleLevel = 'error' | 'warning' | 'auto';

/** Flat derived values, e.g. 'heater.fuel', 'sauna.eqVolume_m3', 'zone.sauna.length_mm'. */
export type FactValue = number | string | boolean | null;
export type Facts = Readonly<Record<string, FactValue>>;

/**
 * Operand: a fact, a catalog limit (dotted path into `Limits`; `{value}` wrappers
 * are unwrapped, e.g. 'doorMinClearWidth_mm' or 'topBenchToCeiling_mm.min'), or a literal.
 */
export type Operand = { fact: string } | { limit: string } | { value: FactValue };

export type Condition =
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition }
  | { op: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte'; a: Operand; b: Operand }
  | { op: 'in'; a: Operand; values: FactValue[] }
  | { op: 'between'; a: Operand; min: Operand; max: Operand };

/** Name of a registered check / auto / fix function, e.g. 'heaterClearance'. */
export type CheckFnId = string;

export type RuleCheck =
  /** Violated when `assert` is false. Params = values of all operands. */
  | { kind: 'expr'; assert: Condition }
  /** Registered pure function; returns 0..n findings. */
  | { kind: 'fn'; fn: CheckFnId; params?: Record<string, FactValue> };

export interface RuleDef {
  /** 'R01'…'R10' from the brief, 'S..' shell validity, 'M..' mass, 'T..' transport. */
  id: string;
  level: RuleLevel;
  title: I18nText;
  /** Applicability; omitted = always. */
  when?: Condition;
  /** For 'error' / 'warning'. */
  check?: RuleCheck;
  /** For 'auto': registered function producing AutoAdditions. */
  action?: { fn: CheckFnId; params?: Record<string, FactValue> };
  message_i18n: I18nTemplate;
  /** Variant messages selected by `Finding.variant`. */
  messages?: Record<string, I18nTemplate>;
  /** Fix strategy; the fn computes the concrete patch (null = no fix possible). */
  fix?: { fn: CheckFnId; label_i18n: I18nText };
  source?: string;
}

/** RFC 6902 subset; paths into Config. One-click fix in UI = apply patch. */
export type ConfigPatchOp =
  | { op: 'replace' | 'add'; path: string; value: unknown }
  | { op: 'remove'; path: string };

/** Raw result of a check function; the engine adds level and message. */
export interface Finding {
  variant?: string;
  params: Record<string, FactValue>;
  affectedIds: Id[];
  /** Concrete fix computed by the check itself (takes precedence over `rule.fix`). */
  patch?: ConfigPatchOp[];
}

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

/** Result of an 'auto' rule: extra components, never a config mutation (D-003). */
export interface AutoAddition {
  ruleId: string;
  components: ComponentInstance[];
  /** Human-readable note for the summary and tech PDF. */
  note: I18nTemplate;
  params: Record<string, FactValue>;
}
