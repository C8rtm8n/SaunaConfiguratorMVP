import type { Catalog, CatalogIndex, CatalogItem, CatalogItemOf, CatalogKind } from '../model/catalog.js';

const LISTS: Record<CatalogKind, keyof Catalog> = {
  steel: 'steel',
  steel_profile: 'profiles',
  timber: 'timber',
  panel: 'panels',
  layup: 'layups',
  frame_recipe: 'frameRecipes',
  container: 'containers',
  foundation: 'foundations',
  opening: 'openings',
  heater: 'heaters',
  bench_system: 'benchSystems',
  purchased: 'purchased',
  attachment_system: 'attachmentSystems',
};

export class CatalogError extends Error {}

/** Builds the SKU index. SKUs are unique across the whole catalog. */
export function createCatalogIndex(catalog: Catalog): CatalogIndex {
  const bySku = new Map<string, CatalogItem>();
  for (const kind of Object.keys(LISTS) as CatalogKind[]) {
    for (const item of catalog[LISTS[kind]] as CatalogItem[]) {
      if (item.kind !== kind) throw new CatalogError(`${item.sku}: kind '${item.kind}' in list '${LISTS[kind]}'`);
      if (bySku.has(item.sku)) throw new CatalogError(`duplicate SKU '${item.sku}'`);
      bySku.set(item.sku, item);
    }
  }
  const find = <K extends CatalogKind>(kind: K, sku: string): CatalogItemOf<K> | undefined => {
    const it = bySku.get(sku);
    return it && it.kind === kind ? (it as CatalogItemOf<K>) : undefined;
  };
  return {
    catalog,
    find,
    get(kind, sku) {
      const it = find(kind, sku);
      if (!it) throw new CatalogError(`unknown ${kind} SKU '${sku}' in catalog ${catalog.version}`);
      return it;
    },
    all(kind) {
      return catalog[LISTS[kind]] as never;
    },
  };
}
