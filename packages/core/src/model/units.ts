/**
 * Units used everywhere in core. Conversions (m, t, EUR, VAT) happen only in
 * the presentation layer. Aliases are documentation; they are not branded.
 */

/** Length in millimetres. */
export type Mm = number;
/** Mass in kilograms. */
export type Kg = number;
/** Money in CZK excluding VAT. */
export type Czk = number;
/** Area in m² (catalog unit prices are per m²). */
export type M2 = number;
/** Volume in m³. */
export type M3 = number;
/** Power in kW. */
export type Kw = number;
/** Force in kN (support / lifting reactions). */
export type Kn = number;
/** Ratio 0..1 (waste, margin, deviation). Never a percentage number. */
export type Ratio = number;

/**
 * Point or vector in module coordinates [mm].
 * Origin: left-front-bottom outer corner of the module (see docs/DECISIONS.md D-004).
 * X = length, Y = width, Z = height.
 */
export type Vec3 = readonly [x: Mm, y: Mm, z: Mm];
export type Vec2 = readonly [u: Mm, v: Mm];

/** Stable identifier of a config entity (opening, zone, attachment…). */
export type Id = string;
/** Catalog SKU reference. Must resolve in the catalog of `Config.catalogVersion`. */
export type SkuRef = string;
