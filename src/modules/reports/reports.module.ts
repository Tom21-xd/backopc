import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { Tank } from '../../entities/tank.entity';
import { Supply } from '../../entities/supply.entity';
import { Alert } from '../../entities/alert.entity';
import { Recharge } from '../../entities/recharge.entity';
import { MonitoringHistory } from '../../entities/monitoring-history.entity';
import { User } from '../../entities/user.entity';
import { PdfModule } from '../pdf/pdf.module';
import { EmailModule } from '../email/email.module';
import { ExcelModule } from '../excel/excel.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Tank,
      Supply,
      Alert,
      Recharge,
      MonitoringHistory,
      User,
    ]),
    PdfModule,
    EmailModule,
    ExcelModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}