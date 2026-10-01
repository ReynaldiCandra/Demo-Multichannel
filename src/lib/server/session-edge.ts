import { jwtVerify } from 'jose';

export const SESSION_COOKIE = 'dashboard_session';

export type Role = 'owner' | 'demo';

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  /**
   * Tenant milik user (multi-tenant, fase 1). Opsional hanya supaya token
   * lama yang masih tersimpan di cookie tidak langsung invalid — token tanpa
   * claim ini dianggap belum terikat workspace.
   */
  workspaceId?: string;
};

/**
 * Verifikasi token tanpa `next/headers`, supaya bisa dipanggil dari middleware
 * yang jalan di Edge runtime.
 */
export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    if (!payload.sub) return null;
    return {
      id: payload.sub,
      email: String(payload.email ?? ''),
      name: String(payload.name ?? ''),
      role: payload.role === 'demo' ? 'demo' : 'owner',
      workspaceId:
        typeof payload.workspaceId === 'string' && payload.workspaceId
          ? payload.workspaceId
          : undefined,
    };
  } catch {
    return null;
  }
}
