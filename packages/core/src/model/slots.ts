import type { Id, Mm } from './units.js';
import type { WallId } from './config.js';

/**
 * One slot on a wall or the roof. Coordinates are module coordinates along
 * the surface axis: x for S/N walls and the roof, y for E/W walls and partitions.
 */
export interface Slot {
  index: number;
  from_mm: Mm;
  to_mm: Mm;
  /** Part of the slot not blocked by corner posts / columns (opening must fit here). */
  clearFrom_mm: Mm;
  clearTo_mm: Mm;
  /** Opening id occupying the slot, if any. */
  occupiedBy?: Id;
}

/** Slot layout of one surface. Slots are centred; remainders are filler strips (D-007). */
export interface SlotLayout {
  surface: WallId | 'roof';
  axis: 'x' | 'y';
  from_mm: Mm;
  to_mm: Mm;
  slots: Slot[];
  fillers: Array<{ from_mm: Mm; to_mm: Mm }>;
}

export type SlotMap = Partial<Record<WallId | 'roof', SlotLayout>>;
