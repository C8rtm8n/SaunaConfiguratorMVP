import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { ExteriorWallId, GroupNode, WallId } from '@sauna/core';
import { type AssetResolver, tagsOf } from './convert.js';
import { type MaterialDef, MaterialLibrary } from './materials.js';
import { AdaptiveQuality, detectDevice, initialQuality, type QualitySettings } from './quality.js';
import { frontWall, hiddenInSection } from './section.js';
import { SceneSync, type SyncResult } from './sync.js';

export interface SlotRef {
  wall: WallId | 'roof';
  index: number;
}

export interface ViewerOptions {
  /** Overrides of the material library (tenant theming). */
  materials?: Record<string, Partial<MaterialDef>>;
  /** Equirectangular .hdr (1k) for lighting; default = procedural room environment (no download). */
  environmentUrl?: string;
  /** GLB decoders; loaded lazily only when an asset node appears. */
  assets?: { dracoDecoderPath?: string; ktx2TranscoderPath?: string };
  /** Force quality settings (tests, kiosk). */
  quality?: Partial<QualitySettings>;
  background?: string;
  /** Show the ground plane (receives shadows). */
  ground?: boolean;
}

export type SnapshotView = 'iso_front' | 'iso_back' | 'front' | 'section';
export interface Snapshot {
  view: SnapshotView;
  width: number;
  height: number;
  /** PNG data URL; `snapshotBlob()` converts it for upload. */
  dataUrl: string;
}

export interface ViewerStats {
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  dpr: number;
  shadows: boolean;
  fps: number;
}

type Events = {
  slotclick: SlotRef;
  slothover: SlotRef | null;
  quality: { dpr: number; shadows: boolean };
  sync: SyncResult;
};

/** Directions (three.js space: +X = module length, +Y = up, +Z = towards the S wall) per snapshot view. */
const VIEW_DIR: Record<SnapshotView, [number, number, number]> = {
  iso_front: [-0.85, 0.6, 1],
  iso_back: [0.85, 0.6, -1],
  front: [0, 0.18, 1],
  section: [-0.55, 0.9, 1],
};

/**
 * 3D view of an evaluated configuration. Read-only: it renders `Evaluation.scene`
 * and reports slot clicks; it never edits geometry (configuration is the source of truth).
 */
