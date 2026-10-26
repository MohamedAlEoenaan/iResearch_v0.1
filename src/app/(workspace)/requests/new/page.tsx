import { z } from 'zod';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { requireActor } from '@/server/page-auth';
import { PageHeader, BackLink } from '@/components/workspace';
import { CommandForm } from '@/components/command-form';
export default async function NewRequest({
  searchParams,
}: {
  searchParams: Promise<{ serviceId?: string }>;
}) {
  const actor = await requireActor('request.create');
  const { serviceId } = await searchParams;
  if (serviceId && !z.uuid().safeParse(serviceId).success) notFound();
  const service = serviceId
    ? await db.service.findFirst({ where: { id: serviceId, active: true } })
    : null;
  if (serviceId && !service) notFound();
  return (
    <>
      <BackLink href="/requests" label="All requests" />
      <PageHeader
        eyebrow="Start something new"
        title="Define your research"
        description="A clear brief gives your research the right foundation."
      />
      <div className="split">
        <section className="card">
          <CommandForm
            command="create_draft"
            data={service ? { serviceId: service.id } : {}}
            fields={[
              {
                name: 'title',
                label: 'Request title',
                placeholder: 'Describe the focus of your research',
                required: true,
                minLength: 3,
                maxLength: 160,
              },
              {
                name: 'requirements',
                label: 'Research requirements',
                type: 'textarea',
                placeholder:
                  'Describe your question, objectives, expected output, and relevant context.',
                required: true,
                minLength: 20,
                maxLength: 50000,
              },
            ]}
            label="Save draft"
          />
        </section>
        <aside className="card stack">
          <p className="eyebrow">Before you submit</p>
          <h2>{service?.name ?? 'Custom research enquiry'}</h2>
          <p className="small muted">
            {actor.accountType === 'ORGANIZATION'
              ? 'Every organization request needs approval from an organization administrator, including requests they create themselves.'
              : 'Catalog requests require a verified payment before entering operations. Custom work requires a quotation.'}
          </p>
          <p className="notice small">
            {actor.accountType === 'ORGANIZATION'
              ? 'After approval, requirements are locked. Additional details are recorded as clarifications.'
              : 'Payment checkout and custom quotation conversion are not enabled. You can prepare a draft now.'}
          </p>
        </aside>
      </div>
    </>
  );
}
