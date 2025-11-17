import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Tank } from './tank.entity';

export enum AlertType {
  LOW_LEVEL = 'low_level',
  CRITICAL_LEVEL = 'critical_level',
  SENSOR_FAILURE = 'sensor_failure',
  CONSUMPTION_ANOMALY = 'consumption_anomaly',
  MAINTENANCE_REQUIRED = 'maintenance_required',
}

export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical',
}

export enum AlertStatus {
  ACTIVE = 'active',
  ACKNOWLEDGED = 'acknowledged',
  RESOLVED = 'resolved',
}

@Entity('alertas')
export class Alert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    name: 'tipo',
    type: 'enum',
    enum: AlertType,
  })
  type: AlertType;

  @Column({
    name: 'severidad',
    type: 'enum',
    enum: AlertSeverity,
  })
  severity: AlertSeverity;

  @Column({
    name: 'estado',
    type: 'enum',
    enum: AlertStatus,
    default: AlertStatus.ACTIVE,
  })
  status: AlertStatus;

  @Column({
    name: 'mensaje'
  })
  message: string;

  @Column({
    name: 'nivel_gas_alerta',
    type: 'float',
    nullable: true,
    comment: 'Nivel de gas cuando se generó la alerta'
  })
  gasLevelAtAlert: number;

  @Column({
    name: 'email_enviado',
    default: false
  })
  emailSent: boolean;

  @Column({
    name: 'fecha_envio_email',
    nullable: true
  })
  emailSentAt: Date;

  @Column({
    name: 'reconocida_por',
    nullable: true,
    comment: 'ID del usuario que reconoció la alerta'
  })
  acknowledgedBy: string;

  @Column({
    name: 'fecha_reconocimiento',
    nullable: true
  })
  acknowledgedAt: Date;

  @Column({
    name: 'resuelta_por',
    nullable: true,
    comment: 'ID del usuario que resolvió la alerta'
  })
  resolvedBy: string;

  @Column({
    name: 'fecha_resolucion',
    nullable: true
  })
  resolvedAt: Date;

  @Column({
    name: 'notas',
    nullable: true
  })
  notes: string;

  @CreateDateColumn({
    name: 'fecha_creacion'
  })
  createdAt: Date;

  @UpdateDateColumn({
    name: 'fecha_actualizacion'
  })
  updatedAt: Date;

  // Relaciones
  @ManyToOne(() => Tank, (tank) => tank.alerts)
  @JoinColumn({ name: 'tanque_id' })
  tank: Tank;
}