export class SaunaViewer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  readonly quality: QualitySettings;

  private readonly lib: MaterialLibrary;
  private readonly sync: SceneSync;
  private readonly adaptive: AdaptiveQuality;
  private readonly sun: THREE.DirectionalLight;
  private readonly hemi: THREE.HemisphereLight;
  private envScheduled = false;
  private lastInfo = { calls: 0, triangles: 0 };
  private readonly ground?: THREE.Mesh;
  private readonly listeners: { [K in keyof Events]?: Array<(e: Events[K]) => void> } = {};
  private readonly ro?: ResizeObserver;
  private readonly raycaster = new THREE.Raycaster();
  private section = false;
  private front: ExteriorWallId = 'S';
  private frame = 0;
  private lastFrameAt = 0;
  private continuous = false;
  private fps = 0;
  private framed = false;
  private hovered: SlotRef | null = null;
  private highlighted: SlotRef[] = [];
  private cutawayObjects: THREE.Object3D[] = [];
  private slotObjects: THREE.Mesh[] = [];
  private moduleBox = new THREE.Box3(new THREE.Vector3(), new THREE.Vector3(1, 1, 1));
  private pointerDown?: { x: number; y: number };
  private disposed = false;

  constructor(private readonly container: HTMLElement, private readonly opts: ViewerOptions = {}) {
    this.quality = { ...initialQuality(detectDevice()), ...opts.quality };
    this.adaptive = new AdaptiveQuality(this.quality);
    this.renderer = new THREE.WebGLRenderer({ antialias: this.quality.antialias, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = this.quality.shadows;
    this.renderer.shadowMap.type = THREE.PCFShadowMap; // PCFSoftShadowMap was removed in r18x
    this.renderer.setPixelRatio(this.quality.dpr);
    performance.mark('sauna:renderer');
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.touchAction = 'none';
    container.appendChild(this.renderer.domElement);

    const bg = new THREE.Color(opts.background ?? '#dfe5e8');
    this.scene.background = bg;
    this.scene.fog = new THREE.Fog(bg, 18, 45); // ground plane fades into the background
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.05, 300);
    this.camera.position.set(-6, 4, 8);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    this.controls.maxPolarAngle = Math.PI * 0.495; // stay above ground
    this.controls.minDistance = 1.5;
    this.controls.maxDistance = 40;
    this.controls.addEventListener('change', () => this.onCameraChange());
    this.controls.addEventListener('start', () => (this.continuous = true));

    this.lib = new MaterialLibrary(opts.materials, (url) => new THREE.TextureLoader().load(url, () => this.requestRender()));
    this.sync = new SceneSync(this.lib, this.assetResolver());
    this.scene.add(this.sync.root);

    this.sun = new THREE.DirectionalLight('#fff4e6', 2.2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(this.quality.shadowMapSize, this.quality.shadowMapSize);
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.02;
    this.scene.add(this.sun, this.sun.target);

    if (opts.ground !== false) {
      this.ground = new THREE.Mesh(new THREE.CircleGeometry(60, 48), this.lib.get('ground'));
      this.ground.rotation.x = -Math.PI / 2;
      this.ground.position.y = -0.002;
      this.ground.receiveShadow = true;
      this.scene.add(this.ground);
    }
    // Fill light until the environment map exists (D-033: environment is generated after the first frame).
    this.hemi = new THREE.HemisphereLight('#dfe9f2', '#7d8a6a', 1.6);
    this.scene.add(this.hemi);

    const el = this.renderer.domElement;
    el.addEventListener('pointerdown', this.onPointerDown);
    el.addEventListener('pointerup', this.onPointerUp);
    el.addEventListener('pointermove', this.onPointerMove);
    el.addEventListener('pointerleave', this.onPointerLeave);
    if (typeof ResizeObserver !== 'undefined') {
      this.ro = new ResizeObserver(() => this.resize());
      this.ro.observe(container);
    }
    this.resize();
  }

  // ------------------------------------------------------------- public API

  /** Shows `Evaluation.scene`; only components with a changed hash are rebuilt. */
  setScene(scene: GroupNode): SyncResult {
    const res = this.sync.sync(scene);
    this.collectTagged();
    this.updateModuleBox();
    if (!this.framed) {
      this.frameModule();
      this.framed = true;
    }
    this.fitShadow();
    this.applySection();
    this.applyHighlight();
    this.emit('sync', res);
    this.requestRender();
    return res;
  }

  setSectionMode(on: boolean): void {
    this.section = on;
    this.applySection();
    this.requestRender();
  }

  get sectionMode(): boolean {
    return this.section;
  }

  /** Persistently highlight slots (e.g. the selected opening). */
  highlightSlots(slots: SlotRef[]): void {
    this.highlighted = slots;
    this.applyHighlight();
    this.requestRender();
  }

  on<K extends keyof Events>(type: K, cb: (e: Events[K]) => void): () => void {
    const list = (this.listeners[type] ??= []) as Array<(e: Events[K]) => void>;
    list.push(cb);
    return () => list.splice(list.indexOf(cb), 1);
  }

  /** Slot under a canvas pixel (CSS px), respecting section-mode visibility. */
  pickSlot(x: number, y: number): SlotRef | null {
    const r = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2((x / r.width) * 2 - 1, -(y / r.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObjects(this.slotObjects.filter((o) => o.visible), false);
    const slot = hits[0] ? tagsOf(hits[0].object)?.slot : undefined;
    return slot ? { wall: slot.wall, index: slot.index } : null;
  }

  /** Renders the 4 offer views (default 1600 × 1000) on the client (M4 uploads them). */
  async exportSnapshots(width = 1600, height = 1000, views: SnapshotView[] = ['iso_front', 'iso_back', 'front', 'section']): Promise<Snapshot[]> {
    const r = this.renderer;
    const prev = {
      size: r.getSize(new THREE.Vector2()),
      dpr: r.getPixelRatio(),
      pos: this.camera.position.clone(),
      target: this.controls.target.clone(),
      aspect: this.camera.aspect,
      section: this.section,
      shadows: r.shadowMap.enabled,
      hovered: this.hovered,
      highlighted: this.highlighted,
    };
    this.hovered = null;
    this.highlighted = [];
    this.applyHighlight();
    r.setPixelRatio(1);
    r.setSize(width, height, false);
    r.shadowMap.enabled = true;
    this.sun.castShadow = true;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    const out: Snapshot[] = [];
    const sphere = this.moduleBox.getBoundingSphere(new THREE.Sphere());
    for (const view of views) {
      const d = new THREE.Vector3(...VIEW_DIR[view]).normalize();
      const vfov = THREE.MathUtils.degToRad(this.camera.fov);
      const hfov = 2 * Math.atan(Math.tan(vfov / 2) * this.camera.aspect);
      const dist = (sphere.radius / Math.sin(Math.min(vfov, hfov) / 2)) * 0.92;
      this.camera.position.copy(sphere.center).addScaledVector(d, dist);
      this.camera.lookAt(sphere.center);
      this.section = view === 'section';
      this.applySection();
      r.render(this.scene, this.camera);
      out.push({ view, width, height, dataUrl: r.domElement.toDataURL('image/png') });
    }
    // restore
    this.section = prev.section;
    r.shadowMap.enabled = prev.shadows;
    this.sun.castShadow = prev.shadows;
    r.setPixelRatio(prev.dpr);
    r.setSize(prev.size.x, prev.size.y, false);
    this.camera.aspect = prev.aspect;
    this.camera.updateProjectionMatrix();
    this.camera.position.copy(prev.pos);
    this.controls.target.copy(prev.target);
    this.camera.lookAt(prev.target);
    this.hovered = prev.hovered;
    this.highlighted = prev.highlighted;
    this.applySection();
    this.applyHighlight();
    this.render();
    return out;
  }

  stats(): ViewerStats {
    const i = this.renderer.info;
    return {
      drawCalls: this.lastInfo.calls,
      triangles: this.lastInfo.triangles,
      geometries: i.memory.geometries,
      textures: i.memory.textures,
      dpr: this.renderer.getPixelRatio(),
      shadows: this.renderer.shadowMap.enabled,
      fps: Math.round(this.fps),
    };
  }

  /** Synchronous render (also used by tests and snapshots). */
  render(): void {
    this.renderer.render(this.scene, this.camera);
    const i = this.renderer.info.render;
    this.lastInfo = { calls: i.calls, triangles: i.triangles };
  }

  requestRender(): void {
    if (this.frame || this.disposed) return;
    this.frame = requestAnimationFrame(this.tick);
  }

  dispose(): void {
    this.disposed = true;
    if (this.frame) cancelAnimationFrame(this.frame);
    this.ro?.disconnect();
    const el = this.renderer.domElement;
    el.removeEventListener('pointerdown', this.onPointerDown);
    el.removeEventListener('pointerup', this.onPointerUp);
    el.removeEventListener('pointermove', this.onPointerMove);
    el.removeEventListener('pointerleave', this.onPointerLeave);
    this.controls.dispose();
    this.sync.dispose();
    this.lib.dispose();
    this.ground?.geometry.dispose();
    (this.scene.environment as THREE.Texture | null)?.dispose();
    this.renderer.dispose();
    el.remove();
  }

  // ------------------------------------------------------------ internals

  private tick = (now: number) => {
    this.frame = 0;
    const moving = this.controls.update();
    this.render();
    if (!this.envScheduled) {
      this.envScheduled = true;
      const idle = (cb: () => void) => (typeof requestIdleCallback !== 'undefined' ? requestIdleCallback(cb, { timeout: 1500 }) : setTimeout(cb, 200));
      idle(() => {
        if (this.disposed) return;
        this.setupEnvironment();
        performance.mark('sauna:environment');
        this.requestRender();
      });
    }
    if (this.continuous && this.lastFrameAt) {
      const dt = now - this.lastFrameAt;
      this.fps = this.fps ? this.fps * 0.9 + (1000 / dt) * 0.1 : 1000 / dt;
      const action = this.adaptive.sample(dt);
      if (action) this.applyQuality();
    }
    this.lastFrameAt = now;
    if (moving) {
      this.continuous = true;
      this.requestRender();
    } else {
      this.continuous = false;
      this.lastFrameAt = 0;
    }
  };

  private applyQuality(): void {
    this.renderer.setPixelRatio(this.quality.dpr);
    this.resize();
    if (this.renderer.shadowMap.enabled !== this.quality.shadows) {
      this.renderer.shadowMap.enabled = this.quality.shadows;
      this.sun.castShadow = this.quality.shadows;
      this.scene.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.Material | undefined;
        if (m) m.needsUpdate = true;
      });
    }
    this.emit('quality', { dpr: this.quality.dpr, shadows: this.quality.shadows });
  }

  private resize(): void {
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.requestRender();
  }

  private setupEnvironment(): void {
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    this.scene.environment = pmrem.fromScene(room, 0.04).texture;
    this.scene.environmentIntensity = 0.6;
    this.hemi.intensity = 0.35;
    room.dispose();
    if (this.opts.environmentUrl) {
      const url = this.opts.environmentUrl;
      import('three/addons/loaders/HDRLoader.js').then(({ HDRLoader }) =>
        new HDRLoader().load(url, (tex) => {
          const env = pmrem.fromEquirectangular(tex).texture;
          tex.dispose();
          (this.scene.environment as THREE.Texture | null)?.dispose();
          this.scene.environment = env;
          pmrem.dispose();
          this.requestRender();
        }),
      );
    } else {
      pmrem.dispose();
    }
  }

  private assetResolver(): AssetResolver {
    let loader: Promise<{ loadAsync(url: string): Promise<{ scene: THREE.Object3D }> }> | undefined;
    const make = async () => {
      const [{ GLTFLoader }, { MeshoptDecoder }] = await Promise.all([import('three/addons/loaders/GLTFLoader.js'), import('three/addons/libs/meshopt_decoder.module.js')]);
      const l = new GLTFLoader();
      l.setMeshoptDecoder(MeshoptDecoder);
      // Decoders default to the copies bundled next to the loaders (fetched only when a GLB needs them).
      const [{ DRACOLoader }, { KTX2Loader }] = await Promise.all([import('three/addons/loaders/DRACOLoader.js'), import('three/addons/loaders/KTX2Loader.js')]);
      const draco = new DRACOLoader();
      if (this.opts.assets?.dracoDecoderPath) draco.setDecoderPath(this.opts.assets.dracoDecoderPath);
      const ktx2 = new KTX2Loader();
      if (this.opts.assets?.ktx2TranscoderPath) ktx2.setTranscoderPath(this.opts.assets.ktx2TranscoderPath);
      l.setDRACOLoader(draco);
      l.setKTX2Loader(ktx2.detectSupport(this.renderer));
      return l;
    };
    return {
      load: async (url) => {
        try {
          const gltf = await (await (loader ??= make())).loadAsync(url);
          this.requestRender();
          return gltf.scene;
        } catch {
          return null; // keep the placeholder box
        }
      },
    };
  }

  private collectTagged(): void {
    this.cutawayObjects = [];
    this.slotObjects = [];
    this.sync.root.traverse((o) => {
      const t = tagsOf(o);
      if (!t) return;
      if (t.cutaway) this.cutawayObjects.push(o);
      if (t.slot && (o as THREE.Mesh).isMesh) {
        const m = o as THREE.Mesh;
        m.userData['baseMaterial'] ??= m.material;
        this.slotObjects.push(m);
      }
    });
  }

  private updateModuleBox(): void {
    const b = new THREE.Box3();
    for (const id of ['frame', 'roof', 'floor', 'wall-S', 'wall-N', 'wall-W', 'wall-E']) {
      const c = this.sync.component(id);
      if (c) b.expandByObject(c);
    }
    if (b.isEmpty()) b.setFromObject(this.sync.root);
    this.moduleBox = b;
  }

  private frameModule(): void {
    const c = this.moduleBox.getCenter(new THREE.Vector3());
    const r = this.moduleBox.getBoundingSphere(new THREE.Sphere()).radius;
    const d = new THREE.Vector3(...VIEW_DIR.iso_front).normalize();
    this.controls.target.copy(c);
    this.camera.position.copy(c).addScaledVector(d, r / Math.sin(THREE.MathUtils.degToRad(this.camera.fov) / 2));
    this.camera.lookAt(c);
    this.controls.update();
  }

  private fitShadow(): void {
    const sphere = this.moduleBox.getBoundingSphere(new THREE.Sphere());
    const r = sphere.radius * 1.6;
    this.sun.position.copy(sphere.center).add(new THREE.Vector3(-0.6, 1, 0.45).normalize().multiplyScalar(r * 2));
    this.sun.target.position.copy(sphere.center);
    const cam = this.sun.shadow.camera;
    cam.left = -r;
    cam.right = r;
    cam.top = r;
    cam.bottom = -r;
    cam.near = 0.1;
    cam.far = r * 4;
    cam.updateProjectionMatrix();
    this.sun.shadow.needsUpdate = true;
  }

  private onCameraChange(): void {
    if (this.section) {
      const f = this.computeFront();
      if (f !== this.front) this.applySection();
    }
    this.requestRender();
  }

  private computeFront(): ExteriorWallId {
    const c = this.moduleBox.getCenter(new THREE.Vector3());
    const s = this.moduleBox.getSize(new THREE.Vector3());
    const p = this.camera.position;
    // three → core plan: x_core = x, y_core = −z (metres; ratios only)
    return frontWall([p.x, -p.z], [c.x, -c.z], [s.x, s.z]);
  }

  private applySection(): void {
    this.front = this.computeFront();
    for (const o of this.cutawayObjects) o.visible = !(this.section && hiddenInSection(tagsOf(o)?.cutaway, this.front));
  }

  private applyHighlight(): void {
    const on = (t: SlotRef) =>
      (this.hovered && this.hovered.wall === t.wall && this.hovered.index === t.index) || this.highlighted.some((h) => h.wall === t.wall && h.index === t.index);
    for (const m of this.slotObjects) {
      const s = tagsOf(m)!.slot!;
      const base = m.userData['baseMaterial'] as THREE.Material;
      m.material = on(s) ? this.lib.highlighted(base) : base;
    }
  }

  private emit<K extends keyof Events>(type: K, e: Events[K]): void {
    for (const cb of this.listeners[type] ?? []) cb(e);
  }

  private onPointerDown = (e: PointerEvent) => {
    this.pointerDown = { x: e.clientX, y: e.clientY };
  };

  private onPointerUp = (e: PointerEvent) => {
    const d = this.pointerDown;
    this.pointerDown = undefined;
    if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 5) return; // drag = orbit, not click
    const r = this.renderer.domElement.getBoundingClientRect();
    const slot = this.pickSlot(e.clientX - r.left, e.clientY - r.top);
    if (slot) this.emit('slotclick', slot);
  };

  private hoverPending = false;
  private onPointerMove = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse' || this.pointerDown || this.hoverPending) return;
    this.hoverPending = true;
    requestAnimationFrame(() => {
      this.hoverPending = false;
      const r = this.renderer.domElement.getBoundingClientRect();
      const slot = this.pickSlot(e.clientX - r.left, e.clientY - r.top);
      const same = slot && this.hovered && slot.wall === this.hovered.wall && slot.index === this.hovered.index;
      if (same || (!slot && !this.hovered)) return;
      this.hovered = slot;
      this.renderer.domElement.style.cursor = slot ? 'pointer' : '';
      this.applyHighlight();
      this.emit('slothover', slot);
      this.requestRender();
    });
  };

  private onPointerLeave = () => {
    if (!this.hovered) return;
    this.hovered = null;
    this.applyHighlight();
    this.emit('slothover', null);
    this.requestRender();
  };
}

/** Converts a snapshot data URL to a Blob for upload. */
export async function snapshotBlob(s: Snapshot): Promise<Blob> {
  return (await fetch(s.dataUrl)).blob();
}
