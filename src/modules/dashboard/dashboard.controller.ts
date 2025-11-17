import {
  Controller,
  Get,
  Query,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User, UserRole } from '../../entities/user.entity';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  // Dashboard principal - Detecta el rol y devuelve el dashboard correspondiente
  @Get()
  async getDashboard(@CurrentUser() user: User) {
    if (user.role === UserRole.ADMIN) {
      return this.dashboardService.getAdminDashboard();
    } else if (user.role === UserRole.CLIENT) {
      return this.dashboardService.getClientDashboard(user.id);
    } else {
      throw new ForbiddenException('Rol no autorizado para acceder al dashboard');
    }
  }

  // Dashboard específico para administrador
  @Get('admin')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async getAdminDashboard() {
    return this.dashboardService.getAdminDashboard();
  }

  // Dashboard específico para cliente
  @Get('client')
  @UseGuards(RolesGuard)
  @Roles(UserRole.CLIENT)
  async getClientDashboard(@CurrentUser() user: User) {
    return this.dashboardService.getClientDashboard(user.id);
  }

  // Dashboard de cliente específico (solo admin puede ver dashboard de otros clientes)
  @Get('client/:clientId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async getSpecificClientDashboard(@Query('clientId') clientId: string) {
    return this.dashboardService.getClientDashboard(clientId);
  }

  // Estadísticas avanzadas (solo admin)
  @Get('admin/stats')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async getAdvancedStats(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    return this.dashboardService.getAdvancedStats(start, end);
  }

  // Resumen rápido para admin
  @Get('admin/summary')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async getAdminSummary() {
    const dashboard = await this.dashboardService.getAdminDashboard();
    return {
      tanquesCriticos: dashboard.resumen.tanques.criticos,
      alertasActivas: dashboard.resumen.alertas.activas,
      recargasProgramadas: dashboard.resumen.recargas.programadas,
      clientesConProblemas: dashboard.resumen.clientes.conTanquesCriticos,
      consumoSemanal: dashboard.resumen.consumo.promedioSemanal,
    };
  }

  // Resumen rápido para cliente
  @Get('client/summary')
  @UseGuards(RolesGuard)
  @Roles(UserRole.CLIENT)
  async getClientSummary(@CurrentUser() user: User) {
    const dashboard = await this.dashboardService.getClientDashboard(user.id);

    const tanquesCriticos = dashboard.tanques.filter(t => t.alertaCritica).length;
    const tanquesAlertaBaja = dashboard.tanques.filter(t => t.alertaBaja).length;

    return {
      tanquesTotal: dashboard.tanques.length,
      tanquesCriticos,
      tanquesAlertaBaja,
      alertasActivas: dashboard.alertas.total,
      proximaRecarga: dashboard.recargas.programadas[0] || null,
      consumoDiario: dashboard.consumo.total.diario,
    };
  }

  // Widgets específicos para personalización del dashboard
  @Get('widget/tank-levels')
  async getTankLevelsWidget(@CurrentUser() user: User) {
    if (user.role === UserRole.ADMIN) {
      const dashboard = await this.dashboardService.getAdminDashboard();
      return dashboard.graficos.distribucionNiveles;
    } else {
      const dashboard = await this.dashboardService.getClientDashboard(user.id);
      return dashboard.tanques.map(t => ({
        codigo: t.codigo,
        nivel: t.nivelActual.porcentaje,
        estado: t.alertaCritica ? 'critico' : t.alertaBaja ? 'bajo' : 'normal',
      }));
    }
  }

  @Get('widget/consumption-trend')
  async getConsumptionTrendWidget(@CurrentUser() user: User) {
    if (user.role === UserRole.ADMIN) {
      const dashboard = await this.dashboardService.getAdminDashboard();
      return dashboard.graficos.tendenciaConsumo;
    } else {
      const dashboard = await this.dashboardService.getClientDashboard(user.id);
      return dashboard.graficos.historialNiveles;
    }
  }

  @Get('widget/alerts')
  async getAlertsWidget(@CurrentUser() user: User) {
    if (user.role === UserRole.ADMIN) {
      const dashboard = await this.dashboardService.getAdminDashboard();
      return {
        total: dashboard.resumen.alertas.activas,
        recientes: dashboard.alertasRecientes.slice(0, 5),
      };
    } else {
      const dashboard = await this.dashboardService.getClientDashboard(user.id);
      return {
        total: dashboard.alertas.total,
        activas: dashboard.alertas.activas.slice(0, 5),
      };
    }
  }

  @Get('widget/recharges')
  async getRechargesWidget(@CurrentUser() user: User) {
    if (user.role === UserRole.ADMIN) {
      const dashboard = await this.dashboardService.getAdminDashboard();
      return {
        programadas: dashboard.resumen.recargas.programadas,
        proximas: dashboard.proximasRecargas.slice(0, 5),
      };
    } else {
      const dashboard = await this.dashboardService.getClientDashboard(user.id);
      return {
        programadas: dashboard.recargas.programadas,
        historial: dashboard.recargas.historial.slice(0, 5),
      };
    }
  }

  // Notificaciones del dashboard
  @Get('notifications')
  async getDashboardNotifications(@CurrentUser() user: User) {
    const notificaciones = [];

    if (user.role === UserRole.ADMIN) {
      const dashboard = await this.dashboardService.getAdminDashboard();

      // Notificación de tanques críticos
      if (dashboard.resumen.tanques.criticos > 0) {
        notificaciones.push({
          tipo: 'critico',
          mensaje: `Hay ${dashboard.resumen.tanques.criticos} tanques en nivel crítico`,
          fecha: new Date(),
          accion: '/tanks?filter=critical',
        });
      }

      // Notificación de alertas sin resolver
      if (dashboard.resumen.alertas.activas > 5) {
        notificaciones.push({
          tipo: 'alerta',
          mensaje: `${dashboard.resumen.alertas.activas} alertas activas requieren atención`,
          fecha: new Date(),
          accion: '/alerts',
        });
      }

      // Notificación de recargas pendientes
      if (dashboard.resumen.recargas.programadas > 0) {
        notificaciones.push({
          tipo: 'info',
          mensaje: `${dashboard.resumen.recargas.programadas} recargas programadas pendientes`,
          fecha: new Date(),
          accion: '/recharges',
        });
      }
    } else {
      const dashboard = await this.dashboardService.getClientDashboard(user.id);

      // Notificaciones para clientes
      dashboard.tanques.forEach(tanque => {
        if (tanque.alertaCritica) {
          notificaciones.push({
            tipo: 'critico',
            mensaje: `Tanque ${tanque.codigo} en nivel crítico (${tanque.nivelActual.porcentaje}%)`,
            fecha: new Date(),
            accion: `/tanks/${tanque.id}`,
          });
        } else if (tanque.alertaBaja) {
          notificaciones.push({
            tipo: 'advertencia',
            mensaje: `Tanque ${tanque.codigo} con nivel bajo (${tanque.nivelActual.porcentaje}%)`,
            fecha: new Date(),
            accion: `/tanks/${tanque.id}`,
          });
        }
      });

      // Notificación de próxima recarga
      if (dashboard.recargas.programadas.length > 0) {
        const proximaRecarga = dashboard.recargas.programadas[0];
        notificaciones.push({
          tipo: 'info',
          mensaje: `Recarga programada para el tanque ${proximaRecarga.tanque} el ${new Date(proximaRecarga.fecha).toLocaleDateString()}`,
          fecha: new Date(),
          accion: `/recharges/${proximaRecarga.id}`,
        });
      }
    }

    return notificaciones;
  }
}