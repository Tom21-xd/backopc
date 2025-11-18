import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from '../../entities/user.entity';
import { Tank } from '../../entities/tank.entity';
import { Alert } from '../../entities/alert.entity';
import { Recharge } from '../../entities/recharge.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Tank,
      Alert,
      Recharge,
    ]),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}