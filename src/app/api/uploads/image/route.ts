import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { handler, requireWriteAccess } from '@/lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_KINDS = new Set(['product', 'supplier', 'sale']);

export const POST = handler(async (request: Request) => {
  const denied = await requireWriteAccess();
  if (denied) return denied;

  const formData = await request.formData();
  const file = formData.get('file');
  const rawKind = String(formData.get('kind') || 'product');
  const kind = ALLOWED_KINDS.has(rawKind) ? rawKind : 'product';

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'Foto wajib dipilih.' }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: 'Format foto harus JPG, PNG, atau WebP.' }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: 'Ukuran foto maksimal 8 MB.' }, { status: 400 });
  }

  const extension = file.type === 'image/png' ? 'png' : file.type === 'image/jpeg' ? 'jpg' : 'webp';
  const blob = await put(`${kind}/${crypto.randomUUID()}.${extension}`, file, {
    access: 'public',
    addRandomSuffix: false,
    contentType: file.type,
  });

  return NextResponse.json({ url: blob.url });
});