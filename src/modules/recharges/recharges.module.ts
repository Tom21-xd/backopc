import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RechargesService } from './recharges.service';
import { RechargesController } from './recharges.controller';
import { Recharge } from '../../entities/recharge.entity';
import { Tank } from '../../entities/tank.entity';
import { Supply } from '../../entities/supply.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Recharge, Tank, Supply])],
  controllers: [RechargesController],
  providers: [RechargesService],
  exports: [RechargesService],
})
export class RechargesModule {}