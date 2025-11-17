import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { SuppliesService } from './supplies.service';
import { CreateSupplyDto } from './dto/create-supply.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User, UserRole } from '../../entities/user.entity';

@Controller('supplies')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SuppliesController {
  constructor(private readonly suppliesService: SuppliesService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  create(
    @Body() createSupplyDto: CreateSupplyDto,
    @CurrentUser() user: User,
  ) {
    return this.suppliesService.create(createSupplyDto, user);
  }

  @Get()
  findAll(
    @CurrentUser() user: User,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    return this.suppliesService.findAll(user.id, user.role, start, end);
  }

  @Get('statistics')
  @Roles(UserRole.ADMIN)
  getStatistics(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    return this.suppliesService.getStatistics(start, end);
  }

  @Get('tank/:tankId')
  getByTank(@Param('tankId') tankId: string) {
    return this.suppliesService.getByTank(tankId);
  }

  @Get('employee/:employeeId')
  @Roles(UserRole.ADMIN)
  getByEmployee(@Param('employeeId') employeeId: string) {
    return this.suppliesService.getByEmployee(employeeId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.suppliesService.findOne(id);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  cancel(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ) {
    return this.suppliesService.cancelSupply(id, user.id);
  }
}