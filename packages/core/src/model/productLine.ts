import type { CatalogIndex } from './catalog.js';
import type { BuildContext, ComponentBuilder, ComponentInstance } from './component.js';
import type { Config, ProductLineId } from './config.js';
import type { AutoAddition, CheckFnId, ConfigPatchOp, Facts, Violation } from './rules.js';

/** Signature of registered check / auto / fix functions. Pure. */
export type CheckFn = (ctx: BuildContext, facts: Facts, params: Record<string, unknown>) => Violation[];
export type AutoFn = (ctx: BuildContext, facts: Facts, params: Record<string, unknown>) => AutoAddition | null;
export type FixFn = (ctx: BuildContext, facts: Facts) => ConfigPatchOp[];

/**
 * Interior package over the shared shell. MVP: only 'sauna'.
 * Fitness / glamping / pool implement the same interface later.
 */
export interface ProductLinePack<C extends Config = Config> {
  id: ProductLineId;
  zoneTypes: readonly C['zones'][number]['type'][];
  /** Components of the interior (the shell is built by core). */
  components(config: C, ctx: BuildContext): ComponentInstance[];
  builders: Record<string, ComponentBuilder<any>>;
  /** Pack-specific facts merged with shell facts. */
  facts(config: C, ctx: BuildContext): Facts;
  checks: Record<CheckFnId, CheckFn>;
  autos: Record<CheckFnId, AutoFn>;
  fixes: Record<CheckFnId, FixFn>;
  /** Starting config for the wizard. */
  defaultConfig(catalog: CatalogIndex, tenantId: string): C;
}
