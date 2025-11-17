import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SuppliesService } from './supplies.service';
import { SuppliesController } from './supplies.controller';
import { Supply } from '../../entities/supply.entity';
import { Tank } from '../../entities/tank.entity';
import { TanksModule } from '../tanks/tanks.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Supply, Tank]),
    TanksModule,
  ],
  controllers: [SuppliesController],
  providers: [SuppliesService],
  exports: [SuppliesService],
})
export class SuppliesModule {}