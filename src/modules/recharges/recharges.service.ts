import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThanOrEqual, Between } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Recharge, RechargeStatus, RechargeRequestedBy } from '../../entities/recharge.entity';
import { Tank } from '../../entities/tank.entity';
import { User, UserRole } from '../../entities/user.entity';
import { Supply, SupplyStatus } from '../../entities/supply.entity';
import { CreateRechargeDto } from './dto/create-recharge.dto';
import { RescheduleRechargeDto } from './dto/reschedule-recharge.dto';
import { CompleteRechargeDto } from './dto/complete-recharge.dto';

@Injectable()
export class RechargesService {
  constructor(
    @InjectRepository(Recharge)
    private rechargeRepository: Repository<Recharge>,
    @InjectRepository(Tank)
    private tankRepository: Repository<Tank>,
    @InjectRepository(Supply)
    private supplyRepository: Repository<Supply>,
    private eventEmitter: EventEmitter2,
  ) {}

  async create(
    createRechargeDto: CreateRechargeDto,
    requestedByUser: User,
  ): Promise<Recharge> {
    const tank = await this.tankRepository.findOne({
      where: { id: createRechargeDto.tankId },
      relations: ['client'],
    });

    if (!tank) {
      throw new NotFoundException('Tanque no encontrado');
    }

    // Verificar permisos
    if (requestedByUser.role === UserRole.CLIENT && tank.client.id !== requestedByUser.id) {
      throw new ForbiddenException('No tienes permiso para programar recargas en este tanque');
    }

    // Verificar si ya hay una recarga programada
    const existingRecharge = await this.rechargeRepository.findOne({
      where: {
        tank: { id: tank.id },
        status: RechargeStatus.SCHEDULED,
      },
    });

    if (existingRecharge) {
      throw new BadRequestException('Ya existe una recarga programada para este tanque');
    }

    // Calcular cantidad estimada si no se proporciona
    const estimatedQuantity = createRechargeDto.estimatedQuantityLiters ||
      (tank.capacityLiters - tank.currentLevelLiters);

    const recharge = this.rechargeRepository.create({
      tank,
      scheduledDate: new Date(createRechargeDto.scheduledDate),
      estimatedQuantityLiters: estimatedQuantity,
      status: RechargeStatus.SCHEDULED,
      requestedBy: requestedByUser.role === UserRole.CLIENT
        ? RechargeRequestedBy.CLIENT
        : RechargeRequestedBy.ADMIN,
      requestedById: requestedByUser.id,
      notes: createRechargeDto.notes,
    });

    const savedRecharge = await this.rechargeRepository.save(recharge);

    // Emitir evento para notificaciones
    this.eventEmitter.emit('recharge.scheduled', {
      recharge: savedRecharge,
      tank,
      user: requestedByUser,
    });

    return savedRecharge;
  }

