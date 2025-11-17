import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  Patch,
} from '@nestjs/common';
import { SensorSimulatorService } from './sensor-simulator.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../entities/user.entity';

class SimulateConsumptionDto {
  litersConsumed: number;
}

class SimulateRefillDto {
  litersAdded?: number;
}

class SetConsumptionRateDto {
  ratePerHour: number;
}

@Controller('sensors')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SensorsController {
  constructor(private readonly sensorSimulator: SensorSimulatorService) {}

  @Post('simulate/:tankId/start')
  @Roles(UserRole.ADMIN)
  startSimulation(@Param('tankId') tankId: string) {
    this.sensorSimulator.startSimulation(tankId);
    return {
      message: 'Simulación iniciada',
      tankId,
      status: this.sensorSimulator.getSimulationStatus(tankId)
    };
  }

  @Post('simulate/:tankId/stop')
  @Roles(UserRole.ADMIN)
  stopSimulation(@Param('tankId') tankId: string) {
    this.sensorSimulator.stopSimulation(tankId);
    return { message: 'Simulación detenida', tankId };
  }

  @Get('simulate/:tankId/status')
  getSimulationStatus(@Param('tankId') tankId: string) {
    return this.sensorSimulator.getSimulationStatus(tankId);
  }

  @Post('simulate/:tankId/consume')
  @Roles(UserRole.ADMIN)
  async simulateConsumption(
    @Param('tankId') tankId: string,
    @Body() dto: SimulateConsumptionDto,
  ) {
    return this.sensorSimulator.simulateConsumption(tankId, dto.litersConsumed);
  }

  @Post('simulate/:tankId/refill')
  @Roles(UserRole.ADMIN)
  async simulateRefill(
    @Param('tankId') tankId: string,
    @Body() dto: SimulateRefillDto,
  ) {
    return this.sensorSimulator.simulateRefill(tankId, dto.litersAdded);
  }

  @Patch('simulate/:tankId/consumption-rate')
  @Roles(UserRole.ADMIN)
  setConsumptionRate(
    @Param('tankId') tankId: string,
    @Body() dto: SetConsumptionRateDto,
  ) {
    this.sensorSimulator.setConsumptionRate(tankId, dto.ratePerHour);
    return {
      message: 'Tasa de consumo actualizada',
      tankId,
      newRate: dto.ratePerHour
    };
  }

  @Post('simulate/start-all')
  @Roles(UserRole.ADMIN)
  async startAllSimulations() {
    await this.sensorSimulator.startAllSimulations();
    return { message: 'Todas las simulaciones iniciadas' };
  }

  @Post('simulate/stop-all')
  @Roles(UserRole.ADMIN)
  stopAllSimulations() {
    this.sensorSimulator.stopAllSimulations();
    return { message: 'Todas las simulaciones detenidas' };
  }
}