import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  Query,
} from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../entities/user.entity';

@Controller('alerts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get()
  getAlerts(@CurrentUser() user: User) {
    return this.alertsService.getAlerts(user.id, user.role);
  }

  @Get('active')
  getActiveAlerts(@Query('tankId') tankId?: string) {
    return this.alertsService.getActiveAlerts(tankId);
  }

  @Patch(':id/acknowledge')
  acknowledgeAlert(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ) {
    return this.alertsService.acknowledgeAlert(id, user.id);
  }

  @Patch(':id/resolve')
  resolveAlert(
    @Param('id') id: string,
    @Body('notes') notes: string,
    @CurrentUser() user: User,
  ) {
    return this.alertsService.resolveAlert(id, user.id, notes);
  }
}