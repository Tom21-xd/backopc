import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Tank } from './tank.entity';

@Entity('historial_monitoreo')
export class MonitoringHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    name: 'nivel_gas_porcentaje',
    type: 'float',
    comment: 'Nivel de gas en porcentaje'
  })
  gasLevelPercentage: number;

  @Column({
    name: 'nivel_gas_litros',
    type: 'float',
    comment: 'Nivel de gas en litros'
  })
  gasLevelLiters: number;

  @CreateDateColumn({
    name: 'fecha_registro',
    comment: 'Momento de la medición'
  })
  recordedAt: Date;

  // Relaciones
  @ManyToOne(() => Tank, (tank) => tank.monitoringHistory)
  @JoinColumn({ name: 'tanque_id' })
  tank: Tank;
}