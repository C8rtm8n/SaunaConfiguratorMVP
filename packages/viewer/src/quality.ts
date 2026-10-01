/**
 * Adaptive quality (D-032). Device tier picks the start settings; while the
 * user interacts, a rolling frame-time window lowers DPR in steps and finally
 * disables shadows when the target frame rate is not reached, and raises DPR
 * again when there is headroom.
 */
export type Tier = 'low' | 'mid' | 'high';

export interface DeviceInfo {
  coarsePointer: boolean;
  cores: number;
  memoryGb?: number;
  devicePixelRatio: number;
}

export interface QualitySettings {
  dpr: number;
  maxDpr: number;
  minDpr: number;
  shadows: boolean;
  shadowMapSize: number;
  antialias: boolean;
  targetFps: number;
}

export function detectDevice(): DeviceInfo {
  const nav = typeof navigator !== 'undefined' ? (navigator as Navigator & { deviceMemory?: number }) : undefined;
  const info: DeviceInfo = {
    coarsePointer: typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches,
    cores: nav?.hardwareConcurrency ?? 4,
    devicePixelRatio: typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1,
  };
  if (nav?.deviceMemory !== undefined) info.memoryGb = nav.deviceMemory;
  return info;
}

export function tierOf(d: DeviceInfo): Tier {
  if ((d.memoryGb !== undefined && d.memoryGb <= 2) || d.cores <= 2) return 'low';
  if (d.coarsePointer || (d.memoryGb !== undefined && d.memoryGb <= 4) || d.cores <= 4) return 'mid';
  return 'high';
}

export function initialQuality(d: DeviceInfo): QualitySettings {
  const tier = tierOf(d);
  const maxDpr = Math.min(d.devicePixelRatio, tier === 'high' ? 2 : tier === 'mid' ? 1.75 : 1.25);
  return {
    dpr: tier === 'high' ? maxDpr : Math.min(maxDpr, 1.5),
    maxDpr,
    minDpr: Math.min(0.75, maxDpr),
    shadows: tier !== 'low',
    shadowMapSize: tier === 'high' ? 2048 : 1024,
    antialias: tier === 'high',
    targetFps: d.coarsePointer ? 30 : 60,
  };
}

export type QualityAction = 'lowerDpr' | 'raiseDpr' | 'disableShadows' | null;

export class AdaptiveQuality {
  private samples: number[] = [];
  constructor(readonly q: QualitySettings, private readonly window = 40, private readonly step = 0.25) {}

  /** Feed one frame time [ms]; returns the change to apply (already applied to `q`). */
  sample(frameMs: number): QualityAction {
    if (frameMs <= 0 || frameMs > 1000) return null; // tab switch / first frame
    this.samples.push(frameMs);
    if (this.samples.length < this.window) return null;
    const sorted = [...this.samples].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)]!;
    this.samples = [];
    const fps = 1000 / median;
    const target = this.q.targetFps * 0.9;
    if (fps < target) {
      if (this.q.dpr - this.step >= this.q.minDpr - 1e-9) {
        this.q.dpr = Math.round((this.q.dpr - this.step) * 100) / 100;
        return 'lowerDpr';
      }
      if (this.q.shadows) {
        this.q.shadows = false;
        return 'disableShadows';
      }
      return null;
    }
    if (fps > this.q.targetFps * 1.5 && this.q.dpr + this.step <= this.q.maxDpr + 1e-9) {
      this.q.dpr = Math.round((this.q.dpr + this.step) * 100) / 100;
      return 'raiseDpr';
    }
    return null;
  }
}
