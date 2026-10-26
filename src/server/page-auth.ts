import { redirect, notFound } from 'next/navigation';
import { currentActor } from './auth';
import { has } from './policy';
export async function requireActor(permission?: string) {
  const actor = await currentActor();
  if (!actor) redirect('/login');
  if (permission && !has(actor, permission)) notFound();
  return actor;
}
