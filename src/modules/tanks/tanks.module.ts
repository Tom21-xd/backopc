import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TanksService } from './tanks.service';
import { TanksController } from './tanks.controller';
import { Tank } from '../../entities/tank.entity';
import { Sensor } from '../../entities/sensor.entity';
import { User } from '../../entities/user.entity';
import { MonitoringHistory } from '../../entities/monitoring-history.entity';
import { SensorsModule } from '../sensors/sensors.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tank, Sensor, User, MonitoringHistory]),
    forwardRef(() => SensorsModule),
  ],
  controllers: [TanksController],
  providers: [TanksService],
  exports: [TanksService],
})
export class TanksModule {}