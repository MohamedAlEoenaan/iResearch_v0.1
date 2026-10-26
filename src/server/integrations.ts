import { DomainError } from './errors';
export const integrations = {
  email: {
    state: 'BLOCKED',
    reason:
      'Provider selection and delivery are disabled by the project owner.',
  },
  payments: {
    state: 'BLOCKED',
    reason:
      'Provider selection, checkout, and webhook verification are disabled by the project owner.',
  },
  storage: {
    state: 'BLOCKED',
    reason:
      'Private storage and malware scanning require provider configuration.',
  },
  catalog: {
    state: 'IMPORTED',
    reason:
      '24 English entries imported from the official website. Prices match the source and include VAT, confirmed by the project owner.',
  },
} as const;
export interface PaymentProvider {
  verifyWebhook(
    rawBody: string,
    signature: string,
  ): Promise<{
    eventId: string;
    reference: string;
    amount: number;
    currency: string;
    paid: boolean;
  }>;
}
export interface EmailProvider {
  send(to: string, subject: string, body: string): Promise<string>;
}
export interface PrivateObjectStorage {
  put(key: string, content: Uint8Array, mime: string): Promise<void>;
  signedDownload(key: string, expiresIn: number): Promise<string>;
}
export interface MalwareScanner {
  scan(content: Uint8Array): Promise<'CLEAN' | 'INFECTED'>;
}
export function unavailable(kind: keyof typeof integrations): never {
  throw new DomainError(integrations[kind].reason, 503);
}
