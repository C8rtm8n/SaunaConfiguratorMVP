/** Bridge between the lazily loaded 3D view and the lead form (snapshots for the offer PDF). */
export interface Shot {
  view: string;
  dataUrl: string;
}

let provider: (() => Promise<Shot[]>) | null = null;

export function registerSnapshots(fn: (() => Promise<Shot[]>) | null): void {
  provider = fn;
}

/** Empty when the 3D view is not loaded (the PDF then has no renders). */
export async function takeSnapshots(): Promise<Shot[]> {
  try {
    return provider ? await provider() : [];
  } catch {
    return [];
  }
}
