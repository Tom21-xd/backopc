import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class ExcelService {
  private logoPath: string;

  constructor() {
    this.logoPath = path.join(
      __dirname,
      '..',
      '..',
      '..',
      'src',
      'img',
      'gasCaqueta.png',
    );
  }

  async generateGeneralReportExcel(data: any): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Sistema de Monitoreo de Tanques de Gas';
    workbook.created = new Date();

    // Hoja 1: Resumen General
    const summarySheet = workbook.addWorksheet('Resumen General', {
      pageSetup: { paperSize: 9, orientation: 'landscape' },
      views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }],
    });

    // Agregar logo
    await this.addLogo(workbook, summarySheet);

    // Título
    summarySheet.mergeCells('A1:H1');
    const titleCell = summarySheet.getCell('A1');
    titleCell.value = 'INFORME GENERAL DEL SISTEMA';
    titleCell.font = { size: 18, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E3A8A' }, // Azul empresarial
    };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    summarySheet.getRow(1).height = 40;

    // Subtítulo
    summarySheet.mergeCells('A2:H2');
    const subtitleCell = summarySheet.getCell('A2');
    subtitleCell.value = `Período: ${data.period.start} - ${data.period.end}`;
    subtitleCell.font = { size: 12, italic: true };
    subtitleCell.alignment = { horizontal: 'center' };
    summarySheet.getRow(2).height = 25;

    let currentRow = 4;

    // Estadísticas principales
    summarySheet.mergeCells(`A${currentRow}:H${currentRow}`);
    const statsHeader = summarySheet.getCell(`A${currentRow}`);
    statsHeader.value = 'ESTADÍSTICAS PRINCIPALES';
    statsHeader.font = { size: 14, bold: true, color: { argb: 'FF1E3A8A' } };
    statsHeader.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E7FF' },
    };
    summarySheet.getRow(currentRow).height = 30;
    currentRow++;

    const stats = [
      ['Tanques Totales', data.statistics.totalTanks, 'Tanques Activos', data.statistics.activeTanks],
      ['Total Clientes', data.statistics.totalClients, 'Alertas Activas', data.statistics.activeAlerts],
      ['Tanques Críticos (<10%)', data.statistics.criticalTanks, 'Tanques Bajos (10-20%)', data.statistics.lowTanks],
      ['Tanques Normales (>20%)', data.statistics.normalTanks, 'Total Recargas', data.rechargeStats.total],
    ];

    stats.forEach((row) => {
      const excelRow = summarySheet.getRow(currentRow);
      excelRow.values = ['', row[0], row[1], '', row[2], row[3]];
      this.styleDataRow(excelRow, [2, 3, 5, 6]);
      currentRow++;
    });

    currentRow += 2;

    // Tanques Críticos
    if (data.criticalTanks && data.criticalTanks.length > 0) {
      summarySheet.mergeCells(`A${currentRow}:H${currentRow}`);
      const criticalHeader = summarySheet.getCell(`A${currentRow}`);
      criticalHeader.value = '⚠️ TANQUES CON NIVEL CRÍTICO';
      criticalHeader.font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
      criticalHeader.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFDC2626' },
      };
      summarySheet.getRow(currentRow).height = 30;
      currentRow++;

      const criticalHeaders = ['Código', 'Cliente', 'Ubicación', 'Nivel Actual', 'Última Recarga', 'Estado'];
      const headerRow = summarySheet.getRow(currentRow);
      headerRow.values = ['', ...criticalHeaders];
      this.styleHeaderRow(headerRow);
      currentRow++;

      data.criticalTanks.forEach((tank: any) => {
        const row = summarySheet.getRow(currentRow);
        row.values = [
          '',
          tank.code,
          tank.client?.companyName || `${tank.client?.firstName} ${tank.client?.lastName}`,
          tank.location,
          `${tank.currentLevelPercentage.toFixed(2)}%`,
          tank.lastRechargeDate ? new Date(tank.lastRechargeDate).toLocaleDateString('es-ES') : 'N/A',
          tank.status,
        ];
        this.styleDataRow(row);

        // Resaltar nivel crítico en rojo
        const levelCell = row.getCell(5);
        levelCell.font = { bold: true, color: { argb: 'FFDC2626' } };
        currentRow++;
      });
    }

    // Hoja 2: Alertas
    this.createAlertsSheet(workbook, data);

    // Hoja 3: Recargas
    this.createRechargesSheet(workbook, data);

    // Hoja 4: Consumo
    this.createConsumptionSheet(workbook, data);

    // Hoja 5: Clientes
    this.createClientsSheet(workbook, data);

    // Ajustar anchos de columna
    summarySheet.columns = [
      { width: 3 },
      { width: 25 },
      { width: 15 },
      { width: 3 },
      { width: 25 },
      { width: 15 },
      { width: 20 },
      { width: 15 },
    ];

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async generateTankReportExcel(data: any): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Sistema de Monitoreo de Tanques de Gas';
    workbook.created = new Date();

    // Hoja principal: Información del Tanque
    const mainSheet = workbook.addWorksheet('Información del Tanque');
    await this.addLogo(workbook, mainSheet);

    // Título
    mainSheet.mergeCells('A1:F1');
    const titleCell = mainSheet.getCell('A1');
    titleCell.value = `INFORME DE TANQUE: ${data.tank.code}`;
    titleCell.font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E3A8A' },
    };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    mainSheet.getRow(1).height = 35;

    let row = 3;

    // Información del tanque
    this.addSectionHeader(mainSheet, row, 'INFORMACIÓN DEL TANQUE', 6);
    row++;

    const tankInfo = [
      ['Código', data.tank.code],
      ['Estado', data.tank.status],
      ['Capacidad Total', `${data.tank.capacityLiters.toFixed(2)} L`],
      ['Nivel Actual', `${data.tank.currentLevelLiters.toFixed(2)} L (${data.tank.currentLevelPercentage.toFixed(2)}%)`],
      ['Ubicación', data.tank.location],
      ['Consumo Diario Promedio', `${data.tank.dailyConsumption?.toFixed(2) || 'N/A'} L`],
      ['Última Recarga', data.tank.lastRechargeDate ? new Date(data.tank.lastRechargeDate).toLocaleDateString('es-ES') : 'N/A'],
    ];

    tankInfo.forEach(([label, value]) => {
      const excelRow = mainSheet.getRow(row);
      excelRow.values = ['', label, value];
      this.styleInfoRow(excelRow);
      row++;
    });

    row += 2;

    // Información del cliente
    if (data.client) {
      this.addSectionHeader(mainSheet, row, 'INFORMACIÓN DEL CLIENTE', 6);
      row++;

      const clientInfo = [
        ['Nombre/Empresa', data.client.companyName || `${data.client.firstName} ${data.client.lastName}`],
        ['Identificación', `${data.client.identificationType}: ${data.client.identificationNumber}`],
        ['Email', data.client.email],
        ['Teléfono', data.client.phone],
        ['Dirección', data.client.address],
      ];

      clientInfo.forEach(([label, value]) => {
        const excelRow = mainSheet.getRow(row);
        excelRow.values = ['', label, value];
        this.styleInfoRow(excelRow);
        row++;
      });
    }

    row += 2;

    // Estadísticas del período
    this.addSectionHeader(mainSheet, row, 'ESTADÍSTICAS DEL PERÍODO', 6);
    row++;

    const periodStats = [
      ['Período', `${data.period.start} - ${data.period.end}`],
      ['Consumo Total', `${data.statistics.totalConsumption} L`],
      ['Recargas Realizadas', data.statistics.totalRecharges],
      ['Consumo Diario Promedio', `${data.statistics.averageDailyConsumption} L`],
    ];

    periodStats.forEach(([label, value]) => {
      const excelRow = mainSheet.getRow(row);
      excelRow.values = ['', label, value];
      this.styleInfoRow(excelRow);
      row++;
    });

    // Hojas adicionales
    if (data.recharges && data.recharges.length > 0) {
      this.createTankRechargesSheet(workbook, data.recharges);
    }

    if (data.alerts && data.alerts.length > 0) {
      this.createTankAlertsSheet(workbook, data.alerts);
    }

    if (data.consumptionHistory && data.consumptionHistory.length > 0) {
      this.createConsumptionHistorySheet(workbook, data.consumptionHistory);
    }

    mainSheet.columns = [
      { width: 3 },
      { width: 30 },
      { width: 40 },
      { width: 20 },
      { width: 20 },
      { width: 20 },
    ];

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async generateClientReportExcel(data: any): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Sistema de Monitoreo de Tanques de Gas';
    workbook.created = new Date();

    const mainSheet = workbook.addWorksheet('Resumen del Cliente');
    await this.addLogo(workbook, mainSheet);

    // Título
    mainSheet.mergeCells('A1:F1');
    const titleCell = mainSheet.getCell('A1');
    titleCell.value = `INFORME DE CLIENTE: ${data.client.companyName || data.client.firstName + ' ' + data.client.lastName}`;
    titleCell.font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E3A8A' },
    };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    mainSheet.getRow(1).height = 35;

    let row = 3;

    // Información del cliente
    this.addSectionHeader(mainSheet, row, 'INFORMACIÓN DEL CLIENTE', 6);
    row++;

    const clientInfo = [
      ['Nombre/Empresa', data.client.companyName || `${data.client.firstName} ${data.client.lastName}`],
      ['Email', data.client.email],
      ['Teléfono', data.client.phone],
      ['Dirección', data.client.address],
      ['Número de Tanques', data.client.tanksCount],
    ];

    clientInfo.forEach(([label, value]) => {
      const excelRow = mainSheet.getRow(row);
      excelRow.values = ['', label, value];
      this.styleInfoRow(excelRow);
      row++;
    });

    row += 2;

    // Resumen del período
    this.addSectionHeader(mainSheet, row, 'RESUMEN DEL PERÍODO', 6);
    row++;

    const summary = [
      ['Período', `${data.period.start} - ${data.period.end}`],
      ['Consumo Total', `${data.summary.totalConsumption} L`],
      ['Total Suministros', data.summary.totalSupplies],
      ['Total Alertas', data.summary.totalAlerts],
      ['Total Recargas', data.summary.totalRecharges],
    ];

    summary.forEach(([label, value]) => {
      const excelRow = mainSheet.getRow(row);
      excelRow.values = ['', label, value];
      this.styleInfoRow(excelRow);
      row++;
    });

    // Crear hoja por cada tanque
    if (data.tanks && data.tanks.length > 0) {
      data.tanks.forEach((tankReport: any, index: number) => {
        const tankSheet = workbook.addWorksheet(`Tanque ${index + 1}`);
        this.createTankDetailSheet(tankSheet, tankReport);
      });
    }

    mainSheet.columns = [
      { width: 3 },
      { width: 30 },
      { width: 40 },
      { width: 20 },
      { width: 20 },
      { width: 20 },
    ];

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  private async addLogo(workbook: ExcelJS.Workbook, sheet: ExcelJS.Worksheet) {
    try {
      if (fs.existsSync(this.logoPath)) {
        const imageId = workbook.addImage({
          filename: this.logoPath,
          extension: 'png',
        });

        sheet.addImage(imageId, {
          tl: { col: 0.2, row: 0.2 },
          ext: { width: 80, height: 80 },
        });
      }
    } catch (error) {
      console.error('Error adding logo:', error);
    }
  }

  private addSectionHeader(sheet: ExcelJS.Worksheet, row: number, title: string, colSpan: number) {
    sheet.mergeCells(`A${row}:${this.getColumnLetter(colSpan)}${row}`);
    const cell = sheet.getCell(`A${row}`);
    cell.value = title;
    cell.font = { size: 13, bold: true, color: { argb: 'FF1E3A8A' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E7FF' },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin' },
      bottom: { style: 'thin' },
      left: { style: 'thin' },
      right: { style: 'thin' },
    };
    sheet.getRow(row).height = 28;
  }

  private styleHeaderRow(row: ExcelJS.Row) {
    row.eachCell((cell, colNumber) => {
      if (colNumber > 1) {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF1E3A8A' },
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
          top: { style: 'thin' },
          bottom: { style: 'thin' },
          left: { style: 'thin' },
          right: { style: 'thin' },
        };
      }
    });
    row.height = 25;
  }

  private styleDataRow(row: ExcelJS.Row, highlightCols?: number[]) {
    row.eachCell((cell, colNumber) => {
      if (colNumber > 1) {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        };
        cell.alignment = { vertical: 'middle' };

        if (highlightCols && highlightCols.includes(colNumber)) {
          cell.font = { bold: true };
        }
      }
    });
    row.height = 20;
  }

  private styleInfoRow(row: ExcelJS.Row) {
    const labelCell = row.getCell(2);
    labelCell.font = { bold: true, color: { argb: 'FF374151' } };
    labelCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF3F4F6' },
    };
    labelCell.border = {
      top: { style: 'thin' },
      bottom: { style: 'thin' },
      left: { style: 'thin' },
      right: { style: 'thin' },
    };

    const valueCell = row.getCell(3);
    valueCell.border = {
      top: { style: 'thin' },
      bottom: { style: 'thin' },
      left: { style: 'thin' },
      right: { style: 'thin' },
    };

    row.height = 22;
  }

  private createAlertsSheet(workbook: ExcelJS.Workbook, data: any) {
    const sheet = workbook.addWorksheet('Alertas');

    sheet.mergeCells('A1:F1');
    const title = sheet.getCell('A1');
    title.value = 'RESUMEN DE ALERTAS';
    title.font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    title.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E3A8A' },
    };
    title.alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.getRow(1).height = 30;

    const headers = ['Tipo de Alerta', 'Activas', 'Reconocidas', 'Resueltas', 'Total'];
    const headerRow = sheet.getRow(3);
    headerRow.values = ['', ...headers];
    this.styleHeaderRow(headerRow);

    let row = 4;
    data.alertsSummary.forEach((alert: any) => {
      const excelRow = sheet.getRow(row);
      excelRow.values = ['', alert.type, alert.active, alert.acknowledged, alert.resolved, alert.total];
      this.styleDataRow(excelRow);
      row++;
    });

    sheet.columns = [
      { width: 3 },
      { width: 30 },
      { width: 15 },
      { width: 15 },
      { width: 15 },
      { width: 15 },
    ];
  }

  private createRechargesSheet(workbook: ExcelJS.Workbook, data: any) {
    const sheet = workbook.addWorksheet('Recargas');

    sheet.mergeCells('A1:F1');
    const title = sheet.getCell('A1');
    title.value = 'PRÓXIMAS RECARGAS PROGRAMADAS';
    title.font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    title.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E3A8A' },
    };
    title.alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.getRow(1).height = 30;

    const headers = ['Fecha', 'Tanque', 'Cliente', 'Cantidad Estimada', 'Solicitado Por'];
    const headerRow = sheet.getRow(3);
    headerRow.values = ['', ...headers];
    this.styleHeaderRow(headerRow);

    let row = 4;
    if (data.upcomingRecharges && data.upcomingRecharges.length > 0) {
      data.upcomingRecharges.forEach((recharge: any) => {
        const excelRow = sheet.getRow(row);
        excelRow.values = [
          '',
          new Date(recharge.scheduledDate).toLocaleDateString('es-ES'),
          recharge.tank.code,
          recharge.tank.client?.companyName || recharge.tank.client?.firstName || 'N/A',
          `${recharge.estimatedQuantityLiters.toFixed(2)} L`,
          recharge.requestedBy,
        ];
        this.styleDataRow(excelRow);
        row++;
      });
    }

    sheet.columns = [
      { width: 3 },
      { width: 20 },
      { width: 20 },
      { width: 30 },
      { width: 20 },
      { width: 25 },
    ];
  }

  private createConsumptionSheet(workbook: ExcelJS.Workbook, data: any) {
    const sheet = workbook.addWorksheet('Consumo');

    sheet.mergeCells('A1:F1');
    const title = sheet.getCell('A1');
    title.value = 'ESTADÍSTICAS DE CONSUMO';
    title.font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    title.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E3A8A' },
    };
    title.alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.getRow(1).height = 30;

    let row = 3;

    // Resumen
    const summaryData = [
      ['Consumo Total del Período', `${data.consumptionStats.totalConsumption} L`],
      ['Consumo Diario Promedio', `${data.consumptionStats.dailyAverage} L`],
    ];

    summaryData.forEach(([label, value]) => {
      const excelRow = sheet.getRow(row);
      excelRow.values = ['', label, value];
      this.styleInfoRow(excelRow);
      row++;
    });

    row += 2;

    // Mayores consumidores
    if (data.topConsumers && data.topConsumers.length > 0) {
      this.addSectionHeader(sheet, row, 'MAYORES CONSUMIDORES', 6);
      row++;

      const headers = ['Tanque', 'Cliente', 'Consumo Total', 'Consumo Diario', '% del Total'];
      const headerRow = sheet.getRow(row);
      headerRow.values = ['', ...headers];
      this.styleHeaderRow(headerRow);
      row++;

      data.topConsumers.forEach((consumer: any) => {
        const excelRow = sheet.getRow(row);
        excelRow.values = [
          '',
          consumer.tank.code,
          consumer.client?.companyName || consumer.client?.firstName || 'N/A',
          `${consumer.totalConsumption} L`,
          `${consumer.dailyAverage} L`,
          `${consumer.percentageOfTotal}%`,
        ];
        this.styleDataRow(excelRow);
        row++;
      });
    }

    sheet.columns = [
      { width: 3 },
      { width: 20 },
      { width: 30 },
      { width: 20 },
      { width: 20 },
      { width: 15 },
    ];
  }

  private createClientsSheet(workbook: ExcelJS.Workbook, data: any) {
    const sheet = workbook.addWorksheet('Clientes');

    sheet.mergeCells('A1:G1');
    const title = sheet.getCell('A1');
    title.value = 'RESUMEN POR CLIENTE';
    title.font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    title.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E3A8A' },
    };
    title.alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.getRow(1).height = 30;

    const headers = ['Cliente', 'Email', 'Teléfono', 'Tanques', 'Estado'];
    const headerRow = sheet.getRow(3);
    headerRow.values = ['', ...headers];
    this.styleHeaderRow(headerRow);

    let row = 4;
    if (data.clientsSummary && data.clientsSummary.length > 0) {
      data.clientsSummary.forEach((client: any) => {
        const excelRow = sheet.getRow(row);
        excelRow.values = [
          '',
          client.companyName || `${client.firstName} ${client.lastName}`,
          client.email,
          client.phone,
          client.tanksCount,
          client.isActive ? 'ACTIVO' : 'INACTIVO',
        ];
        this.styleDataRow(excelRow);

        // Colorear estado
        const statusCell = excelRow.getCell(6);
        if (client.isActive) {
          statusCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFD1FAE5' },
          };
          statusCell.font = { bold: true, color: { argb: 'FF065F46' } };
        } else {
          statusCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFECACA' },
          };
          statusCell.font = { bold: true, color: { argb: 'FF991B1B' } };
        }

        row++;
      });
    }

    sheet.columns = [
      { width: 3 },
      { width: 35 },
      { width: 30 },
      { width: 20 },
      { width: 15 },
      { width: 15 },
    ];
  }

  private createTankRechargesSheet(workbook: ExcelJS.Workbook, recharges: any[]) {
    const sheet = workbook.addWorksheet('Historial de Recargas');

    sheet.mergeCells('A1:G1');
    const title = sheet.getCell('A1');
    title.value = 'HISTORIAL DE RECARGAS';
    title.font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    title.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E3A8A' },
    };
    title.alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.getRow(1).height = 30;

    const headers = ['Fecha Programada', 'Fecha Completada', 'Cant. Estimada', 'Cant. Real', 'Estado', 'Solicitado Por'];
    const headerRow = sheet.getRow(3);
    headerRow.values = ['', ...headers];
    this.styleHeaderRow(headerRow);

    let row = 4;
    recharges.forEach((recharge: any) => {
      const excelRow = sheet.getRow(row);
      excelRow.values = [
        '',
        new Date(recharge.scheduledDate).toLocaleDateString('es-ES'),
        recharge.completedDate ? new Date(recharge.completedDate).toLocaleDateString('es-ES') : 'Pendiente',
        `${recharge.estimatedQuantityLiters?.toFixed(2) || 0} L`,
        `${recharge.actualQuantityLiters?.toFixed(2) || 0} L`,
        recharge.status,
        recharge.requestedBy,
      ];
      this.styleDataRow(excelRow);
      row++;
    });

    sheet.columns = [
      { width: 3 },
      { width: 20 },
      { width: 20 },
      { width: 18 },
      { width: 18 },
      { width: 18 },
      { width: 25 },
    ];
  }

  private createTankAlertsSheet(workbook: ExcelJS.Workbook, alerts: any[]) {
    const sheet = workbook.addWorksheet('Alertas');

    sheet.mergeCells('A1:G1');
    const title = sheet.getCell('A1');
    title.value = 'ALERTAS RECIENTES';
    title.font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    title.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E3A8A' },
    };
    title.alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.getRow(1).height = 30;

    const headers = ['Fecha', 'Tipo', 'Severidad', 'Estado', 'Mensaje', 'Nivel de Gas'];
    const headerRow = sheet.getRow(3);
    headerRow.values = ['', ...headers];
    this.styleHeaderRow(headerRow);

    let row = 4;
    alerts.forEach((alert: any) => {
      const excelRow = sheet.getRow(row);
      excelRow.values = [
        '',
        new Date(alert.createdAt).toLocaleDateString('es-ES'),
        alert.type,
        alert.severity,
        alert.status,
        alert.message,
        `${alert.gasLevelAtAlert?.toFixed(2) || 0}%`,
      ];
      this.styleDataRow(excelRow);
      row++;
    });

    sheet.columns = [
      { width: 3 },
      { width: 20 },
      { width: 25 },
      { width: 15 },
      { width: 18 },
      { width: 40 },
      { width: 15 },
    ];
  }

  private createConsumptionHistorySheet(workbook: ExcelJS.Workbook, history: any[]) {
    const sheet = workbook.addWorksheet('Historial de Consumo');

    sheet.mergeCells('A1:G1');
    const title = sheet.getCell('A1');
    title.value = 'HISTORIAL DE CONSUMO';
    title.font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    title.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E3A8A' },
    };
    title.alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.getRow(1).height = 30;

    const headers = ['Fecha', 'Nivel (%)', 'Nivel (L)', 'Consumo (L/h)', 'Temperatura', 'Presión'];
    const headerRow = sheet.getRow(3);
    headerRow.values = ['', ...headers];
    this.styleHeaderRow(headerRow);

    let row = 4;
    history.forEach((record: any) => {
      const excelRow = sheet.getRow(row);
      excelRow.values = [
        '',
        new Date(record.recordedAt).toLocaleDateString('es-ES'),
        `${record.gasLevelPercentage?.toFixed(2) || 0}%`,
        `${record.gasLevelLiters?.toFixed(2) || 0} L`,
        `${record.consumptionRate?.toFixed(2) || 0} L/h`,
        `${record.temperature || 'N/A'}°C`,
        `${record.pressure || 'N/A'} bar`,
      ];
      this.styleDataRow(excelRow);
      row++;
    });

    sheet.columns = [
      { width: 3 },
      { width: 20 },
      { width: 15 },
      { width: 15 },
      { width: 18 },
      { width: 15 },
      { width: 15 },
    ];
  }

  private createTankDetailSheet(sheet: ExcelJS.Worksheet, tankReport: any) {
    sheet.mergeCells('A1:F1');
    const title = sheet.getCell('A1');
    title.value = `TANQUE: ${tankReport.tank.code}`;
    title.font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    title.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E3A8A' },
    };
    title.alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.getRow(1).height = 30;

    let row = 3;

    const tankInfo = [
      ['Código', tankReport.tank.code],
      ['Ubicación', tankReport.tank.location],
      ['Capacidad', `${tankReport.tank.capacityLiters?.toFixed(2) || 0} L`],
      ['Nivel Actual', `${tankReport.tank.currentLevelPercentage?.toFixed(2) || 0}%`],
      ['Consumo Total', `${tankReport.statistics.totalConsumption} L`],
      ['Recargas', tankReport.statistics.totalRecharges],
    ];

    tankInfo.forEach(([label, value]) => {
      const excelRow = sheet.getRow(row);
      excelRow.values = ['', label, value];
      this.styleInfoRow(excelRow);
      row++;
    });

    sheet.columns = [
      { width: 3 },
      { width: 30 },
      { width: 40 },
      { width: 20 },
      { width: 20 },
      { width: 20 },
    ];
  }

  private getColumnLetter(col: number): string {
    let letter = '';
    while (col > 0) {
      const mod = (col - 1) % 26;
      letter = String.fromCharCode(65 + mod) + letter;
      col = Math.floor((col - mod) / 26);
    }
    return letter;
  }
}