  async findAll(
    userId?: string,
    userRole?: UserRole,
    status?: RechargeStatus,
    startDate?: Date,
    endDate?: Date,
  ): Promise<Recharge[]> {
    const query = this.rechargeRepository
      .createQueryBuilder('recharge')
      .leftJoinAndSelect('recharge.tank', 'tank')
      .leftJoinAndSelect('tank.client', 'client');

    // Filtrar por rol
    if (userRole === UserRole.CLIENT) {
      query.andWhere('client.id = :userId', { userId });
    }

    // Filtrar por estado
    if (status) {
      query.andWhere('recharge.status = :status', { status });
    }

    // Filtrar por fechas
    if (startDate && endDate) {
      query.andWhere('recharge.scheduledDate BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      });
    } else if (startDate) {
      query.andWhere('recharge.scheduledDate >= :startDate', { startDate });
    } else if (endDate) {
      query.andWhere('recharge.scheduledDate <= :endDate', { endDate });
    }

    query.orderBy('recharge.scheduledDate', 'ASC');

    return query.getMany();
  }

  async findOne(id: string, userId?: string, userRole?: UserRole): Promise<Recharge> {
    const recharge = await this.rechargeRepository.findOne({
      where: { id },
      relations: ['tank', 'tank.client'],
    });

    if (!recharge) {
      throw new NotFoundException('Recarga no encontrada');
    }

    // Verificar permisos
    if (userRole === UserRole.CLIENT && recharge.tank.client.id !== userId) {
      throw new ForbiddenException('No tienes acceso a esta recarga');
    }

    return recharge;
  }

  async reschedule(
    id: string,
    rescheduleDto: RescheduleRechargeDto,
    userId: string,
    userRole: UserRole,
  ): Promise<Recharge> {
    const recharge = await this.findOne(id, userId, userRole);

    if (recharge.status !== RechargeStatus.SCHEDULED) {
      throw new BadRequestException('Solo se pueden reprogramar recargas programadas');
    }

    // Guardar fecha anterior
    recharge.previousScheduledDate = recharge.scheduledDate;
    recharge.scheduledDate = new Date(rescheduleDto.newScheduledDate);
    recharge.status = RechargeStatus.RESCHEDULED;
    recharge.rescheduledReason = rescheduleDto.rescheduledReason;

    const updatedRecharge = await this.rechargeRepository.save(recharge);

    // Emitir evento
    this.eventEmitter.emit('recharge.rescheduled', {
      recharge: updatedRecharge,
      previousDate: recharge.previousScheduledDate,
    });

    // Volver a estado SCHEDULED después de actualizar
    updatedRecharge.status = RechargeStatus.SCHEDULED;
    return this.rechargeRepository.save(updatedRecharge);
  }

  async startRecharge(id: string): Promise<Recharge> {
    const recharge = await this.rechargeRepository.findOne({
      where: { id },
      relations: ['tank'],
    });

    if (!recharge) {
      throw new NotFoundException('Recarga no encontrada');
    }

    if (recharge.status !== RechargeStatus.SCHEDULED) {
      throw new BadRequestException('La recarga no está programada');
    }

    recharge.status = RechargeStatus.IN_PROGRESS;
    return this.rechargeRepository.save(recharge);
  }

  async complete(
    id: string,
    completeDto: CompleteRechargeDto,
    employeeId: string,
  ): Promise<Recharge> {
    const recharge = await this.rechargeRepository.findOne({
      where: { id },
      relations: ['tank'],
    });

    if (!recharge) {
      throw new NotFoundException('Recarga no encontrada');
    }

    if (recharge.status !== RechargeStatus.IN_PROGRESS &&
        recharge.status !== RechargeStatus.SCHEDULED) {
      throw new BadRequestException('La recarga no puede ser completada en su estado actual');
    }

    // Actualizar recarga
    recharge.status = RechargeStatus.COMPLETED;
    recharge.completedDate = new Date();
    recharge.actualQuantityLiters = completeDto.actualQuantityLiters;
    recharge.assignedEmployeeId = employeeId;
    if (completeDto.notes) {
      recharge.notes = (recharge.notes ? recharge.notes + '\n' : '') + completeDto.notes;
    }

    // Crear registro de suministro
    const supply = this.supplyRepository.create({
      tank: recharge.tank,
      quantityLiters: completeDto.actualQuantityLiters,
      previousLevel: recharge.tank.currentLevelLiters,
      currentLevel: Math.min(
        recharge.tank.capacityLiters,
        recharge.tank.currentLevelLiters + completeDto.actualQuantityLiters
      ),
      supplyDate: new Date(),
      status: SupplyStatus.COMPLETED,
      employee: { id: employeeId } as User,
      notes: `Recarga #${recharge.id}`,
    });

    await this.supplyRepository.save(supply);

    // Actualizar nivel del tanque
    recharge.tank.currentLevelLiters = supply.currentLevel;
    recharge.tank.currentLevelPercentage =
      (supply.currentLevel / recharge.tank.capacityLiters) * 100;
    recharge.tank.lastRechargeDate = new Date();
    recharge.tank.lastRechargeAmount = completeDto.actualQuantityLiters;

    await this.tankRepository.save(recharge.tank);

    const completedRecharge = await this.rechargeRepository.save(recharge);

    // Emitir evento
    this.eventEmitter.emit('recharge.completed', {
      recharge: completedRecharge,
      tank: recharge.tank,
      supply,
    });

    return completedRecharge;
  }

  async cancel(
    id: string,
    reason: string,
    userId: string,
    userRole: UserRole,
  ): Promise<Recharge> {
    const recharge = await this.findOne(id, userId, userRole);

    if (recharge.status === RechargeStatus.COMPLETED) {
      throw new BadRequestException('No se puede cancelar una recarga completada');
    }

    if (recharge.status === RechargeStatus.CANCELLED) {
      throw new BadRequestException('La recarga ya está cancelada');
    }

    recharge.status = RechargeStatus.CANCELLED;
    recharge.cancellationReason = reason;

    const cancelledRecharge = await this.rechargeRepository.save(recharge);

    // Emitir evento
    this.eventEmitter.emit('recharge.cancelled', {
      recharge: cancelledRecharge,
    });

    return cancelledRecharge;
  }

  async getUpcoming(days: number = 7): Promise<Recharge[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    return this.rechargeRepository.find({
      where: {
        status: RechargeStatus.SCHEDULED,
        scheduledDate: LessThanOrEqual(futureDate),
      },
      relations: ['tank', 'tank.client'],
      order: {
        scheduledDate: 'ASC',
      },
    });
  }

  async getByTank(tankId: string): Promise<Recharge[]> {
    return this.rechargeRepository.find({
      where: { tank: { id: tankId } },
      order: { scheduledDate: 'DESC' },
    });
  }

  // Crear recarga automática por nivel bajo
  async createAutomaticRecharge(tank: Tank): Promise<Recharge> {
    // Verificar si ya hay una recarga programada
    const existingRecharge = await this.rechargeRepository.findOne({
      where: {
        tank: { id: tank.id },
        status: RechargeStatus.SCHEDULED,
      },
    });

    if (existingRecharge) {
      return existingRecharge;
    }

    // Programar para el día siguiente
    const scheduledDate = new Date();
    scheduledDate.setDate(scheduledDate.getDate() + 1);
    scheduledDate.setHours(10, 0, 0, 0); // 10:00 AM

    const recharge = this.rechargeRepository.create({
      tank,
      scheduledDate,
      estimatedQuantityLiters: tank.capacityLiters - tank.currentLevelLiters,
      status: RechargeStatus.SCHEDULED,
      requestedBy: RechargeRequestedBy.SYSTEM,
      notes: 'Recarga automática por nivel bajo',
    });

    return this.rechargeRepository.save(recharge);
  }
}