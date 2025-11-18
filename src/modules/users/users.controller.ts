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
  Put,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';
import { UpdateNotificationSettingsDto } from './dto/update-notification-settings.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User, UserRole } from '../../entities/user.entity';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // CRUD COMPLETO PARA ADMIN

  // Crear nuevo usuario (solo admin)
  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  // Crear múltiples usuarios (batch)
  @Post('batch')
  @Roles(UserRole.ADMIN)
  createBatch(@Body() users: CreateUserDto[]) {
    return this.usersService.createBatch(users);
  }

  // Obtener todos los usuarios con filtros y paginación
  @Get()
  @Roles(UserRole.ADMIN)
  findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('role') role?: UserRole,
    @Query('active') active?: boolean,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'ASC' | 'DESC',
  ) {
    return this.usersService.findAllPaginated({
      page: page || 1,
      limit: limit || 10,
      role,
      active,
      search,
      sortBy: sortBy || 'createdAt',
      sortOrder: sortOrder || 'DESC',
    });
  }

  // Obtener estadísticas de usuarios
  @Get('stats')
  @Roles(UserRole.ADMIN)
  getUsersStats() {
    return this.usersService.getUsersStatistics();
  }

  // Obtener todos los clientes
  @Get('clients')
  @Roles(UserRole.ADMIN)
  getClients(
    @Query('active') active?: boolean,
    @Query('withTanks') withTanks?: boolean,
  ) {
    return this.usersService.getClients(active, withTanks);
  }

  // Obtener todos los empleados/admin
  @Get('employees')
  @Roles(UserRole.ADMIN)
  getEmployees(@Query('active') active?: boolean) {
    return this.usersService.getEmployees(active);
  }

  // Buscar usuarios
  @Get('search')
  @Roles(UserRole.ADMIN)
  searchUsers(@Query('q') query: string) {
    return this.usersService.searchUsers(query);
  }

  // Obtener perfil propio
  @Get('profile')
  getMyProfile(@CurrentUser() user: User) {
    return this.usersService.getUserProfile(user.id);
  }

  // Actualizar perfil propio
  @Patch('profile')
  updateMyProfile(
    @CurrentUser() user: User,
    @Body() updateDto: UpdateUserDto,
  ) {
    return this.usersService.updateProfile(user.id, updateDto);
  }

  // Obtener usuario por ID
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: User) {
    // Los clientes solo pueden ver su propia información
    if (user.role === UserRole.CLIENT && user.id !== id) {
      return this.usersService.findOne(user.id);
    }
    return this.usersService.findOne(id);
  }

  // Actualizar usuario (solo admin)
  @Patch(':id')
  @Roles(UserRole.ADMIN)
  update(@Param('id') id: string, @Body() updateUserDto: AdminUpdateUserDto) {
    return this.usersService.update(id, updateUserDto);
  }

  // Actualizar usuario completo (solo admin)
  @Put(':id')
  @Roles(UserRole.ADMIN)
  updateComplete(@Param('id') id: string, @Body() updateUserDto: AdminUpdateUserDto) {
    return this.usersService.updateComplete(id, updateUserDto);
  }

  // Actualizar configuración de notificaciones
  @Patch(':id/notification-settings')
  updateNotificationSettings(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() updateDto: UpdateNotificationSettingsDto,
  ) {
    return this.usersService.updateNotificationSettings(
      id,
      user.id,
      user.role,
      updateDto,
    );
  }

  // Cambiar rol de usuario (solo admin)
  @Patch(':id/role')
  @Roles(UserRole.ADMIN)
  changeUserRole(
    @Param('id') id: string,
    @Body('role') role: UserRole,
  ) {
    return this.usersService.changeUserRole(id, role);
  }

  // Activar/Desactivar usuario (solo admin)
  @Patch(':id/status')
  @Roles(UserRole.ADMIN)
  toggleUserStatus(
    @Param('id') id: string,
    @Body('active') active: boolean,
  ) {
    return this.usersService.toggleUserStatus(id, active);
  }

  // Resetear contraseña de usuario (solo admin)
  @Post(':id/reset-password')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  resetUserPassword(@Param('id') id: string) {
    return this.usersService.resetUserPassword(id);
  }


  // Obtener historial de actividad del usuario (solo admin)
  @Get(':id/activity')
  @Roles(UserRole.ADMIN)
  getUserActivity(
    @Param('id') id: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.usersService.getUserActivity(
      id,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  // Obtener tanques asociados al usuario
  @Get(':id/tanks')
  getUserTanks(@Param('id') id: string, @CurrentUser() user: User) {
    // Verificar permisos
    if (user.role === UserRole.CLIENT && user.id !== id) {
      return this.usersService.getUserTanks(user.id);
    }
    return this.usersService.getUserTanks(id);
  }

  // Obtener alertas del usuario
  @Get(':id/alerts')
  getUserAlerts(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Query('active') active?: boolean,
  ) {
    // Verificar permisos
    if (user.role === UserRole.CLIENT && user.id !== id) {
      return this.usersService.getUserAlerts(user.id, active);
    }
    return this.usersService.getUserAlerts(id, active);
  }

  // Obtener recargas del usuario
  @Get(':id/recharges')
  getUserRecharges(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Query('status') status?: string,
  ) {
    // Verificar permisos
    if (user.role === UserRole.CLIENT && user.id !== id) {
      return this.usersService.getUserRecharges(user.id, status);
    }
    return this.usersService.getUserRecharges(id, status);
  }

  // Verificar email disponible
  @Get('check/email/:email')
  @Roles(UserRole.ADMIN)
  checkEmailAvailability(@Param('email') email: string) {
    return this.usersService.checkEmailAvailability(email);
  }

  // Eliminar usuario (soft delete - solo admin)
  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }

  // Eliminar usuario permanentemente (solo admin)
  @Delete(':id/permanent')
  @Roles(UserRole.ADMIN)
  removePermanent(@Param('id') id: string) {
    return this.usersService.removePermanent(id);
  }

  // Restaurar usuario eliminado (solo admin)
  @Post(':id/restore')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  restore(@Param('id') id: string) {
    return this.usersService.restore(id);
  }

  // Exportar usuarios (solo admin)
  @Get('export/csv')
  @Roles(UserRole.ADMIN)
  exportUsersCSV(@Query('role') role?: UserRole) {
    return this.usersService.exportUsersCSV(role);
  }

  // Importar usuarios desde CSV (solo admin)
  @Post('import/csv')
  @Roles(UserRole.ADMIN)
  importUsersCSV(@Body() data: any) {
    return this.usersService.importUsersCSV(data);
  }
}