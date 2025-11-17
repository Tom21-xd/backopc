import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Sensor } from './sensor.entity';
import { Supply } from './supply.entity';
import { Alert } from './alert.entity';
import { MonitoringHistory } from './monitoring-history.entity';
import { Recharge } from './recharge.entity';

export enum TankStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

export enum TankType {
  COMPANY = 'company', // Tanque principal de la empresa
  CLIENT = 'client',   // Tanque del cliente
}

@Entity('tanques')
export class Tank {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    name: 'codigo',
    unique: true,
    comment: 'Código único del tanque'
  })
  code: string;

  @Column({
    name: 'tipo',
    type: 'enum',
    enum: TankType,
    default: TankType.CLIENT,
    comment: 'Tipo de tanque (empresa o cliente)'
  })
  type: TankType;

  @Column({
    name: 'capacidad_litros',
    type: 'float',
    comment: 'Capacidad en litros'
  })
  capacityLiters: number;

  @Column({
    name: 'nivel_actual_litros',
    type: 'float',
    default: 0,
    comment: 'Nivel actual en litros'
  })
  currentLevelLiters: number;

  @Column({
    name: 'nivel_actual_porcentaje',
    type: 'float',
    default: 0,
    comment: 'Nivel actual en porcentaje'
  })
  currentLevelPercentage: number;

  @Column({
    name: 'estado',
    type: 'enum',
    enum: TankStatus,
    default: TankStatus.ACTIVE,
  })
  status: TankStatus;

  @Column({
    name: 'ubicacion',
    nullable: true,
    comment: 'Dirección o ubicación del tanque'
  })
  location: string;

  @Column({
    name: 'consumo_diario',
    type: 'float',
    default: 0,
    comment: 'Consumo promedio diario en litros'
  })
  dailyConsumption: number;

  @Column({
    name: 'fecha_ultima_recarga',
    nullable: true
  })
  lastRechargeDate: Date;

  @Column({
    name: 'cantidad_ultima_recarga',
    type: 'float',
    nullable: true,
    comment: 'Cantidad de la última recarga en litros'
  })
  lastRechargeAmount: number;

  @CreateDateColumn({
    name: 'fecha_creacion'
  })
  createdAt: Date;

  @UpdateDateColumn({
    name: 'fecha_actualizacion'
  })
  updatedAt: Date;

  // Relaciones
  @ManyToOne(() => User, (user) => user.tanks, { eager: true, nullable: true })
  @JoinColumn({ name: 'cliente_id' })
  client: User; // Usuario cliente propietario del tanque (solo para tanques tipo CLIENT)

  @OneToOne(() => Sensor, (sensor) => sensor.tank, {
    cascade: true,
    eager: true
  })
  sensor: Sensor;

  @OneToMany(() => Supply, (supply) => supply.tank)
  supplies: Supply[];

  @OneToMany(() => Alert, (alert) => alert.tank)
  alerts: Alert[];

  @OneToMany(() => MonitoringHistory, (history) => history.tank)
  monitoringHistory: MonitoringHistory[];

  @OneToMany(() => Recharge, (recharge) => recharge.tank)
  recharges: Recharge[];
}