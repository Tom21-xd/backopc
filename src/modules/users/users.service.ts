import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, In, Between } from 'typeorm';
import { User, UserRole } from '../../entities/user.entity';
import { Tank } from '../../entities/tank.entity';
import { Alert } from '../../entities/alert.entity';
import { Recharge } from '../../entities/recharge.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';
import { UpdateNotificationSettingsDto } from './dto/update-notification-settings.dto';
import * as bcrypt from 'bcrypt';

interface PaginationOptions {
  page: number;
  limit: number;
  role?: UserRole;
  active?: boolean;
  search?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Tank)
    private tankRepository: Repository<Tank>,
    @InjectRepository(Alert)
    private alertRepository: Repository<Alert>,
    @InjectRepository(Recharge)
    private rechargeRepository: Repository<Recharge>,
  ) {}

  // CREAR USUARIO
  async create(createUserDto: CreateUserDto): Promise<Omit<User, 'password'>> {
    // Verificar si el email ya existe
    const existingUser = await this.userRepository.findOne({
      where: { email: createUserDto.email },
    });

    if (existingUser) {
      throw new ConflictException('El correo electrónico ya está registrado');
    }

    const user = this.userRepository.create({
      ...createUserDto,
    });

    const savedUser = await this.userRepository.save(user);
    const { password, ...result } = savedUser;
    return result as Omit<User, 'password'>;
  }

  // CREAR MÚLTIPLES USUARIOS
  async createBatch(users: CreateUserDto[]): Promise<User[]> {
    const createdUsers = [];

    for (const userDto of users) {
      try {
        const user = await this.create(userDto);
        createdUsers.push(user);
      } catch (error) {
        createdUsers.push({
          error: true,
          email: userDto.email,
          message: error.message,
        });
      }
    }

    return createdUsers;
  }

  // OBTENER TODOS LOS USUARIOS CON PAGINACIÓN
  async findAllPaginated(options: PaginationOptions) {
    const {
      page,
      limit,
      role,
      active,
      search,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = options;

    const query = this.userRepository.createQueryBuilder('user');

    // Filtros
    if (role) {
      query.andWhere('user.role = :role', { role });
    }

    if (active !== undefined) {
      query.andWhere('user.isActive = :active', { active });
    }

    if (search) {
      query.andWhere(
        '(user.firstName LIKE :search OR user.lastName LIKE :search OR user.email LIKE :search)',
        { search: `%${search}%` },
      );
    }

    // Ordenamiento
    query.orderBy(`user.${sortBy}`, sortOrder);

    // Paginación
    const skip = (page - 1) * limit;
    query.skip(skip).take(limit);

    const [users, total] = await query.getManyAndCount();

    return {
      data: users.map(user => {
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword;
      }),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // OBTENER ESTADÍSTICAS DE USUARIOS
  async getUsersStatistics() {
    const [
      totalUsers,
      activeUsers,
      totalClients,
      totalAdmins,
      newUsersThisMonth,
    ] = await Promise.all([
      this.userRepository.count(),
      this.userRepository.count({ where: { isActive: true } }),
      this.userRepository.count({ where: { role: UserRole.CLIENT } }),
      this.userRepository.count({ where: { role: UserRole.ADMIN } }),
      this.userRepository.count({
        where: {
          createdAt: Between(
            new Date(new Date().getFullYear(), new Date().getMonth(), 1),
            new Date(),
          ),
        },
      }),
    ]);

    return {
      totalUsers,
      activeUsers,
      inactiveUsers: totalUsers - activeUsers,
      totalClients,
      totalAdmins,
      newUsersThisMonth,
    };
  }

  // OBTENER TODOS LOS USUARIOS
  async findAll(role?: UserRole): Promise<User[]> {
    const query = this.userRepository.createQueryBuilder('user');

    if (role) {
      query.where('user.role = :role', { role });
    }

    const users = await query.getMany();
    return users.map(user => {
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword as User;
    });
  }

  // OBTENER CLIENTES
  async getClients(active?: boolean, withTanks?: boolean): Promise<User[]> {
    const query = this.userRepository.createQueryBuilder('user')
      .where('user.role = :role', { role: UserRole.CLIENT });

    if (active !== undefined) {
      query.andWhere('user.isActive = :active', { active });
    }

    if (withTanks) {
      query.leftJoinAndSelect('user.tanks', 'tanks');
    }

    const users = await query.getMany();
    return users.map(user => {
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword as User;
    });
  }

  // OBTENER EMPLEADOS
  async getEmployees(active?: boolean): Promise<User[]> {
    const query = this.userRepository.createQueryBuilder('user')
      .where('user.role = :role', { role: UserRole.ADMIN });

    if (active !== undefined) {
      query.andWhere('user.isActive = :active', { active });
    }

    const users = await query.getMany();
    return users.map(user => {
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword as User;
    });
  }

  // BUSCAR USUARIOS
  async searchUsers(query: string): Promise<User[]> {
    const users = await this.userRepository.find({
      where: [
        { firstName: Like(`%${query}%`) },
        { lastName: Like(`%${query}%`) },
        { email: Like(`%${query}%`) },
      ],
      relations: ['client'],
    });

    return users.map(user => {
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword as User;
    });
  }

  // OBTENER PERFIL DE USUARIO
  async getUserProfile(id: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: ['client', 'client.tanks'],
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword as User;
  }

  // ACTUALIZAR PERFIL
  async updateProfile(id: string, updateDto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);

    // UpdateUserDto ya no incluye role, email o password debido al OmitType
    // Por lo tanto, no necesitamos eliminar estas propiedades

    Object.assign(user, updateDto);
    const updatedUser = await this.userRepository.save(user);
    const { password, ...result } = updatedUser;
    return result as User;
  }

  // OBTENER USUARIO POR ID
  async findOne(id: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: ['client'],
    });

    if (!user) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }

    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword as User;
  }

  // OBTENER USUARIO POR EMAIL
  async findByEmail(email: string): Promise<User | null> {
    const user = await this.userRepository.findOne({
      where: { email },
      relations: ['client'],
    });
    return user;
  }

  // ACTUALIZAR USUARIO
  async update(id: string, updateUserDto: AdminUpdateUserDto): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }

    // Si se proporciona una nueva contraseña, hashearla
    if (updateUserDto.password) {
      updateUserDto.password = await bcrypt.hash(updateUserDto.password, 10);
    }

    Object.assign(user, updateUserDto);
    const updatedUser = await this.userRepository.save(user);
    const { password, ...result } = updatedUser;
    return result as User;
  }

  // ACTUALIZAR USUARIO COMPLETO
  async updateComplete(id: string, updateUserDto: AdminUpdateUserDto): Promise<User> {
    return this.update(id, updateUserDto);
  }

  // CAMBIAR ROL DE USUARIO
  async changeUserRole(id: string, role: UserRole): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }

    user.role = role;
    const updatedUser = await this.userRepository.save(user);
    const { password, ...result } = updatedUser;
    return result as User;
  }

  // ACTIVAR/DESACTIVAR USUARIO
  async toggleUserStatus(id: string, active: boolean): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }

    user.isActive = active;
    const updatedUser = await this.userRepository.save(user);
    const { password, ...result } = updatedUser;
    return result as User;
  }

  // RESETEAR CONTRASEÑA
  async resetUserPassword(id: string): Promise<{ temporaryPassword: string }> {
    const user = await this.userRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }

    // Generar contraseña temporal
    const temporaryPassword = Math.random().toString(36).slice(-8);
    user.password = await bcrypt.hash(temporaryPassword, 10);

    await this.userRepository.save(user);

    return {
      temporaryPassword,
      message: 'Contraseña reseteada exitosamente',
    } as any;
  }


  // ACTUALIZAR CONFIGURACIÓN DE NOTIFICACIONES
  async updateNotificationSettings(
    userId: string,
    currentUserId: string,
    currentUserRole: UserRole,
    updateDto: UpdateNotificationSettingsDto,
  ): Promise<Omit<User, 'password'>> {
    // Solo admin puede actualizar configuración de otros usuarios
    if (currentUserRole !== UserRole.ADMIN && userId !== currentUserId) {
      throw new ForbiddenException(
        'No tienes permisos para actualizar la configuración de este usuario',
      );
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException(`Usuario con ID ${userId} no encontrado`);
    }

    const updatedUser = await this.userRepository.save(user);
    const { password, ...result } = updatedUser;
    return result as Omit<User, 'password'>;
  }

  // OBTENER ACTIVIDAD DEL USUARIO
  async getUserActivity(
    userId: string,
    startDate?: Date,
    endDate?: Date,
  ) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['client'],
    });

    if (!user) {
      throw new NotFoundException(`Usuario con ID ${userId} no encontrado`);
    }

    // Aquí podrías implementar un sistema de logs de actividad
    // Por ahora, retornamos información básica
    return {
      user: {
        id: user.id,
        email: user.email,
        nombre: `${user.firstName} ${user.lastName}`,
      },
      ultimoAcceso: user.updatedAt,
      actividades: [], // Aquí irían los logs de actividad
    };
  }

  // OBTENER TANQUES DEL USUARIO
  async getUserTanks(userId: string): Promise<Tank[]> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['tanks'],
    });

    if (!user) {
      throw new NotFoundException(`Usuario con ID ${userId} no encontrado`);
    }

    return user.tanks || [];
  }

  // OBTENER ALERTAS DEL USUARIO
  async getUserAlerts(userId: string, active?: boolean): Promise<Alert[]> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['tanks'],
    });

    if (!user) {
      throw new NotFoundException(`Usuario con ID ${userId} no encontrado`);
    }

    const tanks = await this.tankRepository.find({
      where: { client: { id: user.id } },
    });

    const tankIds = tanks.map(t => t.id);

    if (tankIds.length === 0) {
      return [];
    }

    const query = this.alertRepository.createQueryBuilder('alert')
      .leftJoinAndSelect('alert.tank', 'tank')
      .where('alert.tank.id IN (:...tankIds)', { tankIds });

    if (active !== undefined) {
      query.andWhere('alert.status = :status', { status: active ? 'active' : 'resolved' });
    }

    return query.getMany();
  }

  // OBTENER RECARGAS DEL USUARIO
  async getUserRecharges(userId: string, status?: string): Promise<Recharge[]> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['tanks'],
    });

    if (!user) {
      throw new NotFoundException(`Usuario con ID ${userId} no encontrado`);
    }

    const tanks = await this.tankRepository.find({
      where: { client: { id: user.id } },
    });

    const tankIds = tanks.map(t => t.id);

    if (tankIds.length === 0) {
      return [];
    }

    const query = this.rechargeRepository.createQueryBuilder('recharge')
      .leftJoinAndSelect('recharge.tank', 'tank')
      .where('recharge.tank.id IN (:...tankIds)', { tankIds });

    if (status) {
      query.andWhere('recharge.status = :status', { status });
    }

    return query.getMany();
  }

  // VERIFICAR DISPONIBILIDAD DE EMAIL
  async checkEmailAvailability(email: string): Promise<{ available: boolean }> {
    const user = await this.userRepository.findOne({
      where: { email },
    });

    return {
      available: !user,
    };
  }

  // ELIMINAR USUARIO (SOFT DELETE)
  async remove(id: string): Promise<{ message: string; tanksReleased: number }> {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: ['tanks']
    });

    if (!user) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }

    // Desactivar usuario
    user.isActive = false;
    await this.userRepository.save(user);

    // Liberar tanques asignados al usuario
    if (user.tanks && user.tanks.length > 0) {
      for (const tank of user.tanks) {
        tank.client = null;
        // Opcionalmente, cambiar el estado del tanque a INACTIVE
        // tank.status = TankStatus.INACTIVE;
        await this.tankRepository.save(tank);
      }
    }

    return {
      message: 'Usuario desactivado exitosamente',
      tanksReleased: user.tanks?.length || 0
    };
  }

  // ELIMINAR USUARIO PERMANENTEMENTE
  async removePermanent(id: string): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }

    await this.userRepository.remove(user);

    return { message: 'Usuario eliminado permanentemente' };
  }

  // RESTAURAR USUARIO
  async restore(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }

    user.isActive = true;
    const restoredUser = await this.userRepository.save(user);
    const { password, ...result } = restoredUser;
    return result as User;
  }

  // EXPORTAR USUARIOS A CSV
  async exportUsersCSV(role?: UserRole): Promise<string> {
    const users = await this.findAll(role);

    const headers = ['ID', 'Nombre', 'Apellido', 'Email', 'Rol', 'Activo', 'Fecha Creación'];
    const rows = users.map(user => [
      user.id,
      user.firstName,
      user.lastName,
      user.email,
      user.role,
      user.isActive ? 'Sí' : 'No',
      user.createdAt.toISOString(),
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.join(',')),
    ].join('\n');

    return csv;
  }

  // IMPORTAR USUARIOS DESDE CSV
  async importUsersCSV(data: any): Promise<{ imported: number; failed: number }> {
    // Implementación simplificada - necesitaría parsear el CSV real
    let imported = 0;
    let failed = 0;

    // Aquí procesarías el CSV y crearías los usuarios

    return { imported, failed };
  }
}