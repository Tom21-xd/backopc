import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { RechargesService } from './recharges.service';
import { CreateRechargeDto } from './dto/create-recharge.dto';
import { RescheduleRechargeDto } from './dto/reschedule-recharge.dto';
import { CompleteRechargeDto } from './dto/complete-recharge.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User, UserRole } from '../../entities/user.entity';
import { RechargeStatus } from '../../entities/recharge.entity';

@Controller('recharges')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RechargesController {
  constructor(private readonly rechargesService: RechargesService) {}

  @Post()
  create(
    @Body() createRechargeDto: CreateRechargeDto,
    @CurrentUser() user: User,
  ) {
    return this.rechargesService.create(createRechargeDto, user);
  }

  @Get()
  findAll(
    @CurrentUser() user: User,
    @Query('status') status?: RechargeStatus,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    return this.rechargesService.findAll(
      user.id,
      user.role,
      status,
      start,
      end,
    );
  }

  @Get('upcoming')
  getUpcoming(@Query('days') days?: string) {
    const daysNumber = days ? parseInt(days) : 7;
    return this.rechargesService.getUpcoming(daysNumber);
  }

  @Get('tank/:tankId')
  getByTank(
    @Param('tankId') tankId: string,
    @CurrentUser() user: User,
  ) {
    // Verificar permisos se hace en el servicio
    return this.rechargesService.getByTank(tankId);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ) {
    return this.rechargesService.findOne(id, user.id, user.role);
  }

  @Patch(':id/reschedule')
  reschedule(
    @Param('id') id: string,
    @Body() rescheduleDto: RescheduleRechargeDto,
    @CurrentUser() user: User,
  ) {
    return this.rechargesService.reschedule(
      id,
      rescheduleDto,
      user.id,
      user.role,
    );
  }

  @Patch(':id/start')
  @Roles(UserRole.ADMIN)
  startRecharge(@Param('id') id: string) {
    return this.rechargesService.startRecharge(id);
  }

  @Patch(':id/complete')
  @Roles(UserRole.ADMIN)
  complete(
    @Param('id') id: string,
    @Body() completeDto: CompleteRechargeDto,
    @CurrentUser() user: User,
  ) {
    return this.rechargesService.complete(id, completeDto, user.id);
  }

  @Delete(':id')
  cancel(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @CurrentUser() user: User,
  ) {
    return this.rechargesService.cancel(id, reason, user.id, user.role);
  }
}