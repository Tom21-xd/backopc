import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { SensorsController } from './sensors.controller';
import { SensorSimulatorService } from './sensor-simulator.service';
import { Tank } from '../../entities/tank.entity';
import { Sensor } from '../../entities/sensor.entity';
import { TanksModule } from '../tanks/tanks.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tank, Sensor]),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    forwardRef(() => TanksModule),
  ],
  controllers: [SensorsController],
  providers: [SensorSimulatorService],
  exports: [SensorSimulatorService],
})
export class SensorsModule {}