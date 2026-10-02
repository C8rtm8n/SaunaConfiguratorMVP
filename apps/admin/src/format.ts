export const czk = (v: number) => new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK', maximumFractionDigits: 0 }).format(v);
export const num = (v: number, d = 1) => new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: d }).format(v);
export const date = (s: string | Date) => new Date(s).toLocaleString('cs-CZ', { dateStyle: 'short', timeStyle: 'short' });
export const STATUS: Record<string, string> = { new: 'Nová', negotiating: 'V jednání', won: 'Vyhráno', lost: 'Prohráno' };
