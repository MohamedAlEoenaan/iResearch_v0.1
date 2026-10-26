import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import {
  authenticate,
  currentActor,
  emailSchema,
  passwordSchema,
  rateLimit,
  redeemAuthToken,
  register,
  requestPasswordReset,
  revokeSession,
  sealSessionToken,
  unsealSessionToken,
  sessionCookie,
} from '@/server/auth';
import {
  acceptInvitation,
  inviteMember,
  reviewOrganization,
  setMemberActive,
  setOrgAdministrator,
  setServiceAuthorization,
  setOrganizationAm,
} from '@/server/organizations';
import {
  acquireAmLock,
  createDraft,
  decideApproval,
  editDraft,
  grantAccess,
  operate,
  releaseAmLock,
  submitForApproval,
  transferOwner,
  setRequestAm,
  type Operation,
} from '@/server/requests';
import { DomainError, invariant } from '@/server/errors';
import { requirePermission } from '@/server/policy';
import { unavailable } from '@/server/integrations';
import { setInternalRole } from '@/server/admin';
const idSchema = z.uuid();
const commandSchema = z.object({
  command: z.string().max(60),
  id: z.string().optional(),
  version: z.number().int().positive().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
});
export async function POST(req: NextRequest) {
  try {
    const origin = process.env.APP_ORIGIN;
    invariant(origin, 'APP_ORIGIN is not configured.', 503);
    invariant(
      req.headers.get('origin') === new URL(origin).origin,
      'Request origin is not allowed.',
      403,
    );
    invariant(
      req.headers.get('content-type')?.startsWith('application/json'),
      'JSON content type is required.',
      415,
    );
    invariant(
      Number(req.headers.get('content-length') ?? 0) < 100_000,
      'Request is too large.',
      413,
    );
    const body = await req.text();
    invariant(body.length < 100_000, 'Request is too large.', 413);
    const {
      command,
      id,
      version,
      data = {},
    } = commandSchema.parse(JSON.parse(body));
    // Do not trust forwarding headers. Deployment must add trusted proxy-aware rate limiting.
    const key = `auth:${command}:${typeof data.email === 'string' ? data.email.toLowerCase() : 'anonymous'}`;
    const str = (name: string) =>
      z
        .string()
        .max(50000)
        .parse(data[name] ?? '');
    const bool = (name: string) => z.boolean().parse(data[name]);
    const requestId = () => idSchema.parse(id);
    const requestVersion = () => z.number().int().positive().parse(version);
    if (command === 'login') {
      await rateLimit(key);
      await rateLimit('login:global', 1000);
      const email = emailSchema.parse(data.email),
        password = z.string().max(128).parse(data.password);
      const token = await authenticate(email, password);
      const previous = req.cookies.get(sessionCookie)?.value;
      if (previous) await revokeSession(await unsealSessionToken(previous));
      const response = NextResponse.json({ ok: true, redirect: '/dashboard' });
      response.cookies.set(sessionCookie, await sealSessionToken(token), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 12 * 60 * 60,
      });
      return response;
    }
    if (command === 'register') {
      await rateLimit('register:global', 100);
      await register(data);
      return NextResponse.json({
        ok: true,
        message:
          'Registration recorded. Email verification is pending because email delivery is disabled. Organization registration also requires administrator review.',
      });
    }
    if (command === 'forgot_password') {
      await rateLimit(key, 3);
      await requestPasswordReset(emailSchema.parse(data.email));
      return NextResponse.json({
        ok: true,
        message:
          'If the account exists, a reset request has been recorded. Email delivery is currently disabled; no reset email has been sent.',
      });
    }
    if (command === 'verify_email' || command === 'reset_password') {
      await rateLimit(`token:${command}`, 100);
      await redeemAuthToken(
        str('token'),
        command === 'verify_email' ? 'VERIFY_EMAIL' : 'PASSWORD_RESET',
        command === 'reset_password'
          ? passwordSchema.parse(data.password)
          : undefined,
      );
      return NextResponse.json({ ok: true, redirect: '/login' });
    }
    if (command === 'accept_invitation') {
      await rateLimit('invitation:accept', 100);
      await acceptInvitation(str('token'), data);
      return NextResponse.json({ ok: true, redirect: '/login' });
    }
    const actor = await currentActor();
    invariant(actor, 'Please sign in to continue.', 401);
    await rateLimit(`mutation:${actor.id}`, 300);
    let result: unknown;
    switch (command) {
      case 'logout': {
        const token = req.cookies.get(sessionCookie)?.value ?? '';
        await revokeSession(await unsealSessionToken(token));
        const response = NextResponse.json({ ok: true, redirect: '/login' });
        response.cookies.set(sessionCookie, '', {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: 0,
        });
        return response;
      }
      case 'organization_am':
        await setOrganizationAm(
          actor,
          requestId(),
          data.targetUserId ? z.uuid().parse(data.targetUserId) : null,
        );
        break;
      case 'request_am':
        await setRequestAm(
          actor,
          requestId(),
          requestVersion(),
          data.targetUserId ? z.uuid().parse(data.targetUserId) : null,
        );
        break;
      case 'organization_review':
        await reviewOrganization(
          actor,
          requestId(),
          bool('approve'),
          str('reason'),
        );
        break;
      case 'organization_activate':
        await setServiceAuthorization(actor, requestId(), bool('active'));
        break;
      case 'organization_admin':
        await setOrgAdministrator(actor, requestId(), bool('appoint'));
        break;
      case 'member_active':
        await setMemberActive(actor, requestId(), bool('active'));
        break;
      case 'invite':
        await rateLimit(`invitation:${actor.id}`, 20);
        await inviteMember(actor, str('email'));
        return NextResponse.json({
          ok: true,
          message:
            'Invitation recorded. Delivery is blocked until an email provider is configured.',
        });
      case 'create_draft': {
        const newId = await createDraft(actor, data);
        return NextResponse.json({ ok: true, redirect: `/requests/${newId}` });
      }
      case 'edit_draft':
        await editDraft(actor, requestId(), requestVersion(), data);
        break;
      case 'submit_approval':
        await submitForApproval(actor, requestId(), requestVersion());
        break;
      case 'decide_approval':
        await decideApproval(
          actor,
          requestId(),
          requestVersion(),
          bool('approve'),
          str('reason'),
        );
        break;
      case 'acquire_lock':
        result = await acquireAmLock(actor, requestId());
        break;
      case 'override_lock':
        await acquireAmLock(actor, requestId(), true);
        break;
      case 'release_lock':
        await releaseAmLock(actor, requestId(), str('leaseToken'));
        break;
      case 'operate': {
        const action = z
          .enum([
            'validate',
            'request_info',
            'respond_info',
            'assign',
            'researcher_question',
            'submit_deliverable',
            'qa_approve',
            'qa_reject',
            'deliver',
            'accept',
            'revision',
            'scope_in',
            'scope_out',
            'cancel',
            'cancel_approve',
            'cancel_reject',
            'feedback',
            'clarification',
          ])
          .parse(data.action) as Operation;
        await operate(actor, requestId(), requestVersion(), action, {
          text: str('text'),
          targetUserId:
            typeof data.targetUserId === 'string'
              ? idSchema.parse(data.targetUserId)
              : undefined,
          leaseToken:
            typeof data.leaseToken === 'string' ? data.leaseToken : undefined,
        });
        break;
      }
      case 'transfer_owner':
        await transferOwner(
          actor,
          requestId(),
          requestVersion(),
          idSchema.parse(data.targetUserId),
        );
        break;
      case 'grant_access':
        await grantAccess(
          actor,
          requestId(),
          idSchema.parse(data.targetUserId),
          bool('revoke'),
        );
        break;
      case 'checkout':
        unavailable('payments');
      case 'upload':
        unavailable('storage');
      case 'catalog_active': {
        requirePermission(actor, 'catalog.manage');
        const serviceId = requestId();
        await db.$transaction(async (tx) => {
          await tx.service.update({
            where: { id: serviceId },
            data: { active: bool('active') },
          });
          await tx.auditEvent.create({
            data: {
              actorId: actor.id,
              entityId: serviceId,
              action: 'catalog.activation_changed',
              metadata: { active: bool('active') },
            },
          });
        });
        break;
      }
      case 'internal_role':
        await setInternalRole(actor, requestId(), str('roleId'));
        break;
      case 'notification_read':
        await db.notification.updateMany({
          where: { id: requestId(), userId: actor.id },
          data: { readAt: new Date() },
        });
        break;
      case 'profile': {
        const name = z.string().trim().min(2).max(100).parse(data.name);
        await db.$transaction(async (tx) => {
          await tx.user.update({ where: { id: actor.id }, data: { name } });
          await tx.auditEvent.create({
            data: {
              actorId: actor.id,
              organizationId: actor.organizationId,
              entityId: actor.id,
              action: 'profile.updated',
              metadata: {},
            },
          });
        });
        break;
      }
      default:
        throw new DomainError('Unknown command.', 400);
    }
    return NextResponse.json({ ok: true, result, message: 'Changes saved.' });
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json(
        { ok: false, error: error.issues.map((i) => i.message).join(' ') },
        { status: 400 },
      );
    if (error instanceof DomainError)
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.status },
      );
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002')
        return NextResponse.json(
          {
            ok: false,
            error: 'An account or record with these details already exists.',
          },
          { status: 409 },
        );
      if (error.code === 'P2025')
        return NextResponse.json(
          { ok: false, error: 'Record not found.' },
          { status: 404 },
        );
    }
    if (error instanceof SyntaxError)
      return NextResponse.json(
        { ok: false, error: 'Invalid JSON.' },
        { status: 400 },
      );
    console.error(
      'Command failed:',
      error instanceof Error ? error.name : 'UnknownError',
    );
    return NextResponse.json(
      {
        ok: false,
        error: 'The operation could not be completed. Please try again.',
      },
      { status: 500 },
    );
  }
}
