import { createContext } from 'preact';
import { useContext, useMemo, useState } from 'preact/hooks';
import { applyPatch, evaluate, normalizeConfig, type ConfigPatchOp, type Currency, type Evaluation, type SaunaConfig, type TenantPublic, type WallId } from '@sauna/core';
import type { Bridge } from './bridge.js';
import type { Env } from './env.js';
import type { I18n } from './i18n.js';
import type { Repos } from './repo.js';

export const STEPS = 8;

export interface SlotSel {
  wall: WallId | 'roof';
  index: number;
}

export interface App {
  env: Env;
  tenant: TenantPublic;
  i18n: I18n;
  repos: Repos;
  bridge: Bridge;
  config: SaunaConfig;
  ev: Evaluation;
  /** Replace the config (normalized), e.g. after an edit op. */
  setConfig(c: SaunaConfig): void;
  /** Mutate a draft copy, then normalize. */
  edit(fn: (draft: SaunaConfig) => void): void;
  applyFix(patch: ConfigPatchOp[]): void;
  step: number;
  setStep(s: number): void;
  currency: Currency;
  setCurrency(c: Currency): void;
  /** Wall shown in the openings step (synced with 3D clicks). */
  wall: WallId;
  setWall(w: WallId): void;
  /** Last slot clicked in 3D (consumed by the openings step). */
  slotClick: (SlotSel & { n: number }) | null;
  setSlotClick(s: (SlotSel & { n: number }) | null): void;
  highlight: SlotSel[];
  setHighlight(s: SlotSel[]): void;
}

export const AppCtx = createContext<App | null>(null);
export const useApp = (): App => useContext(AppCtx)!;

export function useAppState(base: Pick<App, 'env' | 'tenant' | 'i18n' | 'repos' | 'bridge'>, initial: SaunaConfig): App {
  const catalog = base.tenant.catalog;
  const [config, setConfigRaw] = useState(() => normalizeConfig(initial, catalog));
  const [step, setStep] = useState(1);
  const [currency, setCurrency] = useState<Currency>(base.tenant.defaultCurrency);
  const [wall, setWall] = useState<WallId>('S');
  const [slotClick, setSlotClick] = useState<App['slotClick']>(null);
  const [highlight, setHighlight] = useState<SlotSel[]>([]);
  const ev = useMemo(() => evaluate(config, catalog), [config, catalog]);
  const setConfig = (c: SaunaConfig) => setConfigRaw(normalizeConfig(c, catalog));
  return {
    ...base,
    config,
    ev,
    setConfig,
    edit(fn) {
      const d = JSON.parse(JSON.stringify(config)) as SaunaConfig;
      fn(d);
      setConfig(d);
    },
    applyFix: (patch) => setConfig(applyPatch(config, patch) as SaunaConfig),
    step,
    setStep,
    currency,
    setCurrency,
    wall,
    setWall,
    slotClick,
    setSlotClick,
    highlight,
    setHighlight,
  };
}
