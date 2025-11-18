import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { Tank, TankStatus } from '../../entities/tank.entity';
import { Alert, AlertStatus } from '../../entities/alert.entity';
import { Recharge, RechargeStatus } from '../../entities/recharge.entity';
import { Supply } from '../../entities/supply.entity';
import { MonitoringHistory } from '../../entities/monitoring-history.entity';
import { User, UserRole } from '../../entities/user.entity';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Tank)
    private tankRepository: Repository<Tank>,
    @InjectRepository(Alert)
    private alertRepository: Repository<Alert>,
    @InjectRepository(Recharge)
    private rechargeRepository: Repository<Recharge>,
    @InjectRepository(Supply)
    private supplyRepository: Repository<Supply>,
    @InjectRepository(MonitoringHistory)
    private monitoringRepository: Repository<MonitoringHistory>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  // DASHBOARD ADMIN
  async getAdminDashboard() {
    const ahora = new Date();
    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    const finMes = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0);
    const hace7Dias = new Date(ahora.getTime() - 7 * 24 * 60 * 60 * 1000);
    const hace30Dias = new Date(ahora.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Estadísticas generales
    const [
      totalTanques,
      tanquesActivos,
      totalClientes,
      clientesActivos,
      totalUsuarios,
    ] = await Promise.all([
      this.tankRepository.count(),
      this.tankRepository.count({ where: { status: TankStatus.ACTIVE } }),
      this.userRepository.count({ where: { role: UserRole.CLIENT } }),
      this.userRepository.count({ where: { role: UserRole.CLIENT, isActive: true } }),
      this.userRepository.count(),
    ]);

    // Tanques por nivel
    const tanques = await this.tankRepository.find({
      where: { status: TankStatus.ACTIVE },
      relations: ['client'],
    });

    const tanquesCriticos = tanques.filter(t => t.currentLevelPercentage < 10);
    const tanquesNivelBajo = tanques.filter(t => t.currentLevelPercentage >= 10 && t.currentLevelPercentage < 20);
    const tanquesNormales = tanques.filter(t => t.currentLevelPercentage >= 20);

    // Alertas activas
    const alertasActivas = await this.alertRepository.count({
      where: { status: AlertStatus.ACTIVE },
    });

    const alertasUltimas24h = await this.alertRepository.count({
      where: {
        createdAt: MoreThanOrEqual(new Date(ahora.getTime() - 24 * 60 * 60 * 1000)),
      },
    });

    // Recargas
    const recargasProgramadas = await this.rechargeRepository.count({
      where: { status: RechargeStatus.SCHEDULED },
    });

    const recargasCompletadasMes = await this.rechargeRepository.count({
      where: {
        status: RechargeStatus.COMPLETED,
        completedDate: Between(inicioMes, finMes),
      },
    });

    const proximasRecargas = await this.rechargeRepository.find({
      where: {
        status: RechargeStatus.SCHEDULED,
        scheduledDate: MoreThanOrEqual(ahora),
      },
      relations: ['tank', 'tank.client'],
      order: { scheduledDate: 'ASC' },
      take: 10,
    });

    // Suministros del mes
    const suministrosMes = await this.supplyRepository.find({
      where: {
        supplyDate: Between(inicioMes, finMes),
      },
    });

    const totalLitrosSuministrados = suministrosMes.reduce(
      (sum, s) => sum + s.quantityLiters,
      0,
    );

    const totalCostoSuministros = suministrosMes.reduce(
      (sum, s) => sum + (s.cost || 0),
      0,
    );

    // Consumo promedio (últimos 7 días)
    const consumoSemana = await this.calcularConsumoPromedio(hace7Dias, ahora);

    // Alertas recientes
    const alertasRecientes = await this.alertRepository.find({
      where: {
        createdAt: MoreThanOrEqual(hace7Dias),
      },
      relations: ['tank', 'tank.client'],
      order: { createdAt: 'DESC' },
      take: 15,
    });

    // Top 5 tanques con mayor consumo
    const topConsumidores = await this.obtenerTopConsumidores(5, hace30Dias, ahora);

    // Clientes con tanques críticos
    const clientesCriticos = [...new Set(tanquesCriticos.map(t => t.client))];

    return {
      resumen: {
        tanques: {
          total: totalTanques,
          activos: tanquesActivos,
          criticos: tanquesCriticos.length,
          nivelBajo: tanquesNivelBajo.length,
          normales: tanquesNormales.length,
        },
        clientes: {
          total: totalClientes,
          activos: clientesActivos,
          conTanquesCriticos: clientesCriticos.length,
        },
        usuarios: {
          total: totalUsuarios,
        },
        alertas: {
          activas: alertasActivas,
          ultimas24h: alertasUltimas24h,
        },
        recargas: {
          programadas: recargasProgramadas,
          completadasMes: recargasCompletadasMes,
        },
        suministros: {
          totalMes: suministrosMes.length,
          litrosMes: totalLitrosSuministrados.toFixed(2),
          costoMes: totalCostoSuministros.toFixed(2),
        },
        consumo: {
          promedioSemanal: consumoSemana.toFixed(2),
        },
      },
      tanquesCriticos: tanquesCriticos.map(t => ({
        id: t.id,
        codigo: t.code,
        nivelActual: t.currentLevelPercentage.toFixed(2),
        ubicacion: t.location,
        cliente: {
          id: t.client.id,
          nombre: t.client.company || `${t.client.firstName} ${t.client.lastName}`,
          telefono: t.client.phone,
          email: t.client.email,
        },
      })),
      proximasRecargas: proximasRecargas.map(r => ({
        id: r.id,
        fechaProgramada: r.scheduledDate,
        tanque: {
          codigo: r.tank.code,
          ubicacion: r.tank.location,
        },
        cliente: r.tank.client.company || `${r.tank.client.firstName} ${r.tank.client.lastName}`,
        cantidadEstimada: r.estimatedQuantityLiters,
      })),
      alertasRecientes: alertasRecientes.map(a => ({
        id: a.id,
        tipo: a.type,
        severidad: a.severity,
        estado: a.status,
        mensaje: a.message,
        tanque: a.tank?.code,
        cliente: a.tank?.client ?
          (a.tank.client.company || `${a.tank.client.firstName} ${a.tank.client.lastName}`) : null,
        fecha: a.createdAt,
      })),
      topConsumidores,
      graficos: {
        distribucionNiveles: [
          { nombre: 'Crítico (<10%)', valor: tanquesCriticos.length, porcentaje: (tanquesCriticos.length / tanquesActivos * 100).toFixed(1) },
          { nombre: 'Bajo (10-20%)', valor: tanquesNivelBajo.length, porcentaje: (tanquesNivelBajo.length / tanquesActivos * 100).toFixed(1) },
          { nombre: 'Normal (>20%)', valor: tanquesNormales.length, porcentaje: (tanquesNormales.length / tanquesActivos * 100).toFixed(1) },
        ],
        tendenciaConsumo: await this.obtenerTendenciaConsumo(hace30Dias, ahora),
      },
    };
  }

  // DASHBOARD CLIENTE
  async getClientDashboard(userId: string) {
    const usuario = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['tanks'],
    });

    if (!usuario) {
      throw new Error('Cliente no encontrado');
    }

    const ahora = new Date();
    const hace7Dias = new Date(ahora.getTime() - 7 * 24 * 60 * 60 * 1000);
    const hace30Dias = new Date(ahora.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Tanques del cliente
    const tanques = await this.tankRepository.find({
      where: { client: { id: usuario.id } },
      relations: ['sensor'],
    });

    // Alertas del cliente
    const alertasActivas = await this.alertRepository.find({
      where: {
        tank: { client: { id: usuario.id } },
        status: AlertStatus.ACTIVE,
      },
      relations: ['tank'],
    });

    // Recargas del cliente
    const recargasProgramadas = await this.rechargeRepository.find({
      where: {
        tank: { client: { id: usuario.id } },
        status: RechargeStatus.SCHEDULED,
      },
      relations: ['tank'],
      order: { scheduledDate: 'ASC' },
    });

    const recargasHistorial = await this.rechargeRepository.find({
      where: {
        tank: { client: { id: usuario.id } },
        completedDate: MoreThanOrEqual(hace30Dias),
      },
      relations: ['tank'],
      order: { completedDate: 'DESC' },
      take: 10,
    });

    // Consumo por tanque
    const consumoPorTanque = await Promise.all(
      tanques.map(async (tanque) => {
        const consumo = await this.calcularConsumoTanque(tanque.id, hace7Dias, ahora);
        return {
          tanqueId: tanque.id,
          codigo: tanque.code,
          consumoSemanal: consumo.toFixed(2),
          consumoDiario: (consumo / 7).toFixed(2),
        };
      }),
    );

    // Historial de niveles (últimos 7 días)
    const historialNiveles = await Promise.all(
      tanques.map(async (tanque) => {
        const historial = await this.monitoringRepository.find({
          where: {
            tank: { id: tanque.id },
            recordedAt: MoreThanOrEqual(hace7Dias),
          },
          order: { recordedAt: 'DESC' },
          take: 50,
        });

        return {
          tanqueId: tanque.id,
          codigo: tanque.code,
          datos: historial.map(h => ({
            fecha: h.recordedAt,
            nivel: h.gasLevelPercentage,
            litros: h.gasLevelLiters,
          })),
        };
      }),
    );

    return {
      cliente: {
        id: usuario.id,
        nombre: usuario.company || `${usuario.firstName} ${usuario.lastName}`,
        email: usuario.email,
        telefono: usuario.phone,
        direccion: usuario.address,
      },
      preferencias: null, // TODO: Implementar preferencias en usuario si es necesario
      tanques: tanques.map(t => ({
        id: t.id,
        codigo: t.code,
        ubicacion: t.location,
        capacidad: t.capacityLiters,
        nivelActual: {
          porcentaje: t.currentLevelPercentage.toFixed(2),
          litros: t.currentLevelLiters.toFixed(2),
        },
        estado: t.status,
        ultimaRecarga: t.lastRechargeDate,
        sensor: t.sensor ? {
          estado: t.sensor.status,
          ultimaLectura: t.sensor.lastReadingDate,
        } : null,
        alertaCritica: t.currentLevelPercentage < 10,
        alertaBaja: t.currentLevelPercentage >= 10 && t.currentLevelPercentage < 20,
      })),
      alertas: {
        activas: alertasActivas.map(a => ({
          id: a.id,
          tipo: a.type,
          severidad: a.severity,
          mensaje: a.message,
          tanque: a.tank.code,
          fecha: a.createdAt,
        })),
        total: alertasActivas.length,
      },
      recargas: {
        programadas: recargasProgramadas.map(r => ({
          id: r.id,
          fecha: r.scheduledDate,
          tanque: r.tank.code,
          cantidadEstimada: r.estimatedQuantityLiters,
          estado: r.status,
        })),
        historial: recargasHistorial.map(r => ({
          id: r.id,
          fecha: r.completedDate || r.scheduledDate,
          tanque: r.tank.code,
          cantidad: r.actualQuantityLiters || r.estimatedQuantityLiters,
          estado: r.status,
        })),
      },
      consumo: {
        porTanque: consumoPorTanque,
        total: {
          semanal: consumoPorTanque.reduce((sum, c) => sum + parseFloat(c.consumoSemanal), 0).toFixed(2),
          diario: consumoPorTanque.reduce((sum, c) => sum + parseFloat(c.consumoDiario), 0).toFixed(2),
        },
      },
      graficos: {
        historialNiveles,
      },
    };
  }

  // DASHBOARD ESTADÍSTICAS AVANZADAS (ADMIN)
  async getAdvancedStats(startDate: Date, endDate: Date) {
    // Análisis de patrones de consumo
    const patronesConsumo = await this.analizarPatronesConsumo(startDate, endDate);

    // Predicciones de recarga
    const predicciones = await this.predecirRecargas();

    // Análisis de costos
    const analisisCostos = await this.analizarCostos(startDate, endDate);

    // Eficiencia del sistema
    const eficiencia = await this.calcularEficiencia(startDate, endDate);

    return {
      patronesConsumo,
      predicciones,
      analisisCostos,
      eficiencia,
    };
  }

  // MÉTODOS AUXILIARES
  private async calcularConsumoPromedio(startDate: Date, endDate: Date): Promise<number> {
    const lecturas = await this.monitoringRepository.find({
      where: {
        recordedAt: Between(startDate, endDate),
      },
      order: { recordedAt: 'ASC' },
    });

    if (lecturas.length < 2) return 0;

    let consumoTotal = 0;
    for (let i = 1; i < lecturas.length; i++) {
      const diff = lecturas[i - 1].gasLevelLiters - lecturas[i].gasLevelLiters;
      if (diff > 0) consumoTotal += diff;
    }

    const dias = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    return consumoTotal / Math.max(1, dias);
  }

  private async calcularConsumoTanque(
    tankId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<number> {
    const lecturas = await this.monitoringRepository.find({
      where: {
        tank: { id: tankId },
        recordedAt: Between(startDate, endDate),
      },
      order: { recordedAt: 'ASC' },
    });

    if (lecturas.length < 2) return 0;

    let consumoTotal = 0;
    for (let i = 1; i < lecturas.length; i++) {
      const diff = lecturas[i - 1].gasLevelLiters - lecturas[i].gasLevelLiters;
      if (diff > 0) consumoTotal += diff;
    }

    return consumoTotal;
  }

  private async obtenerTopConsumidores(
    limite: number,
    startDate: Date,
    endDate: Date,
  ) {
    const tanques = await this.tankRepository.find({
      relations: ['client'],
    });

    const consumos = await Promise.all(
      tanques.map(async (tanque) => {
        const consumo = await this.calcularConsumoTanque(tanque.id, startDate, endDate);
        return {
          tanque: {
            id: tanque.id,
            codigo: tanque.code,
            ubicacion: tanque.location,
          },
          cliente: tanque.client.company || `${tanque.client.firstName} ${tanque.client.lastName}`,
          consumoTotal: consumo.toFixed(2),
          consumoDiario: (consumo / 30).toFixed(2),
        };
      }),
    );

    return consumos
      .sort((a, b) => parseFloat(b.consumoTotal) - parseFloat(a.consumoTotal))
      .slice(0, limite);
  }

  private async obtenerTendenciaConsumo(startDate: Date, endDate: Date) {
    const dias = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const tendencia = [];

    for (let i = 0; i < dias; i += 3) { // Cada 3 días para no saturar
      const dia = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
      const diaSiguiente = new Date(dia.getTime() + 24 * 60 * 60 * 1000);

      const consumo = await this.calcularConsumoPromedio(dia, diaSiguiente);

      tendencia.push({
        fecha: dia.toISOString().split('T')[0],
        consumo: consumo.toFixed(2),
      });
    }

    return tendencia;
  }

  private async analizarPatronesConsumo(startDate: Date, endDate: Date) {
    // Análisis por día de la semana
    const consumoPorDia = new Array(7).fill(0);
    const contadorDias = new Array(7).fill(0);

    const lecturas = await this.monitoringRepository.find({
      where: {
        recordedAt: Between(startDate, endDate),
      },
      order: {
        recordedAt: 'ASC',
      },
    });

    // Calcular consumo basado en diferencia de niveles entre lecturas consecutivas
    for (let i = 1; i < lecturas.length; i++) {
      const lecturaActual = lecturas[i];
      const lecturaAnterior = lecturas[i - 1];

      // Consumo = litros anteriores - litros actuales (solo si bajó)
      const consumo = Math.max(0, lecturaAnterior.gasLevelLiters - lecturaActual.gasLevelLiters);

      const dia = lecturaActual.recordedAt.getDay();
      consumoPorDia[dia] += consumo;
      contadorDias[dia]++;
    }

    const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

    return diasSemana.map((nombre, index) => ({
      dia: nombre,
      consumoPromedio: contadorDias[index] > 0
        ? (consumoPorDia[index] / contadorDias[index]).toFixed(2)
        : 0,
    }));
  }

  private async predecirRecargas() {
    const tanques = await this.tankRepository.find({
      where: { status: TankStatus.ACTIVE },
      relations: ['client'],
    });

    const predicciones = [];

    for (const tanque of tanques) {
      // Calcular consumo promedio últimos 7 días
      const hace7Dias = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const consumoDiario = await this.calcularConsumoTanque(
        tanque.id,
        hace7Dias,
        new Date(),
      ) / 7;

      if (consumoDiario > 0) {
        const diasRestantes = tanque.currentLevelLiters / consumoDiario;
        const fechaEstimada = new Date(Date.now() + diasRestantes * 24 * 60 * 60 * 1000);

        predicciones.push({
          tanque: {
            id: tanque.id,
            codigo: tanque.code,
            ubicacion: tanque.location,
          },
          cliente: tanque.client.company || `${tanque.client.firstName} ${tanque.client.lastName}`,
          nivelActual: tanque.currentLevelPercentage.toFixed(2),
          consumoDiario: consumoDiario.toFixed(2),
          diasRestantes: Math.floor(diasRestantes),
          fechaEstimadaRecarga: fechaEstimada,
          urgente: diasRestantes < 7,
        });
      }
    }

    return predicciones
      .sort((a, b) => a.diasRestantes - b.diasRestantes)
      .slice(0, 10);
  }

  private async analizarCostos(startDate: Date, endDate: Date) {
    const suministros = await this.supplyRepository.find({
      where: {
        supplyDate: Between(startDate, endDate),
      },
      relations: ['tank', 'tank.client'],
    });

    const costoTotal = suministros.reduce((sum, s) => sum + (s.cost || 0), 0);
    const litrosTotales = suministros.reduce((sum, s) => sum + s.quantityLiters, 0);
    const costoPorLitro = litrosTotales > 0 ? costoTotal / litrosTotales : 0;

    // Agrupar por cliente
    const costosPorCliente = {};
    suministros.forEach(s => {
      const clienteNombre = s.tank.client.company ||
        `${s.tank.client.firstName} ${s.tank.client.lastName}`;

      if (!costosPorCliente[clienteNombre]) {
        costosPorCliente[clienteNombre] = {
          costo: 0,
          litros: 0,
          cantidad: 0,
        };
      }

      costosPorCliente[clienteNombre].costo += s.cost || 0;
      costosPorCliente[clienteNombre].litros += s.quantityLiters;
      costosPorCliente[clienteNombre].cantidad++;
    });

    return {
      totales: {
        costoTotal: costoTotal.toFixed(2),
        litrosTotales: litrosTotales.toFixed(2),
        costoPorLitro: costoPorLitro.toFixed(2),
        cantidadSuministros: suministros.length,
      },
      porCliente: Object.entries(costosPorCliente).map(([nombre, datos]: [string, any]) => ({
        cliente: nombre,
        costoTotal: datos.costo.toFixed(2),
        litrosTotal: datos.litros.toFixed(2),
        cantidadSuministros: datos.cantidad,
        costoPromedio: (datos.costo / datos.cantidad).toFixed(2),
      })),
    };
  }

  private async calcularEficiencia(startDate: Date, endDate: Date) {
    const alertas = await this.alertRepository.find({
      where: {
        createdAt: Between(startDate, endDate),
      },
    });

    const recargas = await this.rechargeRepository.find({
      where: {
        scheduledDate: Between(startDate, endDate),
      },
    });

    const alertasResueltas = alertas.filter(a => a.status === AlertStatus.RESOLVED);
    const recargasCompletadas = recargas.filter(r => r.status === RechargeStatus.COMPLETED);
    const recargasCanceladas = recargas.filter(r => r.status === RechargeStatus.CANCELLED);

    // Calcular tiempos de respuesta
    const tiemposRespuesta = alertasResueltas
      .filter(a => a.resolvedAt)
      .map(a => (a.resolvedAt.getTime() - a.createdAt.getTime()) / (1000 * 60 * 60)); // en horas

    const tiempoRespuestaPromedio = tiemposRespuesta.length > 0
      ? tiemposRespuesta.reduce((sum, t) => sum + t, 0) / tiemposRespuesta.length
      : 0;

    return {
      alertas: {
        total: alertas.length,
        resueltas: alertasResueltas.length,
        porcentajeResolucion: alertas.length > 0
          ? ((alertasResueltas.length / alertas.length) * 100).toFixed(1)
          : 0,
        tiempoRespuestaPromedio: tiempoRespuestaPromedio.toFixed(2) + ' horas',
      },
      recargas: {
        total: recargas.length,
        completadas: recargasCompletadas.length,
        canceladas: recargasCanceladas.length,
        tasaExito: recargas.length > 0
          ? ((recargasCompletadas.length / recargas.length) * 100).toFixed(1)
          : 0,
      },
    };
  }
}