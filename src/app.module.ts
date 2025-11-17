import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { getDatabaseConfig } from './config/database.config';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { TanksModule } from './modules/tanks/tanks.module';
import { SensorsModule } from './modules/sensors/sensors.module';
import { WebsocketModule } from './modules/websocket/websocket.module';
import { RechargesModule } from './modules/recharges/recharges.module';
import { AlertsModule } from './modules/alerts/alerts.module';
import { SuppliesModule } from './modules/supplies/supplies.module';
import { ReportsModule } from './modules/reports/reports.module';
import { PdfModule } from './modules/pdf/pdf.module';
import { EmailModule } from './modules/email/email.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { SeedModule } from './seed/seed.module';

@Module({
  imports: [
    // Configuración global
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Base de datos
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: getDatabaseConfig,
      inject: [ConfigService],
    }),

    // Módulos de funcionalidad
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),

    // Módulos de la aplicación
    AuthModule,
    UsersModule,
    TanksModule,
    SensorsModule,
    WebsocketModule,
    RechargesModule,
    AlertsModule,
    SuppliesModule,
    ReportsModule,
    PdfModule,
    EmailModule,
    DashboardModule,
    SeedModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
