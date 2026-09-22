import { NextResponse } from 'next/server';
import { asc } from 'drizzle-orm';
import { db, hostsTable } from '@/lib/db';
import { badRequest, handler, parseBody, requireWriteAccess } from '@/lib/server/http';
import { HostInput } from '@/lib/server/validation';

export const dynamic = 'force-dynamic';

export const GET = handler(async () =>
  NextResponse.json(await db.select().from(hostsTable).orderBy(asc(hostsTable.name))),
);

export const POST = handler(async (request: Request) => {
  const denied = await requireWriteAccess();
  if (denied) return denied;

  const parsed = await parseBody(request, HostInput);
  if (!parsed.success) return badRequest(parsed.error);

  const [host] = await db.insert(hostsTable).values(parsed.data).returning();
  return NextResponse.json(host, { status: 201 });
});
