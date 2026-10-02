/** API client for the admin (session cookie, same site as the API). */
export const API = ((import.meta.env['VITE_API_BASE'] as string | undefined) ?? 'http://localhost:3000').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(readonly status: number, readonly body: unknown) {
    super(`HTTP ${status}`);
  }
}

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  const r = await fetch(`${API}${path}`, {
    credentials: 'include',
    ...rest,
    headers: { ...(json !== undefined ? { 'content-type': 'application/json' } : {}), ...(rest.headers ?? {}) },
    ...(json !== undefined ? { body: JSON.stringify(json) } : {}),
  });
  const ct = r.headers.get('content-type') ?? '';
  const body = r.status === 204 ? null : ct.includes('json') ? await r.json() : await r.text();
  if (!r.ok) throw new ApiError(r.status, body);
  return body as T;
}

export interface Me {
  id: string;
  email: string;
  role: 'admin' | 'sales';
  tenantId: string;
  tenant: { slug: string; name: string };
}

export const fileUrl = (id: string) => `${API}/admin/files/${id}`;
export const exportUrl = (configId: string, name: string, revision?: number) => `${API}/configs/${configId}/exports/${name}${revision ? `?revision=${revision}` : ''}`;
