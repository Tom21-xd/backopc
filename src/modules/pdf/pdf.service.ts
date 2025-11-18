import { Injectable } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import * as handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class PdfService {
  private browser: puppeteer.Browser;

  constructor() {
    this.initializeBrowser();
  }

  private async initializeBrowser() {
    this.browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }

  async generatePdf(templateName: string, data: any): Promise<Buffer> {
    if (!this.browser) {
      await this.initializeBrowser();
    }

    const templatePath = path.join(
      __dirname,
      '..',
      '..',
      '..',
      'templates',
      'pdf',
      `${templateName}.hbs`,
    );

    const templateHtml = fs.readFileSync(templatePath, 'utf8');
    const template = handlebars.compile(templateHtml);

    // Register helpers
    this.registerHandlebarsHelpers();

    const html = template(data);

    const page = await this.browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        bottom: '20mm',
        left: '20mm',
        right: '20mm',
      },
    });

    await page.close();
    return Buffer.from(pdf);
  }

  private registerHandlebarsHelpers() {
    // Helper para formatear fechas
    handlebars.registerHelper('formatDate', (date: Date) => {
      if (!date) return '';
      const d = new Date(date);
      return d.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    });

    // Helper para formatear moneda
    handlebars.registerHelper('currency', (value: number) => {
      if (!value) return '$0.00';
      return new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency: 'USD',
      }).format(value);
    });

    // Helper para formatear porcentajes
    handlebars.registerHelper('percentage', (value: number) => {
      if (value === null || value === undefined) return '0%';
      return `${value.toFixed(2)}%`;
    });

    // Helper para formatear litros
    handlebars.registerHelper('liters', (value: number) => {
      if (!value) return '0 L';
      return `${value.toFixed(2)} L`;
    });

    // Helper para comparación
    handlebars.registerHelper('ifEquals', function(arg1, arg2, options) {
      return arg1 === arg2 ? options.fn(this) : options.inverse(this);
    });

    // Helper para comparación menor que
    handlebars.registerHelper('lt', function(arg1, arg2) {
      return arg1 < arg2;
    });

    // Helper para estado de alerta
    handlebars.registerHelper('alertStatus', (status: string) => {
      const statusMap = {
        active: 'Activa',
        acknowledged: 'Reconocida',
        resolved: 'Resuelta',
      };
      return statusMap[status] || status;
    });

    // Helper para severidad de alerta
    handlebars.registerHelper('alertSeverity', (severity: string) => {
      const severityMap = {
        info: 'Información',
        warning: 'Advertencia',
        critical: 'Crítica',
      };
      return severityMap[severity] || severity;
    });
  }

  async onModuleDestroy() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}