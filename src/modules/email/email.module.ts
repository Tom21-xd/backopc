import { Module } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { EmailService } from './email.service';
import * as path from 'path';

@Module({
  imports: [
    MailerModule.forRoot({
      transport: {
        host: process.env.MAIL_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.MAIL_PORT) || 587,
        secure: false,
        auth: {
          user: process.env.MAIL_USER || 'your-email@gmail.com',
          pass: process.env.MAIL_PASSWORD || 'your-app-password',
        },
      },
      defaults: {
        from: `"Sistema de Monitoreo de Gas" <${process.env.MAIL_FROM || 'noreply@gasmonitoring.com'}>`,
      },
      template: {
        dir: path.join(__dirname, '..', '..', '..', 'templates', 'email'),
        adapter: new HandlebarsAdapter(),
        options: {
          strict: true,
        },
      },
    }),
  ],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}