export type EmailPayload = {
  to: string;
  subject: string;
  html?: string;
  text?: string;
};

export function buildEmailPayload(payload: EmailPayload): EmailPayload {
  return payload;
}
