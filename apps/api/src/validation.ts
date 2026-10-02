import { z } from 'zod';
import type { SaunaConfig } from '@sauna/core';

/**
 * Shape validation of untrusted input (browser). Domain validity is checked by
 * core (normalizeConfig + rules); catalog references by createCatalogIndex.
 */
const mm = z.number().finite().min(-100_000).max(100_000);
const sku = z.string().min(1).max(80);
const id = z.string().min(1).max(64).regex(/^[\w-]+$/);
const wall = z.string().regex(/^(N|S|E|W|P\d{1,2})$/);
const extWall = z.enum(['N', 'S', 'E', 'W']);

const attachment = z.discriminatedUnion('type', [
  z.object({ id, type: z.literal('terrace'), wall: extWall, depth_mm: mm, slotFrom: z.number().int().min(0).max(100).optional(), slotTo: z.number().int().min(0).max(100).optional(), sku }),
  z.object({ id, type: z.literal('roof_overhang'), wall: extWall, depth_mm: mm, sku }),
  z.object({ id, type: z.literal('stairs'), attachTo: z.string().max(64), edge: extWall, slot: z.number().int().min(0).max(100), sku }),
  z.object({ id, type: z.literal('railing'), attachTo: z.string().max(64), edges: z.array(extWall).max(4), sku }),
]);

export const configSchema = z.object({
  id: z.string().max(64),
  revision: z.number().int().min(0).max(1_000_000),
  tenantId: z.string().min(1).max(64),
  catalogVersion: z.string().max(64),
  schemaVersion: z.literal(1),
  productLine: z.literal('sauna'),
  module: z.object({ type: z.enum(['custom_frame', 'iso_20hc']), L_mm: mm, W_mm: mm, H_mm: mm, grid_mm: z.union([z.literal(600), z.literal(1200)]) }),
  cladding: z.object({ exterior: sku, orientation: z.enum(['vertical', 'horizontal']), roof: sku }),
  openings: z
    .array(
      z.object({
        id,
        wall,
        slotFrom: z.number().int().min(0).max(100),
        slotTo: z.number().int().min(0).max(100),
        type: z.enum(['window', 'panorama', 'glass_front', 'door', 'vent']),
        sku,
        door: z.object({ hinge: z.enum(['left', 'right']), swing: z.enum(['out', 'in']) }).optional(),
      }),
    )
    .max(40),
  zones: z.array(z.object({ id, type: z.enum(['sauna', 'changing']), from_mm: mm, to_mm: mm })).min(1).max(4),
  sauna: z.object({
    zoneId: id,
    heater: z.object({ sku, wall, along_mm: mm }),
    benches: z.object({ system: sku, layout: z.enum(['straight', 'L']), levels: z.union([z.literal(2), z.literal(3)]), wall, returnWall: wall.optional(), returnLength_mm: mm.optional(), from_mm: mm.optional(), to_mm: mm.optional() }),
    lighting: z.array(z.object({ sku, mount: z.enum(['under_bench', 'backrest', 'ceiling', 'wall']), qty: z.number().int().min(1).max(20) })).max(10),
    interiorCladding: sku,
  }),
  attachments: z.array(attachment).max(10),
  foundation: z.enum(['pads', 'screws', 'beams']),
  delivery: z.object({ postalCode: z.string().max(12).optional(), country: z.enum(['CZ', 'DE', 'AT', 'SK']).optional(), distance_km: z.number().min(0).max(5000).optional() }).optional(),
});

export function parseConfig(input: unknown): SaunaConfig {
  return configSchema.parse(input) as unknown as SaunaConfig;
}

export const contactSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().max(200).email(),
  phone: z.string().trim().max(40).default(''),
  postalCode: z.string().trim().min(3).max(12),
  term: z.string().trim().max(120).default(''),
  budget: z.string().trim().max(120).default(''),
  note: z.string().trim().max(4000).default(''),
  consent: z.literal(true),
});

export const leadPayloadSchema = z.object({
  tenant: z.string().min(1).max(64),
  config: z.unknown(),
  contact: contactSchema,
  locale: z.enum(['cs', 'de', 'en']).default('cs'),
  clientPrice: z.number().optional(),
  /** Honeypot: bots fill it, people do not see it. */
  website: z.string().max(0).optional(),
});

export const SNAPSHOT_VIEWS = ['iso_front', 'iso_back', 'front', 'section'] as const;
export const UPLOAD_LIMITS = { photoBytes: 10 * 1024 * 1024, snapshotBytes: 3 * 1024 * 1024, files: 6 };
export const IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp'];
