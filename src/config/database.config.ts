import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';

export const getDatabaseConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => ({
  type: 'mysql',
  host: configService.get<string>('DB_HOST', 'localhost'),
  port: configService.get<number>('DB_PORT', 3306),
  username: configService.get<string>('DB_USER', 'root'),
  password: configService.get<string>('DB_PASSWORD', ''),
  database: configService.get<string>('DB_NAME', 'gas_monitoring_system'),
  entities: [path.join(__dirname, '..', 'entities', '*.entity{.ts,.js}')],
  synchronize: configService.get<string>('NODE_ENV') === 'development', // Solo en desarrollo
  logging: configService.get<string>('NODE_ENV') === 'development',
  autoLoadEntities: true,
});