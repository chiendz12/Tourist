import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { buildEmailPayload, EmailPayload } from '../../utils/email.utils';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter?: nodemailer.Transporter;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async send(payload: EmailPayload): Promise<void> {
    const host = this.config.get<string>('smtp.host');
    const from = this.config.get<string>('smtp.from') ?? this.config.get<string>('smtp.user');
    if (!host || !from) return;

    try {
      if (!this.transporter) {
        const port = this.config.get<number>('smtp.port', 587);
        this.transporter = nodemailer.createTransport({
          host,
          port,
          secure: port === 465,
          auth: {
            user: this.config.get<string>('smtp.user'),
            pass: this.config.get<string>('smtp.pass'),
          },
        });
      }
      await this.transporter.sendMail({ from, ...buildEmailPayload(payload) });
    } catch (error) {
      // Email is a notification channel, not a reason to fail the workflow request.
      this.logger.error(`Could not send email to ${payload.to}: ${(error as Error).message}`);
    }
  }

  async sendToUser(userId: string, subject: string, body: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, fullName: true },
    });
    if (!user) return;
    await this.send({
      to: user.email,
      subject,
      text: `Xin chào ${user.fullName},\n\n${body}\n\nVietJourney`,
      html: `<p>Xin chào ${user.fullName},</p><p>${body.replace(/\n/g, '<br />')}</p><p>VietJourney</p>`,
    });
  }
}
