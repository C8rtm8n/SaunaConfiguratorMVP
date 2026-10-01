export type Locale = 'cs' | 'de' | 'en';

/** Localised text. Fallback chain: requested → en → cs. */
export type I18nText = { cs: string } & Partial<Record<Exclude<Locale, 'cs'>, string>>;

/**
 * Message template with `{name}` placeholders, filled from `params`
 * at presentation time (numbers stay in core units, formatting is UI's job).
 */
export type I18nTemplate = I18nText;
