import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Client } from './client.entity';

export enum MetodoNotificacion {
  EMAIL = 'email',
  SMS = 'sms',
  WHATSAPP = 'whatsapp',
  APP = 'app',
}

export enum FrecuenciaReporte {
  DIARIO = 'diario',
  SEMANAL = 'semanal',
  QUINCENAL = 'quincenal',
  MENSUAL = 'mensual',
  TRIMESTRAL = 'trimestral',
}

@Entity('preferencias_cliente')
export class ClientPreferences {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Preferencias de Alertas
  @Column({
    name: 'umbral_alerta_bajo',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 15,
    comment: 'Porcentaje para alerta de nivel bajo (por defecto 15%)',
  })
  umbralAlertaBajo: number;

  @Column({
    name: 'umbral_alerta_critico',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 10,
    comment: 'Porcentaje para alerta de nivel crítico (por defecto 10%)',
  })
  umbralAlertaCritico: number;

  @Column({
    name: 'alertas_activas',
    type: 'boolean',
    default: true,
    comment: 'Si el cliente quiere recibir alertas',
  })
  alertasActivas: boolean;

  // Métodos de Notificación
  @Column({
    name: 'metodos_notificacion',
    type: 'simple-array',
    nullable: true,
    comment: 'Métodos preferidos de notificación',
  })
  metodosNotificacion: MetodoNotificacion[];

  @Column({
    name: 'notificar_email',
    type: 'boolean',
    default: true,
  })
  notificarEmail: boolean;

  @Column({
    name: 'notificar_sms',
    type: 'boolean',
    default: false,
  })
  notificarSms: boolean;

  @Column({
    name: 'notificar_whatsapp',
    type: 'boolean',
    default: false,
  })
  notificarWhatsapp: boolean;

  @Column({
    name: 'notificar_app',
    type: 'boolean',
    default: true,
  })
  notificarApp: boolean;

  // Horarios Preferidos
  @Column({
    name: 'horario_recarga_inicio',
    type: 'time',
    nullable: true,
    comment: 'Hora de inicio preferida para recargas',
  })
  horarioRecargaInicio: string;

  @Column({
    name: 'horario_recarga_fin',
    type: 'time',
    nullable: true,
    comment: 'Hora de fin preferida para recargas',
  })
  horarioRecargaFin: string;

  @Column({
    name: 'dias_preferidos_recarga',
    type: 'simple-array',
    nullable: true,
    comment: 'Días preferidos para recarga (lunes,martes,etc)',
  })
  diasPreferidosRecarga: string[];

  // Reportes Automáticos
  @Column({
    name: 'reportes_automaticos',
    type: 'boolean',
    default: false,
    comment: 'Si el cliente quiere recibir reportes automáticos',
  })
  reportesAutomaticos: boolean;

  @Column({
    name: 'frecuencia_reportes',
    type: 'enum',
    enum: FrecuenciaReporte,
    default: FrecuenciaReporte.MENSUAL,
    comment: 'Frecuencia de envío de reportes',
  })
  frecuenciaReportes: FrecuenciaReporte;

  @Column({
    name: 'dia_envio_reporte',
    type: 'int',
    nullable: true,
    comment: 'Día del mes para envío de reportes (1-31)',
  })
  diaEnvioReporte: number;

  @Column({
    name: 'hora_envio_reporte',
    type: 'time',
    default: '08:00:00',
    comment: 'Hora de envío de reportes',
  })
  horaEnvioReporte: string;

  // Contactos Adicionales
  @Column({
    name: 'emails_adicionales',
    type: 'simple-array',
    nullable: true,
    comment: 'Emails adicionales para notificaciones',
  })
  emailsAdicionales: string[];

  @Column({
    name: 'telefonos_adicionales',
    type: 'simple-array',
    nullable: true,
    comment: 'Teléfonos adicionales para notificaciones',
  })
  telefonosAdicionales: string[];

