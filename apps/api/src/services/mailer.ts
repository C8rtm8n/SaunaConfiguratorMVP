export interface Mail {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
  attachments?: Array<{ filename: string; content: Buffer; contentType: string }>;
}

export interface Mailer {
  send(m: Mail): Promise<void>;
}

/** Dev/test outbox (SMTP_URL=memory). */
export class MemoryMailer implements Mailer {
  readonly outbox: Array<Mail & { at: Date }> = [];
  async send(m: Mail): Promise<void> {
    this.outbox.push({ ...m, at: new Date() });
  }
}

export async function createMailer(url: string, from: string): Promise<Mailer> {
  if (url === 'memory') return new MemoryMailer();
  const { default: nodemailer } = await import('nodemailer');
  const t = nodemailer.createTransport(url);
  return {
    async send(m) {
      await t.sendMail({ from, ...m });
    },
  };
}
