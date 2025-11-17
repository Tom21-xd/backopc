import {
  Controller,
  Get,
  Post,
  Query,
  Param,
  Body,
  UseGuards,
  Res,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User, UserRole } from '../../entities/user.entity';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('general')
  getGeneralReport(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @CurrentUser() user: User,
  ) {
    return this.reportsService.getGeneralReport(
      new Date(startDate),
      new Date(endDate),
      user.id,
      user.role,
    );
  }

  @Get('tank/:tankId')
  getTankReport(
    @Param('tankId') tankId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.reportsService.getTankReport(
      tankId,
      new Date(startDate),
      new Date(endDate),
    );
  }

  @Get('client/:clientId')
  @Roles(UserRole.ADMIN)
  getClientReport(
    @Param('clientId') clientId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.reportsService.getClientReport(
      clientId,
      new Date(startDate),
      new Date(endDate),
    );
  }

  @Get('export')
  async exportReport(
    @Query('type') type: string,
    @Query('format') format: 'json' | 'pdf' = 'json',
    @Query() params: any,
    @CurrentUser() user: User,
    @Res() res: Response,
  ) {
    const result = await this.reportsService.exportReport(type, {
      ...params,
      userId: user.id,
      userRole: user.role,
    }, format);

    if (format === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      res.send(result.data);
    } else {
      res.json(result);
    }
  }

  @Get('download/:reportType')
  async downloadPdfReport(
    @Param('reportType') reportType: 'general' | 'tank' | 'client',
    @Query() params: any,
    @CurrentUser() user: User,
    @Res() res: Response,
  ) {
    try {
      const pdfBuffer = await this.reportsService.generatePdfReport(
        reportType,
        {
          ...params,
          userId: user.id,
          userRole: user.role,
        },
      );

      const fileName = `${reportType}-report-${new Date().toISOString().split('T')[0]}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.send(pdfBuffer);
    } catch (error) {
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Error generating PDF report',
        error: error.message,
      });
    }
  }

  @Post('send-email')
  async sendReportByEmail(
    @Body() body: {
      reportType: 'general' | 'tank' | 'client';
      params: any;
      emailTo: string | string[];
    },
    @CurrentUser() user: User,
  ) {
    const { reportType, params, emailTo } = body;

    const success = await this.reportsService.sendReportByEmail(
      reportType,
      {
        ...params,
        userId: user.id,
        userRole: user.role,
      },
      emailTo,
    );

    return {
      success,
      message: success
        ? 'Informe enviado exitosamente por correo'
        : 'Error al enviar el informe por correo',
    };
  }

  @Get('preview/:reportType')
  async previewPdfReport(
    @Param('reportType') reportType: 'general' | 'tank' | 'client',
    @Query() params: any,
    @CurrentUser() user: User,
    @Res() res: Response,
  ) {
    try {
      const pdfBuffer = await this.reportsService.generatePdfReport(
        reportType,
        {
          ...params,
          userId: user.id,
          userRole: user.role,
        },
      );

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline');
      res.send(pdfBuffer);
    } catch (error) {
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Error generating PDF preview',
        error: error.message,
      });
    }
  }
}