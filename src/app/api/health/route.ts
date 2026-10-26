import { db } from '@/lib/db';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({
      status: 'ok',
      version: '0.1.0',
      database: 'connected',
    });
  } catch {
    return Response.json({ status: 'unavailable' }, { status: 503 });
  }
}
