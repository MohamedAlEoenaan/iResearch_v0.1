export async function POST() {
  return Response.json(
    { error: 'Payment integration is disabled. No event was accepted.' },
    { status: 503 },
  );
}
