import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tank, TankStatus, TankType } from '../../entities/tank.entity';
import { Sensor, SensorStatus } from '../../entities/sensor.entity';
import { User, UserRole } from '../../entities/user.entity';
import { MonitoringHistory } from '../../entities/monitoring-history.entity';
import { CreateTankDto } from './dto/create-tank.dto';
import { UpdateTankDto } from './dto/update-tank.dto';
import { UpdateSensorDto } from './dto/update-sensor.dto';
import { SensorSimulatorService } from '../sensors/sensor-simulator.service';

@Injectable()
export class TanksService {
  constructor(
    @InjectRepository(Tank)
    private tankRepository: Repository<Tank>,
    @InjectRepository(Sensor)
    private sensorRepository: Repository<Sensor>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(MonitoringHistory)
    private monitoringHistoryRepository: Repository<MonitoringHistory>,
    @Inject(forwardRef(() => SensorSimulatorService))
    private sensorSimulatorService: SensorSimulatorService,
  ) {}

  async create(createTankDto: CreateTankDto): Promise<Tank> {
    // Verificar si el código ya existe
    const existingTank = await this.tankRepository.findOne({
      where: { code: createTankDto.code },
    });

    if (existingTank) {
      throw new BadRequestException('El código del tanque ya existe');
    }

    const tankType = createTankDto.type || TankType.CLIENT;
    let client = null;

    // Solo requerir cliente para tanques tipo CLIENT
    if (tankType === TankType.CLIENT) {
      if (!createTankDto.clientId) {
        throw new BadRequestException('El clientId es requerido para tanques tipo CLIENT');
      }

      // Buscar el User con rol CLIENT
      const user = await this.userRepository.findOne({
        where: { id: createTankDto.clientId, role: UserRole.CLIENT },
      });

      if (!user) {
        throw new NotFoundException(`No se encontró un usuario con ID ${createTankDto.clientId} y rol CLIENT`);
      }

      // Usar el User directamente como cliente
      client = user;
    }
    // Si es tanque de empresa, no se requiere validación adicional
    // ya que puede haber múltiples tanques de empresa

    // Crear el sensor automáticamente
    const sensor = this.sensorRepository.create({
      serialNumber: `SENSOR-${createTankDto.code}-${Date.now()}`,
      status: SensorStatus.ACTIVE,
    });

    const savedSensor = await this.sensorRepository.save(sensor);

    // Crear el tanque
    const tank = this.tankRepository.create({
      code: createTankDto.code,
      type: tankType,
      capacityLiters: createTankDto.capacityLiters,
      location: createTankDto.location,
      client,
      sensor: savedSensor,
      status: TankStatus.ACTIVE,
      currentLevelLiters: createTankDto.capacityLiters, // Inicialmente lleno
      currentLevelPercentage: 100,
    });

    const savedTank = await this.tankRepository.save(tank);

    // Crear registro inicial en el historial
    await this.monitoringHistoryRepository.save({
      tank: savedTank,
      gasLevelPercentage: 100,
      gasLevelLiters: createTankDto.capacityLiters,
      consumptionRate: 0,
    });

    // Iniciar simulación automáticamente para el nuevo tanque
    if (savedSensor.status === SensorStatus.ACTIVE) {
      this.sensorSimulatorService.startSimulation(savedTank.id);
    }

    return this.findOne(savedTank.id);
  }

  async findAll(userId: string, userRole: UserRole): Promise<Tank[]> {
    const query = this.tankRepository
      .createQueryBuilder('tank')
      .leftJoinAndSelect('tank.client', 'client')
      .leftJoinAndSelect('tank.sensor', 'sensor');

    // Si es cliente, solo mostrar sus tanques
    if (userRole === UserRole.CLIENT) {
      query.where('client.id = :userId', { userId });
    }

    return query.getMany();
  }