  @Column({
    name: 'contacto_emergencia_nombre',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  contactoEmergenciaNombre: string;

  @Column({
    name: 'contacto_emergencia_telefono',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  contactoEmergenciaTelefono: string;

  @Column({
    name: 'contacto_emergencia_email',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  contactoEmergenciaEmail: string;

  // Preferencias de Recarga
  @Column({
    name: 'recarga_automatica',
    type: 'boolean',
    default: false,
    comment: 'Si se debe programar recarga automática al llegar al umbral',
  })
  recargaAutomatica: boolean;

  @Column({
    name: 'nivel_recarga_automatica',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 20,
    comment: 'Nivel en % para programar recarga automática',
  })
  nivelRecargaAutomatica: number;

  @Column({
    name: 'cantidad_recarga_predeterminada',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    comment: 'Cantidad en litros para recargas',
  })
  cantidadRecargaPredeterminada: number;

  @Column({
    name: 'proveedor_preferido',
    type: 'varchar',
    length: 255,
    nullable: true,
    comment: 'Proveedor preferido para recargas',
  })
  proveedorPreferido: string;

  // Preferencias de Interfaz
  @Column({
    name: 'idioma',
    type: 'varchar',
    length: 5,
    default: 'es',
    comment: 'Idioma preferido (es, en, etc)',
  })
  idioma: string;

  @Column({
    name: 'formato_fecha',
    type: 'varchar',
    length: 20,
    default: 'DD/MM/YYYY',
  })
  formatoFecha: string;

  @Column({
    name: 'unidad_medida',
    type: 'varchar',
    length: 10,
    default: 'litros',
    comment: 'Unidad de medida preferida (litros, galones, etc)',
  })
  unidadMedida: string;

  @Column({
    name: 'tema_interfaz',
    type: 'varchar',
    length: 20,
    default: 'light',
    comment: 'Tema de interfaz (light, dark, auto)',
  })
  temaInterfaz: string;

  // Notificaciones específicas
  @Column({
    name: 'notificar_nivel_bajo',
    type: 'boolean',
    default: true,
  })
  notificarNivelBajo: boolean;

  @Column({
    name: 'notificar_nivel_critico',
    type: 'boolean',
    default: true,
  })
  notificarNivelCritico: boolean;

  @Column({
    name: 'notificar_recarga_programada',
    type: 'boolean',
    default: true,
  })
  notificarRecargaProgramada: boolean;

  @Column({
    name: 'notificar_recarga_completada',
    type: 'boolean',
    default: true,
  })
  notificarRecargaCompletada: boolean;

  @Column({
    name: 'notificar_anomalias',
    type: 'boolean',
    default: true,
    comment: 'Notificar anomalías de consumo',
  })
  notificarAnomalias: boolean;

  @Column({
    name: 'notificar_mantenimiento',
    type: 'boolean',
    default: true,
  })
  notificarMantenimiento: boolean;

  // Límites y restricciones
  @Column({
    name: 'limite_consumo_diario',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    comment: 'Límite de consumo diario en litros para alertas',
  })
  limiteConsumoDiario: number;

  @Column({
    name: 'limite_consumo_mensual',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    comment: 'Límite de consumo mensual en litros',
  })
  limiteConsumoMensual: number;

  // Notas y observaciones
  @Column({
    name: 'notas_internas',
    type: 'text',
    nullable: true,
    comment: 'Notas internas sobre las preferencias del cliente',
  })
  notasInternas: string;

  // Relación con Cliente
  @OneToOne(() => Client, (client) => client.preferences, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'cliente_id' })
  cliente: Client;

  @CreateDateColumn({
    name: 'fecha_creacion',
    type: 'timestamp',
  })
  fechaCreacion: Date;

  @UpdateDateColumn({
    name: 'fecha_actualizacion',
    type: 'timestamp',
  })
  fechaActualizacion: Date;

  // Métodos helper
  debeNotificarPor(metodo: MetodoNotificacion): boolean {
    switch (metodo) {
      case MetodoNotificacion.EMAIL:
        return this.notificarEmail;
      case MetodoNotificacion.SMS:
        return this.notificarSms;
      case MetodoNotificacion.WHATSAPP:
        return this.notificarWhatsapp;
      case MetodoNotificacion.APP:
        return this.notificarApp;
      default:
        return false;
    }
  }

  obtenerContactosNotificacion(): {
    emails: string[];
    telefonos: string[];
  } {
    const emails = this.notificarEmail ? [...(this.emailsAdicionales || [])] : [];
    const telefonos = (this.notificarSms || this.notificarWhatsapp)
      ? [...(this.telefonosAdicionales || [])]
      : [];

    // Agregar contacto de emergencia si es crítico
    if (this.contactoEmergenciaEmail) {
      emails.push(this.contactoEmergenciaEmail);
    }
    if (this.contactoEmergenciaTelefono) {
      telefonos.push(this.contactoEmergenciaTelefono);
    }

    return { emails, telefonos };
  }
}