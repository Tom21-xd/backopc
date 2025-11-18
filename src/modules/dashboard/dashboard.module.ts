import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { Tank } from '../../entities/tank.entity';
import { Alert } from '../../entities/alert.entity';
import { Recharge } from '../../entities/recharge.entity';
import { Supply } from '../../entities/supply.entity';
import { MonitoringHistory } from '../../entities/monitoring-history.entity';
import { User } from '../../entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Tank,
      Alert,
      Recharge,
      Supply,
      MonitoringHistory,
      User,
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}