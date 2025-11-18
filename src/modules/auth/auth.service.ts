import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from '../../entities/user.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AdminCreateUserDto } from './dto/admin-create-user.dto';
import { JwtPayload } from './strategies/jwt.strategy';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto) {
    const {
      email,
      password,
      firstName,
      lastName,
      phone,
      companyName,
      address,
      identificationType,
      identificationNumber
    } = registerDto;

    // Verificar si el usuario ya existe
    const existingUser = await this.userRepository.findOne({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('El email ya está registrado');
    }

    // Verificar si el número de identificación ya existe
    const existingUserByIdentification = await this.userRepository.findOne({
      where: { identificationNumber },
    });

    if (existingUserByIdentification) {
      throw new ConflictException('El número de identificación ya está registrado');
    }

    // Crear el usuario (siempre como CLIENT)
    const user = this.userRepository.create({
      email,
      password,
      firstName,
      lastName,
      phone,
      identificationType,
      identificationNumber,
      company: companyName,
      address,
      role: UserRole.CLIENT, // Siempre CLIENT en el registro
      isActive: true,
    });

    await this.userRepository.save(user);

    // Generar token JWT
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        phone: user.phone,
      },
      message: 'Registro exitoso',
    };
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    // Buscar el usuario por email
    const user = await this.userRepository.findOne({
      where: { email, isActive: true },
      relations: ['tanks'],
    });

    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Verificar la contraseña
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Generar el token JWT
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload);

    // Retornar la información del usuario y el token
    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        phone: user.phone,
        tanks: user.tanks?.map(tank => ({
          id: tank.id,
          code: tank.code,
          status: tank.status,
          currentLevelPercentage: tank.currentLevelPercentage,
        })),
      },
      message: 'Inicio de sesión exitoso',
    };
  }

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.userRepository.findOne({
      where: { email, isActive: true },
    });

    if (user && (await user.comparePassword(password))) {
      return user;
    }

    return null;
  }

  async getProfile(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['tanks', 'tanks.sensor'],
    });

    if (!user) {
      throw new BadRequestException('Usuario no encontrado');
    }

    const { password, ...result } = user;
    return result;
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('Usuario no encontrado');
    }

    const isPasswordValid = await user.comparePassword(currentPassword);

    if (!isPasswordValid) {
      throw new UnauthorizedException('La contraseña actual es incorrecta');
    }

    user.password = newPassword;
    await this.userRepository.save(user);

    return { message: 'Contraseña actualizada exitosamente' };
  }

  async adminCreateUser(createUserDto: AdminCreateUserDto, adminId: string) {
    const {
      email,
      password,
      name,
      role = UserRole.CLIENT,
      companyName,
      identificationType,
      identificationNumber,
      address,
      phone,
    } = createUserDto;

    // Verificar si el email ya existe
    const existingUser = await this.userRepository.findOne({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('El correo electrónico ya está registrado');
    }

    // Verificar si el número de identificación ya existe
    const existingUserByIdentification = await this.userRepository.findOne({
      where: { identificationNumber },
    });

    if (existingUserByIdentification) {
      throw new ConflictException('El número de identificación ya está registrado');
    }

    // Separar el nombre en firstName y lastName
    const nameParts = name.trim().split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || nameParts[0];

    // Crear el nuevo usuario (siempre como CLIENT por defecto)
    const user = this.userRepository.create({
      email,
      password,
      firstName,
      lastName,
      role: UserRole.CLIENT, // Siempre CLIENT para usuarios creados por admin
      phone,
      isActive: true,
    });

    await this.userRepository.save(user);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        role: user.role,
        company: user.company,
        identificationType: user.identificationType,
        identificationNumber: user.identificationNumber,
      },
      message: 'Usuario cliente creado exitosamente por el administrador',
    };
  }
}