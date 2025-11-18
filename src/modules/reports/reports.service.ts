import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { Tank } from '../../entities/tank.entity';
import { Supply } from '../../entities/supply.entity';
import { Alert } from '../../entities/alert.entity';
import { Recharge, RechargeStatus } from '../../entities/recharge.entity';
import { MonitoringHistory } from '../../entities/monitoring-history.entity';
import { User, UserRole } from '../../entities/user.entity';
import { PdfService } from '../pdf/pdf.service';
import { EmailService } from '../email/email.service';
import { ExcelService } from '../excel/excel.service';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Tank)
    private tankRepository: Repository<Tank>,
    @InjectRepository(Supply)
    private supplyRepository: Repository<Supply>,
    @InjectRepository(Alert)
    private alertRepository: Repository<Alert>,
    @InjectRepository(Recharge)
    private rechargeRepository: Repository<Recharge>,
    @InjectRepository(MonitoringHistory)
    private monitoringRepository: Repository<MonitoringHistory>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private pdfService: PdfService,
    private emailService: EmailService,
    private excelService: ExcelService,
  ) {}

  async getGeneralReport(startDate: Date, endDate: Date, userId?: string, userRole?: UserRole) {
    // Construir filtros según el rol
    const tankFilter: any = {};
    let userTankIds = [];

    if (userRole === UserRole.CLIENT && userId) {
      const user = await this.userRepository.findOne({
        where: { id: userId },
        relations: ['tanks'],
      });
      if (user?.tanks) {
        userTankIds = user.tanks.map(t => t.id);
        tankFilter.id = In(userTankIds);
      }
    }

    // Obtener todos los tanques
    const tanks = await this.tankRepository.find({
      where: tankFilter,
      relations: ['client', 'sensor'],
    });

    // Tanques críticos
    const criticalTanks = tanks
      .filter(t => t.currentLevelPercentage < 10)
      .sort((a, b) => a.currentLevelPercentage - b.currentLevelPercentage);

    // Obtener todos los clientes (usuarios con rol CLIENT) con sus tanques
    const clients = await this.userRepository.find({
      where: { role: UserRole.CLIENT },
      relations: ['tanks'],
    });

    // Estadísticas de suministros
    const supplies = await this.supplyRepository.find({
      where: {
        supplyDate: Between(startDate, endDate),
        ...(userTankIds.length > 0 && { tank: { id: In(userTankIds) } }),
      },
    });

    // Estadísticas de alertas
    const alerts = await this.alertRepository.find({
      where: {
        createdAt: Between(startDate, endDate),
        ...(userTankIds.length > 0 && { tank: { id: In(userTankIds) } }),
      },
    });

    // Agrupar alertas por tipo
    const alertsSummary = [
      'low_level',
      'critical_level',
      'sensor_failure',
      'consumption_anomaly',
      'maintenance_required'
    ].map(type => ({
      type: this.getAlertTypeName(type),
      active: alerts.filter(a => a.type === type && a.status === 'active').length,
      acknowledged: alerts.filter(a => a.type === type && a.status === 'acknowledged').length,
      resolved: alerts.filter(a => a.type === type && a.status === 'resolved').length,
      total: alerts.filter(a => a.type === type).length,
    }));

    // Estadísticas de recargas
    const recharges = await this.rechargeRepository.find({
      where: {
        scheduledDate: Between(startDate, endDate),
        ...(userTankIds.length > 0 && { tank: { id: In(userTankIds) } }),
      },
      relations: ['tank', 'tank.client'],
    });

    // Próximas recargas
    const upcomingRecharges = await this.rechargeRepository.find({
      where: {
        status: RechargeStatus.SCHEDULED,
        scheduledDate: Between(new Date(), new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
        ...(userTankIds.length > 0 && { tank: { id: In(userTankIds) } }),
      },
      relations: ['tank', 'tank.client'],
      take: 10,
    });

    // Calcular estadísticas de consumo
    const consumptionData = await this.calculateConsumptionStats(
      startDate,
      endDate,
      userTankIds
    );

    // Preparar resumen por cliente
    const clientsSummary = clients.map(client => ({
      id: client.id,
      companyName: client.company,
      firstName: client.firstName,
      lastName: client.lastName,
      email: client.email,
      phone: client.phone,
      isActive: client.isActive,
      tanksCount: client.tanks.length,
      tanks: client.tanks.map(t => ({
        id: t.id,
        code: t.code,
        location: t.location,
        currentLevelPercentage: t.currentLevelPercentage,
        status: t.status,
      })),
    }));

    const statistics = {
      totalTanks: tanks.length,
      activeTanks: tanks.filter(t => t.status === 'active').length,
      totalClients: clients.length,
      activeAlerts: alerts.filter(a => a.status === 'active').length,
      criticalTanks: criticalTanks.length,
      lowTanks: tanks.filter(t => t.currentLevelPercentage >= 10 && t.currentLevelPercentage < 20).length,
      normalTanks: tanks.filter(t => t.currentLevelPercentage >= 20).length,
      criticalPercentage: tanks.length > 0 ? (criticalTanks.length / tanks.length) * 100 : 0,
      lowPercentage: tanks.length > 0 ?
        (tanks.filter(t => t.currentLevelPercentage >= 10 && t.currentLevelPercentage < 20).length / tanks.length) * 100 : 0,
      normalPercentage: tanks.length > 0 ?
        (tanks.filter(t => t.currentLevelPercentage >= 20).length / tanks.length) * 100 : 0,
    };

    const rechargeStats = {
      total: recharges.length,
      completed: recharges.filter(r => r.status === 'completed').length,
      scheduled: recharges.filter(r => r.status === 'scheduled').length,
      totalLiters: recharges
        .filter(r => r.status === 'completed')
        .reduce((sum, r) => sum + (r.actualQuantityLiters || 0), 0),
    };

    return {
      period: {
        start: startDate.toLocaleDateString('es-ES'),
        end: endDate.toLocaleDateString('es-ES'),
      },
      generatedDate: new Date(),
      statistics,
      criticalTanks: criticalTanks.map(t => ({
        ...t,
        client: t.client,
      })),
      alertsSummary,
      rechargeStats,
      upcomingRecharges: upcomingRecharges.map(r => ({
        scheduledDate: r.scheduledDate,
        tank: {
          code: r.tank.code,
          client: r.tank.client,
        },
        estimatedQuantityLiters: r.estimatedQuantityLiters,
        requestedBy: r.requestedBy,
      })),
      clientsSummary,
      consumptionStats: consumptionData.consumptionStats,
      topConsumers: consumptionData.topConsumers,
    };
  }

  async getTankReport(tankId: string, startDate: Date, endDate: Date) {
    const tank = await this.tankRepository.findOne({
      where: { id: tankId },
      relations: ['client', 'sensor'],
    });

    if (!tank) {
      throw new Error('Tanque no encontrado');
    }

    // Historial de monitoreo
    const monitoringHistory = await this.monitoringRepository.find({
      where: {
        tank: { id: tankId },
        recordedAt: Between(startDate, endDate),
      },
      order: { recordedAt: 'DESC' },
      take: 100,
    });

    // Suministros del tanque
    const supplies = await this.supplyRepository.find({
      where: {
        tank: { id: tankId },
        supplyDate: Between(startDate, endDate),
      },
      relations: ['employee'],
      order: { supplyDate: 'DESC' },
    });

    // Alertas del tanque
    const alerts = await this.alertRepository.find({
      where: {
        tank: { id: tankId },
        createdAt: Between(startDate, endDate),
      },
      order: { createdAt: 'DESC' },
      take: 50,
    });

    // Recargas del tanque
    const recharges = await this.rechargeRepository.find({
      where: {
        tank: { id: tankId },
        scheduledDate: Between(startDate, endDate),
      },
      order: { scheduledDate: 'DESC' },
    });

    // Calcular estadísticas
    const totalConsumption = this.calculateTotalConsumption(monitoringHistory);
    const days = Math.max(1, (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const averageDailyConsumption = totalConsumption / days;

    const statistics = {
      totalConsumption: totalConsumption.toFixed(2),
      totalRecharges: recharges.filter(r => r.status === 'completed').length,
      averageDailyConsumption: averageDailyConsumption.toFixed(2),
    };

    return {
      generatedDate: new Date(),
      period: {
        start: startDate.toLocaleDateString('es-ES'),
        end: endDate.toLocaleDateString('es-ES'),
      },
      tank,
      client: tank.client,
      statistics,
      recharges: recharges.slice(0, 20),
      alerts: alerts.slice(0, 20),
      supplies: supplies.slice(0, 20),
      consumptionHistory: monitoringHistory.slice(0, 30),
    };
  }

  async getClientReport(clientId: string, startDate: Date, endDate: Date) {
    const client = await this.userRepository.findOne({
      where: { id: clientId, role: UserRole.CLIENT },
      relations: ['tanks'],
    });

    if (!client) {
      throw new Error('Cliente no encontrado');
    }

    const tankReports = await Promise.all(
      client.tanks.map(tank => this.getTankReport(tank.id, startDate, endDate)),
    );

    return {
      client: {
        id: client.id,
        companyName: client.company,
        firstName: client.firstName,
        lastName: client.lastName,
        email: client.email,
        phone: client.phone,
        address: client.address,
        tanksCount: client.tanks.length,
      },
      period: {
        start: startDate.toLocaleDateString('es-ES'),
        end: endDate.toLocaleDateString('es-ES'),
      },
      generatedDate: new Date(),
      summary: {
        totalConsumption: tankReports.reduce((sum, r) =>
          sum + parseFloat(r.statistics.totalConsumption), 0
        ).toFixed(2),
        totalSupplies: tankReports.reduce((sum, r) => sum + r.supplies.length, 0),
        totalAlerts: tankReports.reduce((sum, r) => sum + r.alerts.length, 0),
        totalRecharges: tankReports.reduce((sum, r) =>
          sum + r.statistics.totalRecharges, 0
        ),
      },
      tanks: tankReports,
    };
  }

  async generatePdfReport(
    reportType: 'general' | 'tank' | 'client',
    params: any,
  ): Promise<Buffer> {
    let reportData: any;
    let templateName: string;

    switch (reportType) {
      case 'general':
        reportData = await this.getGeneralReport(
          new Date(params.startDate),
          new Date(params.endDate),
          params.userId,
          params.userRole,
        );
        templateName = 'general-report';
        break;
      case 'tank':
        reportData = await this.getTankReport(
          params.tankId,
          new Date(params.startDate),
          new Date(params.endDate),
        );
        templateName = 'tank-report';
        break;
      case 'client':
        reportData = await this.getClientReport(
          params.clientId,
          new Date(params.startDate),
          new Date(params.endDate),
        );
        templateName = 'client-report';
        break;
      default:
        throw new Error('Tipo de reporte no válido');
    }

    return await this.pdfService.generatePdf(templateName, reportData);
  }

  async sendReportByEmail(
    reportType: 'general' | 'tank' | 'client',
    params: any,
    emailTo: string | string[],
  ): Promise<boolean> {
    const pdfBuffer = await this.generatePdfReport(reportType, params);

    let reportData: any;
    switch (reportType) {
      case 'general':
        reportData = await this.getGeneralReport(
          new Date(params.startDate),
          new Date(params.endDate),
          params.userId,
          params.userRole,
        );
        break;
      case 'tank':
        reportData = await this.getTankReport(
          params.tankId,
          new Date(params.startDate),
          new Date(params.endDate),
        );
        break;
      case 'client':
        reportData = await this.getClientReport(
          params.clientId,
          new Date(params.startDate),
          new Date(params.endDate),
        );
        break;
    }

    return await this.emailService.sendReportEmail(
      emailTo,
      reportType + '-report',
      pdfBuffer,
      reportData,
    );
  }

  async exportReport(reportType: string, params: any, format: 'json' | 'pdf' | 'excel' = 'json') {
    if (format === 'pdf') {
      const pdfBuffer = await this.generatePdfReport(
        reportType as any,
        params,
      );
      return {
        type: 'application/pdf',
        data: pdfBuffer,
        filename: `${reportType}-report-${new Date().toISOString().split('T')[0]}.pdf`,
      };
    }

    if (format === 'excel') {
      const excelBuffer = await this.generateExcelReport(
        reportType as any,
        params,
      );
      return {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        data: excelBuffer,
        filename: `${reportType}-report-${new Date().toISOString().split('T')[0]}.xlsx`,
      };
    }

    // JSON format
    let reportData: any;
    switch (reportType) {
      case 'general':
        reportData = await this.getGeneralReport(
          new Date(params.startDate),
          new Date(params.endDate),
          params.userId,
          params.userRole,
        );
        break;
      case 'tank':
        reportData = await this.getTankReport(
          params.tankId,
          new Date(params.startDate),
          new Date(params.endDate),
        );
        break;
      case 'client':
        reportData = await this.getClientReport(
          params.clientId,
          new Date(params.startDate),
          new Date(params.endDate),
        );
        break;
      default:
        throw new Error('Tipo de reporte no válido');
    }

    return {
      type: 'application/json',
      data: reportData,
      generatedAt: new Date(),
    };
  }

  async generateExcelReport(
    reportType: 'general' | 'tank' | 'client',
    params: any,
  ): Promise<Buffer> {
    let reportData: any;

    switch (reportType) {
      case 'general':
        reportData = await this.getGeneralReport(
          new Date(params.startDate),
          new Date(params.endDate),
          params.userId,
          params.userRole,
        );
        return await this.excelService.generateGeneralReportExcel(reportData);
      case 'tank':
        reportData = await this.getTankReport(
          params.tankId,
          new Date(params.startDate),
          new Date(params.endDate),
        );
        return await this.excelService.generateTankReportExcel(reportData);
      case 'client':
        reportData = await this.getClientReport(
          params.clientId,
          new Date(params.startDate),
          new Date(params.endDate),
        );
        return await this.excelService.generateClientReportExcel(reportData);
      default:
        throw new Error('Tipo de reporte no válido');
    }
  }

  private async calculateConsumptionStats(
    startDate: Date,
    endDate: Date,
    tankIds?: string[],
  ) {
    const whereCondition: any = {
      recordedAt: Between(startDate, endDate),
    };

    if (tankIds && tankIds.length > 0) {
      whereCondition.tank = { id: In(tankIds) };
    }

    const monitoringData = await this.monitoringRepository.find({
      where: whereCondition,
      relations: ['tank', 'tank.client'],
      order: { recordedAt: 'ASC' },
    });

    // Agrupar por tanque y calcular consumo
    const tankConsumption = new Map();

    monitoringData.forEach(record => {
      const tankId = record.tank.id;
      if (!tankConsumption.has(tankId)) {
        tankConsumption.set(tankId, {
          tank: record.tank,
          client: record.tank.client,
          readings: [],
          totalConsumption: 0,
        });
      }
      tankConsumption.get(tankId).readings.push(record);
    });

    // Calcular consumo para cada tanque
    let totalConsumption = 0;
    tankConsumption.forEach(data => {
      const consumption = this.calculateTotalConsumption(data.readings);
      data.totalConsumption = consumption;
      totalConsumption += consumption;
    });

    const days = Math.max(1, (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const dailyAverage = totalConsumption / days;

    // Obtener top consumidores
    const topConsumers = Array.from(tankConsumption.values())
      .sort((a, b) => b.totalConsumption - a.totalConsumption)
      .slice(0, 5)
      .map(data => ({
        tank: { code: data.tank.code },
        client: data.client,
        totalConsumption: data.totalConsumption.toFixed(2),
        dailyAverage: (data.totalConsumption / days).toFixed(2),
        percentageOfTotal: totalConsumption > 0 ?
          ((data.totalConsumption / totalConsumption) * 100).toFixed(2) : 0,
      }));

    return {
      consumptionStats: {
        totalConsumption: totalConsumption.toFixed(2),
        dailyAverage: dailyAverage.toFixed(2),
      },
      topConsumers,
    };
  }

  private calculateTotalConsumption(monitoringHistory: MonitoringHistory[]): number {
    if (monitoringHistory.length < 2) return 0;

    let totalConsumption = 0;
    for (let i = 1; i < monitoringHistory.length; i++) {
      const prevLevel = monitoringHistory[i - 1].gasLevelLiters;
      const currentLevel = monitoringHistory[i].gasLevelLiters;

      // Solo contar como consumo si el nivel bajó (no recargas)
      if (prevLevel > currentLevel) {
        totalConsumption += (prevLevel - currentLevel);
      }
    }

    return totalConsumption;
  }

  private getAlertTypeName(type: string): string {
    const types = {
      low_level: 'Nivel Bajo',
      critical_level: 'Nivel Crítico',
      sensor_failure: 'Falla de Sensor',
      consumption_anomaly: 'Anomalía de Consumo',
      maintenance_required: 'Mantenimiento Requerido',
    };
    return types[type] || type;
  }
}