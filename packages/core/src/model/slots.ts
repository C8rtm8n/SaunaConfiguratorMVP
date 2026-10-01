import type { Id, Mm } from './units.js';
import type { WallId } from './config.js';

/** One slot on a wall or the roof. Coordinates are along the surface axis. */
export interface Slot {
  index: number;
  /** Along the wall from its start [mm] (S/N: +X, W/E: +Y, partitions: +Y). */
  from_mm: Mm;
  to_mm: Mm;
  /** Opening id occupying the slot, if any. */
  occupiedBy?: Id;
}

/** Slot layout of one surface. Remainders become fixed filler panels (D-007). */
export interface SlotLayout {
  surface: WallId | 'roof';
  length_mm: Mm;
  slots: Slot[];
  /** Non-slot zones (corner posts, filler strips, container door end). */
  fillers: Array<{ from_mm: Mm; to_mm: Mm; reason: 'corner' | 'remainder' | 'fixed' }>;
}

export type SlotMap = Partial<Record<WallId | 'roof', SlotLayout>>;
