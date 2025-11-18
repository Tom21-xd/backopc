import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SensorsController } from './sensors.controller';
import { SensorSimulatorService } from './sensor-simulator.service';
import { Tank } from '../../entities/tank.entity';
import { Sensor } from '../../entities/sensor.entity';
import { TanksModule } from '../tanks/tanks.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tank, Sensor]),
    forwardRef(() => TanksModule),
  ],
  controllers: [SensorsController],
  providers: [SensorSimulatorService],
  exports: [SensorSimulatorService],
})
export class SensorsModule {}