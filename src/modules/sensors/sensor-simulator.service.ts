import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tank, TankStatus } from '../../entities/tank.entity';
import { Sensor, SensorStatus } from '../../entities/sensor.entity';
import { TanksService } from '../tanks/tanks.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

export interface SensorReading {
  tankId: string;
  sensorId: string;
  levelPercentage: number;
  levelLiters: number;
  timestamp: Date;
}

@Injectable()
export class SensorSimulatorService {
  private readonly logger = new Logger(SensorSimulatorService.name);
  private simulationIntervals: Map<string, NodeJS.Timeout> = new Map();
  private consumptionRates: Map<string, number> = new Map(); // Litros por hora

  constructor(
    private configService: ConfigService,
    @InjectRepository(Tank)
    private tankRepository: Repository<Tank>,
    @InjectRepository(Sensor)
    private sensorRepository: Repository<Sensor>,
    @Inject(forwardRef(() => TanksService))
    private tanksService: TanksService,
    private eventEmitter: EventEmitter2,
  ) {}

  async onModuleInit() {
    if (this.configService.get<boolean>('MOCK_SENSOR_ENABLED', true)) {
      this.logger.log('Iniciando simulador de sensores...');
      await this.startAllSimulations();
    }
  }

  async onModuleDestroy() {
    this.stopAllSimulations();
  }

  async startAllSimulations() {
    const activeTanks = await this.tankRepository.find({
      where: { status: TankStatus.ACTIVE },
      relations: ['sensor'],
    });

    for (const tank of activeTanks) {
      if (tank.sensor && tank.sensor.status === SensorStatus.ACTIVE) {
        this.startSimulation(tank.id);
      }
    }
  }

  startSimulation(tankId: string) {
    // Detener simulación existente si la hay
    this.stopSimulation(tankId);

    // Generar tasa de consumo aleatoria (entre 0.5 y 3 litros por hora)
    const consumptionRate = 0.5 + Math.random() * 2.5;
    this.consumptionRates.set(tankId, consumptionRate);

    this.logger.log(
      `Iniciando simulación para tanque ${tankId} con consumo de ${consumptionRate.toFixed(2)} L/h`,
    );

    // Crear intervalo de simulación
    const interval = setInterval(async () => {
      await this.simulateReading(tankId);
    }, this.configService.get<number>('DEFAULT_SENSOR_READING_INTERVAL', 5000));

    this.simulationIntervals.set(tankId, interval);
  }

  stopSimulation(tankId: string) {
    const interval = this.simulationIntervals.get(tankId);
    if (interval) {
      clearInterval(interval);
      this.simulationIntervals.delete(tankId);
      this.consumptionRates.delete(tankId);
      this.logger.log(`Simulación detenida para tanque ${tankId}`);
    }
  }

  stopAllSimulations() {
    for (const [tankId, interval] of this.simulationIntervals) {
      clearInterval(interval);
    }
    this.simulationIntervals.clear();
    this.consumptionRates.clear();
    this.logger.log('Todas las simulaciones detenidas');
  }

  async simulateReading(tankId: string) {
    try {
      const tank = await this.tankRepository.findOne({
        where: { id: tankId },
        relations: ['sensor', 'client'],
      });

      if (!tank || tank.status !== TankStatus.ACTIVE) {
        this.stopSimulation(tankId);
        return;
      }

      if (!tank.sensor || tank.sensor.status !== SensorStatus.ACTIVE) {
        return;
      }

      // Obtener tasa de consumo
      const consumptionRate = this.consumptionRates.get(tankId) || 1;

      // Calcular nuevo nivel (decrementar basado en el tiempo transcurrido)
      const intervalSeconds =
        this.configService.get<number>('DEFAULT_SENSOR_READING_INTERVAL', 5000) / 1000;
      const consumptionInInterval = (consumptionRate / 3600) * intervalSeconds;

      // El gas solo puede bajar, nunca subir (simulación de consumo)
      let newLevelLiters = Math.max(0, tank.currentLevelLiters - consumptionInInterval);

      // Asegurar que no exceda la capacidad máxima
      newLevelLiters = Math.min(newLevelLiters, tank.capacityLiters);

      // Calcular porcentaje (nunca mayor a 100%)
      const newLevelPercentage = Math.min(100, (newLevelLiters / tank.capacityLiters) * 100);

      // Actualizar el tanque (sin temperatura ni presión)
      const updatedTank = await this.tanksService.updateGasLevel(
        tankId,
        newLevelPercentage,
      );

      // Crear objeto de lectura
      const reading: SensorReading = {
        tankId: tank.id,
        sensorId: tank.sensor.id,
        levelPercentage: newLevelPercentage,
        levelLiters: newLevelLiters,
        timestamp: new Date(),
      };

      // Emitir evento para WebSocket y sistema de alertas
      this.eventEmitter.emit('sensor.reading', reading);

      // Verificar umbrales para alertas
      await this.checkThresholds(tank, newLevelPercentage);

      // Si el tanque está casi vacío, reducir la tasa de consumo
      if (newLevelPercentage < 5) {
        this.consumptionRates.set(tankId, consumptionRate * 0.1);
      }

    } catch (error) {
      this.logger.error(
        `Error en simulación de tanque ${tankId}: ${error.message}`,
      );
    }
  }

