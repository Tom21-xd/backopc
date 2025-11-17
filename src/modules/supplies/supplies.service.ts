import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Supply, SupplyStatus } from '../../entities/supply.entity';
import { Tank, TankType } from '../../entities/tank.entity';
import { User, UserRole } from '../../entities/user.entity';
import { CreateSupplyDto } from './dto/create-supply.dto';
import { TanksService } from '../tanks/tanks.service';

@Injectable()
export class SuppliesService {
  constructor(
    @InjectRepository(Supply)
    private supplyRepository: Repository<Supply>,
    @InjectRepository(Tank)
    private tankRepository: Repository<Tank>,
    private tanksService: TanksService,
  ) {}

  async create(createSupplyDto: CreateSupplyDto, employee: User): Promise<Supply> {
    const tank = await this.tankRepository.findOne({
      where: { id: createSupplyDto.tankId },
      relations: ['client'],
    });

    if (!tank) {
      throw new NotFoundException('Tanque no encontrado');
    }

    // Solo se puede suministrar a tanques de clientes
    if (tank.type !== TankType.CLIENT) {
      throw new BadRequestException('Solo se puede suministrar gas a tanques de clientes');
    }

    // Buscar el tanque de empresa con más gas disponible
    const companyTank = await this.tanksService.getCompanyTankWithMostGas();
    if (!companyTank) {
      throw new BadRequestException('No existe ningún tanque de la empresa configurado');
    }

    // Verificar que el tanque seleccionado tiene suficiente gas
    if (companyTank.currentLevelLiters < createSupplyDto.quantityLiters) {
      throw new BadRequestException(
        `El tanque de empresa con más gas (${companyTank.code}) solo tiene ${companyTank.currentLevelLiters.toFixed(2)} litros disponibles`,
      );
    }

    const previousLevel = tank.currentLevelLiters;
    const newLevel = Math.min(
      tank.capacityLiters,
      previousLevel + createSupplyDto.quantityLiters,
    );

    const supply = this.supplyRepository.create({
      tank,
      employee,
      quantityLiters: createSupplyDto.quantityLiters,
      previousLevel,
      currentLevel: newLevel,
      supplyDate: createSupplyDto.supplyDate
        ? new Date(createSupplyDto.supplyDate)
        : new Date(),
      status: SupplyStatus.COMPLETED,
      invoiceNumber: createSupplyDto.invoiceNumber,
      cost: createSupplyDto.cost,
      notes: createSupplyDto.notes,
    });

    // Actualizar nivel del tanque cliente
    await this.tanksService.updateGasLevel(
      tank.id,
      (newLevel / tank.capacityLiters) * 100,
    );

    // Descontar del tanque principal de la empresa
    const newCompanyLevel = companyTank.currentLevelLiters - createSupplyDto.quantityLiters;
    await this.tanksService.updateGasLevel(
      companyTank.id,
      (newCompanyLevel / companyTank.capacityLiters) * 100,
    );

    // Actualizar información de última recarga
    tank.lastRechargeDate = supply.supplyDate;
    tank.lastRechargeAmount = createSupplyDto.quantityLiters;
    await this.tankRepository.save(tank);

    return this.supplyRepository.save(supply);
  }

  async findAll(
    userId?: string,
    userRole?: UserRole,
    startDate?: Date,
    endDate?: Date,
  ): Promise<Supply[]> {
    const query = this.supplyRepository
      .createQueryBuilder('supply')
      .leftJoinAndSelect('supply.tank', 'tank')
      .leftJoinAndSelect('tank.client', 'client')
      .leftJoinAndSelect('supply.employee', 'employee');

    // Filtrar por rol
    if (userRole === UserRole.CLIENT) {
      query.where('client.id = :userId', { userId });
    }

    // Filtrar por fechas
    if (startDate && endDate) {
      query.andWhere('supply.supplyDate BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      });
    }

    query.orderBy('supply.supplyDate', 'DESC');

    return query.getMany();
  }

  async findOne(id: string): Promise<Supply> {
    const supply = await this.supplyRepository.findOne({
      where: { id },
      relations: ['tank', 'tank.client', 'employee'],
    });

    if (!supply) {
      throw new NotFoundException('Suministro no encontrado');
    }

    return supply;
  }

  async getByTank(tankId: string): Promise<Supply[]> {
    return this.supplyRepository.find({
      where: { tank: { id: tankId } },
      relations: ['employee'],
      order: { supplyDate: 'DESC' },
    });
  }

  async getByEmployee(employeeId: string): Promise<Supply[]> {
    return this.supplyRepository.find({
      where: { employee: { id: employeeId } },
      relations: ['tank', 'tank.client'],
      order: { supplyDate: 'DESC' },
    });
  }

  async getStatistics(startDate?: Date, endDate?: Date) {
    const query = this.supplyRepository.createQueryBuilder('supply');

    if (startDate && endDate) {
      query.where('supply.supplyDate BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      });
    }

    const supplies = await query.getMany();

    const totalSupplies = supplies.length;
    const totalLiters = supplies.reduce(
      (sum, supply) => sum + supply.quantityLiters,
      0,
    );
    const totalCost = supplies.reduce(
      (sum, supply) => sum + (supply.cost || 0),
      0,
    );

    return {
      totalSupplies,
      totalLiters,
      totalCost,
      averageSupplyLiters: totalSupplies > 0 ? totalLiters / totalSupplies : 0,
      averageCost: totalSupplies > 0 ? totalCost / totalSupplies : 0,
    };
  }

  async cancelSupply(id: string, userId: string): Promise<Supply> {
    const supply = await this.findOne(id);

    if (supply.status === SupplyStatus.CANCELLED) {
      throw new BadRequestException('El suministro ya está cancelado');
    }

    // Revertir el nivel del tanque
    const tank = supply.tank;
    tank.currentLevelLiters = supply.previousLevel;
    tank.currentLevelPercentage = (supply.previousLevel / tank.capacityLiters) * 100;
    await this.tankRepository.save(tank);

    supply.status = SupplyStatus.CANCELLED;
    supply.notes = (supply.notes || '') + `\nCancelado por usuario ${userId}`;

    return this.supplyRepository.save(supply);
  }
}