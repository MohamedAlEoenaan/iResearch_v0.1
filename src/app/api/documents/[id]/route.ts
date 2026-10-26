import { currentActor } from '@/server/auth';
import { db } from '@/lib/db';
import { requestScope } from '@/server/requests';
import { z } from 'zod';
export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const actor = await currentActor();
  if (!actor) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success)
    return Response.json({ error: 'Not found' }, { status: 404 });
  const document = await db.document.findFirst({
    where: {
      id,
      request: await requestScope(actor),
      ...(actor.accountType === 'INTERNAL'
        ? {}
        : { visibility: 'CLIENT', scanStatus: 'CLEAN' }),
    },
  });
  if (!document) return Response.json({ error: 'Not found' }, { status: 404 });
  return Response.json(
    { error: 'Private file storage is disabled. No download URL was created.' },
    { status: 503 },
  );
}
