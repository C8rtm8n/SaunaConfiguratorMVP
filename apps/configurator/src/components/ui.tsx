import type { ComponentChildren } from 'preact';

/** Small form primitives (styled in styles.css). */

export function Section(p: { title: string; children: ComponentChildren }) {
  return (
    <section class="sec">
      <h3>{p.title}</h3>
      {p.children}
    </section>
  );
}

export interface Opt<T> {
  value: T;
  label: string;
  hint?: string;
  disabled?: boolean;
}

export function Choice<T extends string | number>(p: { name: string; value: T; options: Opt<T>[]; onChange: (v: T) => void; cards?: boolean }) {
  return (
    <div class={p.cards ? 'cards' : 'chips'} role="radiogroup" aria-label={p.name}>
      {p.options.map((o) => (
        <label class={`opt${o.value === p.value ? ' on' : ''}${o.disabled ? ' off' : ''}`} key={String(o.value)}>
          <input type="radio" name={p.name} checked={o.value === p.value} disabled={o.disabled} onChange={() => p.onChange(o.value)} />
          <span class="opt-l">{o.label}</span>
          {o.hint && <span class="opt-h">{o.hint}</span>}
        </label>
      ))}
    </div>
  );
}

export function Slider(p: { label: string; value: number; min: number; max: number; step: number; display: string; onChange: (v: number) => void; name: string }) {
  return (
    <label class="slider">
      <span class="slider-l">
        {p.label} <b>{p.display}</b>
      </span>
      <input type="range" name={p.name} min={p.min} max={p.max} step={p.step} value={p.value} onInput={(e) => p.onChange(Number((e.target as HTMLInputElement).value))} />
    </label>
  );
}

export function Check(p: { label: string; checked: boolean; onChange: (v: boolean) => void; name: string }) {
  return (
    <label class="check">
      <input type="checkbox" name={p.name} checked={p.checked} onChange={(e) => p.onChange((e.target as HTMLInputElement).checked)} />
      <span>{p.label}</span>
    </label>
  );
}

export function Select<T extends string>(p: { label: string; value: T; options: Opt<T>[]; onChange: (v: T) => void; name: string }) {
  return (
    <label class="field">
      <span>{p.label}</span>
      <select name={p.name} value={p.value} onChange={(e) => p.onChange((e.target as HTMLSelectElement).value as T)}>
        {p.options.map((o) => (
          <option value={o.value} disabled={o.disabled} key={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
