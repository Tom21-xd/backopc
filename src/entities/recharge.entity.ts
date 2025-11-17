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
import { User } from './user.entity';

export enum RechargeStatus {
  SCHEDULED = 'scheduled',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  RESCHEDULED = 'rescheduled',
}

export enum RechargeRequestedBy {
  CLIENT = 'client',
  SYSTEM = 'system', // Automático por nivel bajo
  ADMIN = 'admin',
}

@Entity('recargas')
export class Recharge {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    name: 'fecha_programada'
  })
  scheduledDate: Date;

  @Column({
    name: 'fecha_completada',
    nullable: true
  })
  completedDate: Date;

  @Column({
    name: 'cantidad_estimada_litros',
    type: 'float',
    nullable: true,
    comment: 'Cantidad estimada necesaria'
  })
  estimatedQuantityLiters: number;

  @Column({
    name: 'cantidad_real_litros',
    type: 'float',
    nullable: true,
    comment: 'Cantidad real suministrada'
  })
  actualQuantityLiters: number;

  @Column({
    name: 'estado',
    type: 'enum',
    enum: RechargeStatus,
    default: RechargeStatus.SCHEDULED,
  })
  status: RechargeStatus;

  @Column({
    name: 'solicitado_por',
    type: 'enum',
    enum: RechargeRequestedBy,
    default: RechargeRequestedBy.CLIENT,
  })
  requestedBy: RechargeRequestedBy;

  @Column({
    name: 'solicitado_por_id',
    nullable: true,
    comment: 'ID del usuario que solicitó'
  })
  requestedById: string;

  @Column({
    name: 'empleado_asignado_id',
    nullable: true,
    comment: 'ID del empleado asignado'
  })
  assignedEmployeeId: string;

  @Column({
    name: 'fecha_programada_anterior',
    nullable: true,
    comment: 'Fecha anterior si fue reprogramada'
  })
  previousScheduledDate: Date;

  @Column({
    name: 'razon_reprogramacion',
    nullable: true
  })
  rescheduledReason: string;

  @Column({
    name: 'razon_cancelacion',
    nullable: true
  })
  cancellationReason: string;

  @Column({
    name: 'notas',
    nullable: true
  })
  notes: string;

  @Column({
    name: 'notificacion_enviada',
    default: false
  })
  notificationSent: boolean;

  @Column({
    name: 'fecha_notificacion',
    nullable: true
  })
  notificationSentAt: Date;

  @CreateDateColumn({
    name: 'fecha_creacion'
  })
  createdAt: Date;

  @UpdateDateColumn({
    name: 'fecha_actualizacion'
  })
  updatedAt: Date;

  // Relaciones
  @ManyToOne(() => Tank, (tank) => tank.recharges)
  @JoinColumn({ name: 'tanque_id' })
  tank: Tank;
}