  private async checkThresholds(tank: Tank, levelPercentage: number) {
    const client = tank.client;

    // Umbral predefinido del 15% para alerta
    const UMBRAL_ALERTA_PREDEFINIDO = 15;

    // Usar umbrales predefinidos (no hay configuración por cliente en User)
    const umbralBajo = UMBRAL_ALERTA_PREDEFINIDO;
    const umbralCritico = 10;

    // Verificar umbral bajo (15% por defecto)
    if (levelPercentage <= umbralBajo && levelPercentage > umbralCritico) {
      this.logger.warn(`⚠️ Alerta: Tanque ${tank.code} al ${levelPercentage.toFixed(2)}% - Nivel Bajo (umbral: ${umbralBajo}%)`);
      this.eventEmitter.emit('alert.lowLevel', {
        tank,
        levelPercentage,
        threshold: umbralBajo,
        message: `Nivel de gas bajo en tanque ${tank.code}: ${levelPercentage.toFixed(2)}%`,
      });
    }

    // Verificar umbral crítico (10% por defecto)
    if (levelPercentage <= umbralCritico) {
      this.logger.error(`🚨 Alerta Crítica: Tanque ${tank.code} al ${levelPercentage.toFixed(2)}% - Nivel Crítico (umbral: ${umbralCritico}%)`);
      this.eventEmitter.emit('alert.criticalLevel', {
        tank,
        levelPercentage,
        threshold: umbralCritico,
        message: `¡NIVEL CRÍTICO! Tanque ${tank.code}: ${levelPercentage.toFixed(2)}% - Requiere recarga inmediata`,
      });
    }

    // Alerta adicional al llegar exactamente al 15%
    if (Math.floor(levelPercentage) === UMBRAL_ALERTA_PREDEFINIDO) {
      this.logger.warn(`📢 Tanque ${tank.code} ha alcanzado el 15% de capacidad`);
      this.eventEmitter.emit('alert.threshold15', {
        tank,
        levelPercentage,
        message: `Tanque ${tank.code} ha alcanzado el umbral del 15% de capacidad`,
      });
    }
  }

  // Endpoint para simular consumo manual (para pruebas)
  async simulateConsumption(tankId: string, litersConsumed: number) {
    const tank = await this.tankRepository.findOne({
      where: { id: tankId },
      relations: ['sensor'],
    });

    if (!tank) {
      throw new Error('Tanque no encontrado');
    }

    const newLevelLiters = Math.max(0, tank.currentLevelLiters - litersConsumed);
    const newLevelPercentage = Math.max(0, Math.min(100, (newLevelLiters / tank.capacityLiters) * 100));

    return this.tanksService.updateGasLevel(tankId, newLevelPercentage);
  }

  // Endpoint para recargar tanque (simular llenado)
  async simulateRefill(tankId: string, litersAdded?: number) {
    const tank = await this.tankRepository.findOne({
      where: { id: tankId },
    });

    if (!tank) {
      throw new Error('Tanque no encontrado');
    }

    const newLevelLiters = litersAdded
      ? Math.min(tank.capacityLiters, tank.currentLevelLiters + litersAdded)
      : tank.capacityLiters; // Llenar completamente si no se especifica cantidad

    const newLevelPercentage = Math.min(100, (newLevelLiters / tank.capacityLiters) * 100);

    // Resetear tasa de consumo a normal
    const consumptionRate = 0.5 + Math.random() * 2.5;
    this.consumptionRates.set(tankId, consumptionRate);

    return this.tanksService.updateGasLevel(tankId, newLevelPercentage);
  }

  // Obtener estado actual de la simulación
  getSimulationStatus(tankId: string) {
    return {
      isRunning: this.simulationIntervals.has(tankId),
      consumptionRate: this.consumptionRates.get(tankId) || 0,
    };
  }

  // Cambiar tasa de consumo dinámicamente
  setConsumptionRate(tankId: string, ratePerHour: number) {
    if (this.consumptionRates.has(tankId)) {
      this.consumptionRates.set(tankId, ratePerHour);
      this.logger.log(
        `Tasa de consumo actualizada para tanque ${tankId}: ${ratePerHour} L/h`,
      );
    }
  }
}