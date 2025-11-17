import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from '../entities/user.entity';
import { Client, IdentificationType } from '../entities/client.entity';
import { Tank, TankStatus, TankType } from '../entities/tank.entity';
import { Sensor, SensorStatus } from '../entities/sensor.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class SeedService {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Client)
    private clientRepository: Repository<Client>,
    @InjectRepository(Tank)
    private tankRepository: Repository<Tank>,
    @InjectRepository(Sensor)
    private sensorRepository: Repository<Sensor>,
  ) {}

  async seed() {
    await this.seedUsers();
    await this.seedTanks();
    this.logger.log('Seed de datos completado');
  }

  private async seedUsers() {
    const existingAdmin = await this.userRepository.findOne({
      where: { email: 'admin@gasmonitoring.com' },
    });

    if (!existingAdmin) {
      const admin = this.userRepository.create({
        email: 'admin@gasmonitoring.com',
        password: await bcrypt.hash('admin123', 10),
        firstName: 'Admin',
        lastName: 'Sistema',
        phone: '+52 1234567890',
        role: UserRole.ADMIN,
        isActive: true,
      });

      await this.userRepository.save(admin);
      this.logger.log('Usuario admin creado');
    }

    // Crear algunos clientes de prueba
    const clientsData = [
      {
        email: 'cliente1@example.com',
        password: 'cliente123',
        firstName: 'Juan',
        lastName: 'Pérez',
        phone: '+52 9876543210',
      },
      {
        email: 'cliente2@example.com',
        password: 'cliente123',
        firstName: 'María',
        lastName: 'González',
        phone: '+52 5551234567',
      },
      {
        email: 'cliente3@example.com',
        password: 'cliente123',
        firstName: 'Carlos',
        lastName: 'Rodríguez',
        phone: '+52 5559876543',
      }
    ];

    for (const clientData of clientsData) {
      const existing = await this.userRepository.findOne({
        where: { email: clientData.email },
      });

      if (!existing) {
        const client = this.userRepository.create({
          ...clientData,
          password: await bcrypt.hash(clientData.password, 10),
          role: UserRole.CLIENT,
          isActive: true,
        });

        await this.userRepository.save(client);
        this.logger.log(`Cliente ${clientData.email} creado`);
      }
    }

    // Crear un empleado adicional
    const existingEmployee = await this.userRepository.findOne({
      where: { email: 'empleado@gasmonitoring.com' },
    });

    if (!existingEmployee) {
      const employee = this.userRepository.create({
        email: 'empleado@gasmonitoring.com',
        password: await bcrypt.hash('empleado123', 10),
        firstName: 'Pedro',
        lastName: 'Empleado',
        phone: '+52 5551112222',
        role: UserRole.ADMIN,
        isActive: true,
      });

      await this.userRepository.save(employee);
      this.logger.log('Usuario empleado creado');
    }
  }

  private async seedTanks() {
    // Primero crear el tanque principal de la empresa
    const existingCompanyTank = await this.tankRepository.findOne({
      where: { type: TankType.COMPANY },
    });

    if (!existingCompanyTank) {
      // Crear sensor para el tanque principal
      const companySensor = this.sensorRepository.create({
        serialNumber: `SENSOR-COMPANY-${Date.now()}`,
        status: SensorStatus.ACTIVE,
        lastReading: 80,
        lastReadingDate: new Date(),
      });

      const savedCompanySensor = await this.sensorRepository.save(companySensor);

      const companyTank = this.tankRepository.create({
        code: 'TK-MAIN',
        type: TankType.COMPANY,
        capacityLiters: 10000, // Tanque principal de 10,000 litros
        currentLevelLiters: 8000, // 80% lleno
        currentLevelPercentage: 80,
        status: TankStatus.ACTIVE,
        location: 'Planta Principal - Av. Industrial 1000',
        dailyConsumption: 0,
        sensor: savedCompanySensor,
        client: null, // Sin cliente asociado
      });

      await this.tankRepository.save(companyTank);
      this.logger.log('Tanque principal de la empresa creado');
    }

    // Ahora crear tanques de clientes
    const clients = await this.clientRepository.find({
      where: { isActive: true },
    });

    const tanksData = [
      {
        code: 'TK-001',
        capacityLiters: 300,
        location: 'Calle Principal 123, Col. Centro',
        clientIndex: 0,
        currentLevel: 75,
      },
      {
        code: 'TK-002',
        capacityLiters: 500,
        location: 'Av. Reforma 456, Col. Juárez',
        clientIndex: 0,
        currentLevel: 45,
      },
      {
        code: 'TK-003',
        capacityLiters: 1000,
        location: 'Calle Secundaria 789, Col. Industrial',
        clientIndex: 1,
        currentLevel: 20,
      },
      {
        code: 'TK-004',
        capacityLiters: 300,
        location: 'Av. Universidad 321, Col. Del Valle',
        clientIndex: 1,
        currentLevel: 90,
      },
      {
        code: 'TK-005',
        capacityLiters: 500,
        location: 'Calle Tercera 654, Col. Santa Fe',
        clientIndex: 2,
        currentLevel: 15,
      },
    ];

    for (const tankData of tanksData) {
      const existingTank = await this.tankRepository.findOne({
        where: { code: tankData.code },
      });

      if (!existingTank && clients[tankData.clientIndex]) {
        // Crear sensor
        const sensor = this.sensorRepository.create({
          serialNumber: `SENSOR-${tankData.code}-${Date.now()}`,
          status: SensorStatus.ACTIVE,
          lastReading: tankData.currentLevel,
          lastReadingDate: new Date(),
        });

        const savedSensor = await this.sensorRepository.save(sensor);

        // Crear tanque
        const tank = this.tankRepository.create({
          code: tankData.code,
          type: TankType.CLIENT, // Especificar tipo cliente
          capacityLiters: tankData.capacityLiters,
          location: tankData.location,
          client: clients[tankData.clientIndex],
          sensor: savedSensor,
          status: TankStatus.ACTIVE,
          currentLevelLiters: (tankData.capacityLiters * tankData.currentLevel) / 100,
          currentLevelPercentage: tankData.currentLevel,
          dailyConsumption: 10 + Math.random() * 20, // Entre 10 y 30 litros por día
          lastRechargeDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Hace una semana
          lastRechargeAmount: tankData.capacityLiters,
        });

        await this.tankRepository.save(tank);
        this.logger.log(`Tanque ${tankData.code} creado para cliente ${clients[tankData.clientIndex].email}`);
      }
    }
  }
}