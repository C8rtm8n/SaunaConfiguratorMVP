import type { BuildContext, ComponentBuilder, ComponentInstance } from './component.js';
import type { Config, ProductLineId } from './config.js';
import type { AutoAddition, CheckFnId, ConfigPatchOp, Facts, Finding } from './rules.js';

export type FnParams = Readonly<Record<string, string | number | boolean | null>>;

/** Signature of registered check / auto / fix functions. Pure. */
export type CheckFn = (ctx: BuildContext, facts: Facts, params: FnParams) => Finding[];
export type AutoFn = (ctx: BuildContext, facts: Facts, params: FnParams) => Omit<AutoAddition, 'ruleId'>[];
export type FixFn = (ctx: BuildContext, facts: Facts) => ConfigPatchOp[] | null;

/**
 * Interior package over the shared shell. MVP: only 'sauna'.
 * Fitness / glamping / pool implement the same interface later.
 */
export interface ProductLinePack<C extends Config = Config> {
  id: ProductLineId;
  zoneTypes: readonly string[];
  /** Interior components (the shell is built by core). */
  components(config: C, ctx: BuildContext): ComponentInstance[];
  builders: Record<string, ComponentBuilder>;
  /** Pack facts available before the build (geometry-only); used by auto rules. */
  facts(config: C, ctx: BuildContext): Facts;
  checks: Record<CheckFnId, CheckFn>;
  autos: Record<CheckFnId, AutoFn>;
  fixes: Record<CheckFnId, FixFn>;
}
