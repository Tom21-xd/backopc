import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OnEvent } from '@nestjs/event-emitter';
import { Alert, AlertType, AlertSeverity, AlertStatus } from '../../entities/alert.entity';
import { Tank } from '../../entities/tank.entity';
import { User, UserRole } from '../../entities/user.entity';
import { RechargesService } from '../recharges/recharges.service';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(
    @InjectRepository(Alert)
    private alertRepository: Repository<Alert>,
    @InjectRepository(Tank)
    private tankRepository: Repository<Tank>,
    private rechargesService: RechargesService,
    private mailerService: MailerService,
    private configService: ConfigService,
  ) {}

  @OnEvent('alert.lowLevel')
  async handleLowLevelAlert(data: any) {
    const { tank, levelPercentage, threshold } = data;

    // Verificar si ya existe una alerta activa para este tanque
    const existingAlert = await this.alertRepository.findOne({
      where: {
        tank: { id: tank.id },
        type: AlertType.LOW_LEVEL,
        status: AlertStatus.ACTIVE,
      },
    });

    if (existingAlert) {
      return; // Ya hay una alerta activa
    }

    // Crear nueva alerta
    const alert = this.alertRepository.create({
      tank,
      type: AlertType.LOW_LEVEL,
      severity: AlertSeverity.WARNING,
      status: AlertStatus.ACTIVE,
      message: `Nivel bajo detectado: ${levelPercentage.toFixed(2)}% (umbral: ${threshold}%)`,
      gasLevelAtAlert: levelPercentage,
    });

    const savedAlert = await this.alertRepository.save(alert);

    // Enviar notificación por email si está habilitado
    if (tank.client.emailNotifications) {
      await this.sendAlertEmail(tank, savedAlert);
    }

    this.logger.warn(`Alerta de nivel bajo creada para tanque ${tank.code}`);
  }

  @OnEvent('alert.criticalLevel')
  async handleCriticalLevelAlert(data: any) {
    const { tank, levelPercentage, threshold } = data;

    // Verificar si ya existe una alerta activa
    const existingAlert = await this.alertRepository.findOne({
      where: {
        tank: { id: tank.id },
        type: AlertType.CRITICAL_LEVEL,
        status: AlertStatus.ACTIVE,
      },
    });

    if (existingAlert) {
      return;
    }

    // Crear alerta crítica
    const alert = this.alertRepository.create({
      tank,
      type: AlertType.CRITICAL_LEVEL,
      severity: AlertSeverity.CRITICAL,
      status: AlertStatus.ACTIVE,
      message: `¡NIVEL CRÍTICO! ${levelPercentage.toFixed(2)}% (umbral: ${threshold}%)`,
      gasLevelAtAlert: levelPercentage,
    });

    const savedAlert = await this.alertRepository.save(alert);

    // Enviar email urgente
    if (tank.client.emailNotifications) {
      await this.sendAlertEmail(tank, savedAlert, true);
    }

    // Crear recarga automática
    await this.rechargesService.createAutomaticRecharge(tank);

    this.logger.error(`¡Alerta CRÍTICA creada para tanque ${tank.code}!`);
  }

  private async sendAlertEmail(tank: Tank, alert: Alert, isUrgent = false) {
    try {
      const emailTo = tank.client.email;

      await this.mailerService.sendMail({
        to: emailTo,
        subject: isUrgent
          ? `🚨 URGENTE: Nivel crítico en tanque ${tank.code}`
          : `⚠️ Alerta: Nivel bajo en tanque ${tank.code}`,
        html: `
          <h2>${isUrgent ? '🚨 ALERTA CRÍTICA' : '⚠️ ALERTA DE NIVEL BAJO'}</h2>
          <p>Estimado/a ${tank.client.firstName} ${tank.client.lastName},</p>
          <p>Le informamos que el tanque <strong>${tank.code}</strong> ha alcanzado un nivel ${isUrgent ? 'crítico' : 'bajo'}.</p>

          <h3>Detalles:</h3>
          <ul>
            <li><strong>Tanque:</strong> ${tank.code}</li>
            <li><strong>Ubicación:</strong> ${tank.location || 'No especificada'}</li>
            <li><strong>Nivel actual:</strong> ${alert.gasLevelAtAlert?.toFixed(2)}%</li>
            <li><strong>Capacidad:</strong> ${tank.capacityLiters} litros</li>
            <li><strong>Fecha/Hora:</strong> ${new Date().toLocaleString()}</li>
          </ul>

          ${isUrgent ?
            '<p style="color: red;"><strong>Se ha programado automáticamente una recarga para mañana.</strong></p>' :
            '<p>Le recomendamos programar una recarga pronto.</p>'
          }

          <p>Para más información, acceda a su panel de control.</p>

          <hr>
          <small>${this.configService.get('COMPANY_NAME')}</small>
        `,
      });

      alert.emailSent = true;
      alert.emailSentAt = new Date();
      await this.alertRepository.save(alert);

      this.logger.log(`Email de alerta enviado a ${emailTo}`);
    } catch (error) {
      this.logger.error(`Error enviando email de alerta: ${error.message}`);
    }
  }

  async getAlerts(userId?: string, userRole?: UserRole) {
    const query = this.alertRepository
      .createQueryBuilder('alert')
      .leftJoinAndSelect('alert.tank', 'tank')
      .leftJoinAndSelect('tank.client', 'client');

    if (userRole === UserRole.CLIENT) {
      query.where('client.id = :userId', { userId });
    }

    return query.orderBy('alert.createdAt', 'DESC').getMany();
  }

  async acknowledgeAlert(alertId: string, userId: string) {
    const alert = await this.alertRepository.findOne({
      where: { id: alertId },
    });

    if (!alert) {
      throw new Error('Alerta no encontrada');
    }

    alert.status = AlertStatus.ACKNOWLEDGED;
    alert.acknowledgedBy = userId;
    alert.acknowledgedAt = new Date();

    return this.alertRepository.save(alert);
  }

  async resolveAlert(alertId: string, userId: string, notes?: string) {
    const alert = await this.alertRepository.findOne({
      where: { id: alertId },
    });

    if (!alert) {
      throw new Error('Alerta no encontrada');
    }

    alert.status = AlertStatus.RESOLVED;
    alert.resolvedBy = userId;
    alert.resolvedAt = new Date();
    if (notes) {
      alert.notes = notes;
    }

    return this.alertRepository.save(alert);
  }

  async getActiveAlerts(tankId?: string) {
    const where: any = { status: AlertStatus.ACTIVE };
    if (tankId) {
      where.tank = { id: tankId };
    }

    return this.alertRepository.find({
      where,
      relations: ['tank'],
      order: { createdAt: 'DESC' },
    });
  }
}