  async findOne(id: string, userId?: string, userRole?: UserRole): Promise<Tank> {
    const tank = await this.tankRepository.findOne({
      where: { id },
      relations: ['client', 'sensor', 'alerts', 'recharges'],
    });

    if (!tank) {
      throw new NotFoundException('Tanque no encontrado');
    }

    // Verificar permisos si se proporciona usuario
    if (userId && userRole === UserRole.CLIENT && tank.client.id !== userId) {
      throw new ForbiddenException('No tienes acceso a este tanque');
    }

    return tank;
  }

  async update(
    id: string,
    updateTankDto: UpdateTankDto,
    userId?: string,
    userRole?: UserRole,
  ): Promise<Tank> {
    const tank = await this.findOne(id, userId, userRole);

    Object.assign(tank, updateTankDto);
    const updatedTank = await this.tankRepository.save(tank);

    return this.findOne(updatedTank.id);
  }

  async updateSensor(
    tankId: string,
    updateSensorDto: UpdateSensorDto,
  ): Promise<Sensor> {
    const tank = await this.tankRepository.findOne({
      where: { id: tankId },
      relations: ['sensor'],
    });

    if (!tank) {
      throw new NotFoundException('Tanque no encontrado');
    }

    if (!tank.sensor) {
      throw new NotFoundException('Sensor no encontrado');
    }

    Object.assign(tank.sensor, updateSensorDto);
    return this.sensorRepository.save(tank.sensor);
  }

  async updateGasLevel(
    tankId: string,
    levelPercentage: number,
  ): Promise<Tank> {
    const tank = await this.tankRepository.findOne({
      where: { id: tankId },
      relations: ['sensor'],
    });

    if (!tank) {
      throw new NotFoundException('Tanque no encontrado');
    }

    // Calcular el nivel en litros
    const levelLiters = (tank.capacityLiters * levelPercentage) / 100;

    // Actualizar tanque
    tank.currentLevelPercentage = levelPercentage;
    tank.currentLevelLiters = levelLiters;

    // Actualizar sensor
    tank.sensor.lastReading = levelPercentage;
    tank.sensor.lastReadingDate = new Date();

    // Guardar historial simplificado (solo litros, porcentaje, fecha y tanque)
    await this.monitoringHistoryRepository.save({
      tank,
      gasLevelPercentage: levelPercentage,
      gasLevelLiters: levelLiters,
    });

    await this.sensorRepository.save(tank.sensor);
    return this.tankRepository.save(tank);
  }

  async getTanksByClient(clientId: string): Promise<Tank[]> {
    return this.tankRepository.find({
      where: { client: { id: clientId } },
      relations: ['sensor'],
    });
  }

  async getCompanyTanks(): Promise<Tank[]> {
    return this.tankRepository.find({
      where: { type: TankType.COMPANY },
      relations: ['sensor'],
    });
  }

  async getCompanyTankWithMostGas(): Promise<Tank | null> {
    const companyTanks = await this.tankRepository.find({
      where: { type: TankType.COMPANY },
      relations: ['sensor'],
      order: { currentLevelLiters: 'DESC' },
    });

    return companyTanks.length > 0 ? companyTanks[0] : null;
  }

  async getTankHistory(
    tankId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<MonitoringHistory[]> {
    const query = this.monitoringHistoryRepository
      .createQueryBuilder('history')
      .leftJoinAndSelect('history.tank', 'tank')
      .where('tank.id = :tankId', { tankId })
      .orderBy('history.recordedAt', 'DESC');

    if (startDate) {
      query.andWhere('history.recordedAt >= :startDate', { startDate });
    }

    if (endDate) {
      query.andWhere('history.recordedAt <= :endDate', { endDate });
    }

    return query.getMany();
  }

  async remove(id: string): Promise<void> {
    const tank = await this.findOne(id);

    // Desactivar el tanque en lugar de eliminarlo
    tank.status = TankStatus.INACTIVE;
    tank.sensor.status = SensorStatus.INACTIVE;

    await this.sensorRepository.save(tank.sensor);
    await this.tankRepository.save(tank);
  }
}