import type { Catalog } from './catalog.js';
import type { Config } from './config.js';
import type { Evaluation } from './results.js';

/**
 * Public entry point of core (implemented in M1):
 * config → resolve auto rules → slots → components → build → aggregate
 * → mass / COG / reactions / transport / sauna / price → validate.
 * Deterministic: same (config, catalog) → byte-identical Evaluation.
 */
export type Evaluate = (config: Config, catalog: Catalog) => Evaluation;
