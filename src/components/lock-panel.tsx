'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LockKeyhole, UnlockKeyhole } from 'lucide-react';
import { Button } from './ui/button';
import { CommandForm, sendCommand } from './command-form';
export function LockPanel({
  id,
  version,
  status,
  holder,
  expires,
}: {
  id: string;
  version: number;
  status: string | null;
  holder: string | null;
  expires: string | null;
}) {
  const [lease, setLease] = useState(''),
    [until, setUntil] = useState(''),
    [error, setError] = useState('');
  const router = useRouter();
  return (
    <section className="card stack">
      <div className="section-heading">
        <LockKeyhole size={18} />
        <h2>Account manager controls</h2>
      </div>
      <p className="muted small">
        An exclusive editing lease lasts 5 minutes. Other account managers may
        continue reading.
      </p>
      <p className="small">
        {holder && expires
          ? `An editing lease is recorded until ${new Date(expires).toLocaleTimeString()}.`
          : 'No editing lease recorded.'}
      </p>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <div className="row">
        <Button
          variant="outline"
          onClick={async () => {
            try {
              const r = await sendCommand('acquire_lock', id);
              setLease(r.result.leaseToken);
              setUntil(r.result.expiresAt);
              setError('');
              router.refresh();
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          <LockKeyhole size={15} />
          {lease ? 'Renew editing lease' : 'Acquire editing lease'}
        </Button>
        {lease && (
          <Button
            variant="ghost"
            onClick={async () => {
              try {
                await sendCommand('release_lock', id, undefined, {
                  leaseToken: lease,
                });
                setLease('');
                setUntil('');
                router.refresh();
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            <UnlockKeyhole size={15} />
            Release
          </Button>
        )}
      </div>
      {lease && (
        <>
          <p className="small form-success">
            Your lease expires at {new Date(until).toLocaleTimeString()}.
          </p>
          {status === 'SUBMITTED' && (
            <CommandForm
              command="operate"
              id={id}
              version={version}
              data={{ action: 'validate', leaseToken: lease }}
              label="Mark ready for assignment"
            />
          )}
          {['SUBMITTED', 'IN_PROGRESS'].includes(status ?? '') && (
            <CommandForm
              command="operate"
              id={id}
              version={version}
              data={{ action: 'request_info', leaseToken: lease }}
              fields={[
                {
                  name: 'text',
                  label: 'Information needed from the client',
                  type: 'textarea',
                  required: true,
                },
              ]}
              label="Request client information"
              variant="outline"
            />
          )}
          {status === 'READY_FOR_DELIVERY' && (
            <CommandForm
              command="operate"
              id={id}
              version={version}
              data={{ action: 'deliver', leaseToken: lease }}
              label="Deliver QA-approved output"
            />
          )}
          {status === 'SCOPE_REVIEW' && (
            <div className="stack">
              <CommandForm
                command="operate"
                id={id}
                version={version}
                data={{ action: 'scope_in', leaseToken: lease }}
                fields={[
                  {
                    name: 'text',
                    label: 'Scope review comments',
                    type: 'textarea',
                    required: true,
                  },
                ]}
                label="Within scope · return to researcher"
              />
              <CommandForm
                command="operate"
                id={id}
                version={version}
                data={{ action: 'scope_out', leaseToken: lease }}
                fields={[
                  {
                    name: 'text',
                    label: 'Explain the separate quotation requirement',
                    type: 'textarea',
                    required: true,
                  },
                ]}
                label="Out of scope · notify client"
                variant="outline"
              />
            </div>
          )}
        </>
      )}
    </section>
  );
}
