import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

export interface EmailOptions {
  to: string | string[];
  subject: string;
  template?: string;
  context?: any;
  html?: string;
  attachments?: any[];
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly mailerService: MailerService) {}

  async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      await this.mailerService.sendMail({
        to: options.to,
        subject: options.subject,
        template: options.template,
        context: options.context,
        html: options.html,
        attachments: options.attachments,
      });

      this.logger.log(`Email sent successfully to ${options.to}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send email to ${options.to}`, error);
      return false;
    }
  }

  async sendReportEmail(
    to: string | string[],
    reportType: string,
    pdfBuffer: Buffer,
    reportData: any,
  ): Promise<boolean> {
    const subject = this.getReportSubject(reportType);
    const fileName = this.getReportFileName(reportType);

    return this.sendEmail({
      to,
      subject,
      template: 'report',
      context: {
        reportType: this.getReportTypeName(reportType),
        reportData,
        generatedDate: new Date(),
      },
      attachments: [
        {
          filename: fileName,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });
  }

  async sendAlertEmail(
    to: string | string[],
    alert: any,
    tank: any,
  ): Promise<boolean> {
    return this.sendEmail({
      to,
      subject: `⚠️ Alerta: ${this.getAlertTypeName(alert.type)} - Tanque ${tank.code}`,
      template: 'alert',
      context: {
        alert,
        tank,
        alertType: this.getAlertTypeName(alert.type),
        severity: this.getSeverityName(alert.severity),
        generatedDate: new Date(),
      },
    });
  }

  async sendRechargeNotification(
    to: string | string[],
    recharge: any,
    tank: any,
    notificationType: 'scheduled' | 'reminder' | 'completed' | 'cancelled',
  ): Promise<boolean> {
    const subjects = {
      scheduled: `Recarga Programada - Tanque ${tank.code}`,
      reminder: `Recordatorio de Recarga - Tanque ${tank.code}`,
      completed: `Recarga Completada - Tanque ${tank.code}`,
      cancelled: `Recarga Cancelada - Tanque ${tank.code}`,
    };

    return this.sendEmail({
      to,
      subject: subjects[notificationType],
      template: 'recharge-notification',
      context: {
        recharge,
        tank,
        notificationType,
        generatedDate: new Date(),
      },
    });
  }

  async sendWelcomeEmail(user: any): Promise<boolean> {
    return this.sendEmail({
      to: user.email,
      subject: 'Bienvenido al Sistema de Monitoreo de Tanques de Gas',
      template: 'welcome',
      context: {
        user,
        loginUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
      },
    });
  }

  async sendPasswordResetEmail(
    email: string,
    resetToken: string,
  ): Promise<boolean> {
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;

    return this.sendEmail({
      to: email,
      subject: 'Restablecer Contraseña - Sistema de Monitoreo',
      template: 'password-reset',
      context: {
        resetUrl,
        expiresIn: '1 hora',
      },
    });
  }

  async sendMonthlyReport(
    to: string | string[],
    reportData: any,
    pdfBuffer: Buffer,
  ): Promise<boolean> {
    return this.sendEmail({
      to,
      subject: `Informe Mensual - ${new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}`,
      template: 'monthly-report',
      context: {
        reportData,
        month: new Date().toLocaleDateString('es-ES', { month: 'long' }),
        year: new Date().getFullYear(),
      },
      attachments: [
        {
          filename: `informe-mensual-${new Date().toISOString().slice(0, 7)}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });
  }

  private getReportSubject(reportType: string): string {
    const subjects = {
      'tank-report': 'Informe de Tanque',
      'general-report': 'Informe General del Sistema',
      'client-report': 'Informe de Cliente',
      'consumption-report': 'Informe de Consumo',
      'alerts-report': 'Informe de Alertas',
      'recharges-report': 'Informe de Recargas',
    };
    return subjects[reportType] || 'Informe del Sistema';
  }

  private getReportFileName(reportType: string): string {
    const date = new Date().toISOString().split('T')[0];
    return `${reportType}-${date}.pdf`;
  }

  private getReportTypeName(reportType: string): string {
    const types = {
      'tank-report': 'Informe de Tanque',
      'general-report': 'Informe General',
      'client-report': 'Informe de Cliente',
      'consumption-report': 'Informe de Consumo',
      'alerts-report': 'Informe de Alertas',
      'recharges-report': 'Informe de Recargas',
    };
    return types[reportType] || 'Informe';
  }

  private getAlertTypeName(alertType: string): string {
    const types = {
      low_level: 'Nivel Bajo',
      critical_level: 'Nivel Crítico',
      sensor_failure: 'Falla de Sensor',
      consumption_anomaly: 'Anomalía de Consumo',
      maintenance_required: 'Mantenimiento Requerido',
    };
    return types[alertType] || alertType;
  }

  private getSeverityName(severity: string): string {
    const severities = {
      info: 'Información',
      warning: 'Advertencia',
      critical: 'Crítico',
    };
    return severities[severity] || severity;
  }
}