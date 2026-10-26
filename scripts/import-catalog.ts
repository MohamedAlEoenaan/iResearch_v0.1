import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { db } from '../src/lib/db';
const schema = z.array(
  z.object({
    sourceId: z.string().min(1),
    name: z.string().min(1),
    category: z.string(),
    description: z.string(),
    amount: z.number().int().nonnegative(),
    currency: z.literal('SAR'),
    kind: z.enum(['SERVICE', 'PACKAGE']),
    taxHandling: z.literal('VAT_INCLUDED'),
    sourceVerifiedAt: z.iso
      .datetime({ offset: true })
      .transform((v) => new Date(v)),
    sourceUrl: z
      .url()
      .refine(
        (v) =>
          ['iresearch.com.sa', 'www.iresearch.com.sa'].includes(
            new URL(v).hostname,
          ),
        'Use an official catalog source URL.',
      ),
  }),
);
async function main() {
  if (!process.argv[2])
    throw new Error(
      'Usage: npx tsx scripts/import-catalog.ts /path/to/verified-catalog.json',
    );
  const rows = schema.parse(
    JSON.parse(await readFile(process.argv[2], 'utf8')),
  );
  if (new Set(rows.map((r) => r.sourceId)).size !== rows.length)
    throw new Error('Duplicate source IDs.');
  await db.$transaction(async (tx) => {
    for (const row of rows)
      await tx.service.upsert({
        where: { sourceId: row.sourceId },
        create: row,
        update: row,
      });
    await tx.auditEvent.create({
      data: {
        entityId: 'catalog',
        action: 'catalog.imported',
        metadata: { count: rows.length },
      },
    });
  });
  console.log(
    `Imported ${rows.length} verified catalog entries. Amounts are in halalas.`,
  );
}
main().finally(() => db.$disconnect());
