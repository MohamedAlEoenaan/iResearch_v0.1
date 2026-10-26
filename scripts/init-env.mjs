import { randomBytes } from 'node:crypto';
import { existsSync, writeFileSync, readFileSync } from 'node:fs';
if (process.env.NODE_ENV === 'production')
  throw new Error('Local environment generation is not for production.');
if (!existsSync('.env')) {
  const password = randomBytes(24).toString('hex');
  writeFileSync(
    '.env',
    `DATABASE_URL=postgresql://iresearch:${password}@localhost:5432/iresearch?schema=public\nPOSTGRES_PASSWORD=${password}\nAPP_ORIGIN=http://localhost:3000\nSESSION_SECRET=${randomBytes(48).toString('base64url')}\n`,
    { mode: 0o600, flag: 'wx' },
  );
  console.log('Created ignored .env with a generated local database password.');
} else {
  console.log('Preserved existing .env.');
  if (!/^SESSION_SECRET=/m.test(readFileSync('.env', 'utf8'))) {
    writeFileSync(
      '.env',
      `\nSESSION_SECRET=${randomBytes(48).toString('base64url')}\n`,
      { flag: 'a', mode: 0o600 },
    );
    console.log('Added a generated local session secret to .env.');
  }
}
if (!existsSync('.env.test')) {
  const source = readFileSync('.env', 'utf8');
  const match = source.match(/^DATABASE_URL=(.+)$/m);
  if (!match) throw new Error('DATABASE_URL missing from .env.');
  const url = new URL(match[1]);
  url.pathname = url.pathname.replace(/\/$/, '') + '_test';
  writeFileSync(
    '.env.test',
    `DATABASE_URL=${url}\nAPP_ORIGIN=http://localhost:3000\nSESSION_SECRET=${randomBytes(48).toString('base64url')}\n`,
    { mode: 0o600, flag: 'wx' },
  );
  console.log('Created ignored .env.test for the separate *_test database.');
}
