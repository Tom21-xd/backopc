import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { TanksService } from './tanks.service';
import { CreateTankDto } from './dto/create-tank.dto';
import { UpdateTankDto } from './dto/update-tank.dto';
import { UpdateSensorDto } from './dto/update-sensor.dto';
import { AssignClientDto } from './dto/assign-client.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User, UserRole } from '../../entities/user.entity';

@Controller('tanks')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TanksController {
  constructor(private readonly tanksService: TanksService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() createTankDto: CreateTankDto) {
    return this.tanksService.create(createTankDto);
  }

  @Get()
  findAll(@CurrentUser() user: User) {
    return this.tanksService.findAll(user.id, user.role);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: User) {
    return this.tanksService.findOne(id, user.id, user.role);
  }

  @Get(':id/history')
  getTankHistory(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    // Verificar acceso al tanque primero
    this.tanksService.findOne(id, user.id, user.role);

    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    return this.tanksService.getTankHistory(id, start, end);
  }

  @Get('company/all')
  getCompanyTanks() {
    return this.tanksService.getCompanyTanks();
  }

  @Get('company/main')
  getCompanyTankWithMostGas() {
    return this.tanksService.getCompanyTankWithMostGas();
  }

  @Get('client/:clientId')
  @Roles(UserRole.ADMIN)
  getTanksByClient(@Param('clientId') clientId: string) {
    return this.tanksService.getTanksByClient(clientId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateTankDto: UpdateTankDto,
    @CurrentUser() user: User,
  ) {
    // Solo admins pueden actualizar tanques
    if (user.role !== UserRole.ADMIN) {
      throw new Error('Solo los administradores pueden actualizar tanques');
    }
    return this.tanksService.update(id, updateTankDto, user.id, user.role);
  }

  @Patch(':id/sensor')
  @Roles(UserRole.ADMIN)
  updateSensor(
    @Param('id') id: string,
    @Body() updateSensorDto: UpdateSensorDto,
  ) {
    return this.tanksService.updateSensor(id, updateSensorDto);
  }

  @Patch(':id/assign-client')
  @Roles(UserRole.ADMIN)
  assignClient(
    @Param('id') id: string,
    @Body() assignClientDto: AssignClientDto,
  ) {
    return this.tanksService.assignClient(id, assignClientDto.clientId);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@Param('id') id: string) {
    return this.tanksService.remove(id);
  }
}