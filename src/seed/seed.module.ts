import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeedService } from './seed.service';
import { User } from '../entities/user.entity';
import { Client } from '../entities/client.entity';
import { Tank } from '../entities/tank.entity';
import { Sensor } from '../entities/sensor.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Client, Tank, Sensor])],
  providers: [SeedService],
  exports: [SeedService],
})
export class SeedModule {}