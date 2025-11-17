import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Tank } from './tank.entity';

export enum SensorStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

@Entity('sensores')
export class Sensor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    name: 'numero_serie',
    unique: true,
    comment: 'Número de serie del sensor'
  })
  serialNumber: string;

  @Column({
    name: 'estado',
    type: 'enum',
    enum: SensorStatus,
    default: SensorStatus.ACTIVE,
  })
  status: SensorStatus;

  @Column({
    name: 'ultima_lectura',
    type: 'float',
    nullable: true,
    comment: 'Última lectura en porcentaje'
  })
  lastReading: number;

  @Column({
    name: 'fecha_ultima_lectura',
    nullable: true
  })
  lastReadingDate: Date;

  @CreateDateColumn({
    name: 'fecha_creacion'
  })
  createdAt: Date;

  @UpdateDateColumn({
    name: 'fecha_actualizacion'
  })
  updatedAt: Date;

  // Relaciones
  @OneToOne(() => Tank, (tank) => tank.sensor)
  @JoinColumn({ name: 'tanque_id' })
  tank: Tank;
}