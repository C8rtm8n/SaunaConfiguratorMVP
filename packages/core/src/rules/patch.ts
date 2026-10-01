import type { Config } from '../model/config.js';
import type { ConfigPatchOp } from '../model/rules.js';

const unescape = (s: string) => s.replace(/~1/g, '/').replace(/~0/g, '~');

/** Applies an RFC 6902 subset (add / replace / remove) and returns a new config. */
export function applyPatch(config: Config, ops: readonly ConfigPatchOp[]): Config {
  const doc = JSON.parse(JSON.stringify(config)) as Record<string, unknown>;
  for (const op of ops) {
    const parts = op.path.split('/').slice(1).map(unescape);
    const last = parts.pop();
    if (last === undefined) throw new Error(`invalid patch path '${op.path}'`);
    let cur: unknown = doc;
    for (const p of parts) {
      cur = (cur as Record<string, unknown>)[p];
      if (cur === null || typeof cur !== 'object') throw new Error(`patch path not found '${op.path}'`);
    }
    const target = cur as Record<string, unknown> | unknown[];
    if (Array.isArray(target)) {
      const i = last === '-' ? target.length : Number(last);
      if (op.op === 'remove') target.splice(i, 1);
      else if (op.op === 'add') target.splice(i, 0, op.value);
      else target[i] = op.value;
    } else if (op.op === 'remove') {
      delete target[last];
    } else {
      target[last] = op.value;
    }
  }
  return doc as unknown as Config;
}
