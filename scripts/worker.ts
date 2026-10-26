import 'dotenv/config';
import { db } from '../src/lib/db';
// Deliberately does not mark email as sent, generate links, or call a provider.
async function main() {
  const blocked = await db.notificationOutbox.count({
    where: { status: 'BLOCKED' },
  });
  console.log(
    `Email delivery disabled. ${blocked} outbox records remain blocked. In-app notifications are created transactionally.`,
  );
}
main().finally(() => db.$disconnect());
