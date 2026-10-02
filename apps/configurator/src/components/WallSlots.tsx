import type { Opening, SlotLayout } from '@sauna/core';

/**
 * 2D elevation of one wall: slots as cells, openings as spans.
 * Click on a free slot → onSlot(index); on an opening → onOpening(id).
 */
export function WallSlots(p: { layout: SlotLayout; openings: Opening[]; selected?: string; label: (o: Opening) => string; onSlot: (i: number) => void; onOpening: (id: string) => void }) {
  const { layout } = p;
  const total = layout.to_mm - layout.from_mm;
  const pct = (mm: number) => `${((mm - layout.from_mm) / total) * 100}%`;
  return (
    <div class="wall" role="group">
      {layout.slots.map((s) => (
        <button
          type="button"
          class="slot"
          key={s.index}
          data-slot={s.index}
          style={{ left: pct(s.from_mm), width: pct(layout.from_mm + (s.to_mm - s.from_mm)) }}
          aria-label={`slot ${s.index + 1}`}
          onClick={() => p.onSlot(s.index)}
        >
          {s.index + 1}
        </button>
      ))}
      {p.openings.map((o) => {
        const a = layout.slots[o.slotFrom];
        const b = layout.slots[o.slotTo];
        if (!a || !b) return null;
        return (
          <button
            type="button"
            key={o.id}
            data-opening={o.id}
            class={`span t-${o.type}${p.selected === o.id ? ' sel' : ''}`}
            style={{ left: pct(a.from_mm), width: pct(layout.from_mm + (b.to_mm - a.from_mm)) }}
            onClick={() => p.onOpening(o.id)}
          >
            {p.label(o)}
          </button>
        );
      })}
    </div>
  );
}
