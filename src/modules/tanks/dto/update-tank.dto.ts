import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateTankDto } from './create-tank.dto';
import { IsEnum, IsOptional } from 'class-validator';
import { TankStatus } from '../../../entities/tank.entity';

export class UpdateTankDto extends PartialType(
  OmitType(CreateTankDto, ['code', 'clientId'] as const),
) {
  @IsEnum(TankStatus)
  @IsOptional()
  status?: TankStatus;
}