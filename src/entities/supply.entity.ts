import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Tank } from './tank.entity';

export enum SupplyStatus {
  COMPLETED = 'completed',
  PENDING = 'pending',
  CANCELLED = 'cancelled',
}

@Entity('suministros')
export class Supply {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    name: 'cantidad_litros',
    type: 'float',
    comment: 'Cantidad suministrada en litros'
  })
  quantityLiters: number;

  @Column({
    name: 'nivel_anterior',
    type: 'float',
    comment: 'Nivel antes del suministro'
  })
  previousLevel: number;

  @Column({
    name: 'nivel_actual',
    type: 'float',
    comment: 'Nivel después del suministro'
  })
  currentLevel: number;

  @Column({
    name: 'fecha_suministro'
  })
  supplyDate: Date;

  @Column({
    name: 'estado',
    type: 'enum',
    enum: SupplyStatus,
    default: SupplyStatus.PENDING,
  })
  status: SupplyStatus;

  @Column({
    name: 'notas',
    nullable: true
  })
  notes: string;

  @Column({
    name: 'numero_factura',
    nullable: true,
    comment: 'Número de factura o comprobante'
  })
  invoiceNumber: string;

  @Column({
    name: 'costo',
    type: 'float',
    nullable: true,
    comment: 'Costo del suministro'
  })
  cost: number;

  @CreateDateColumn({
    name: 'fecha_creacion'
  })
  createdAt: Date;

  @UpdateDateColumn({
    name: 'fecha_actualizacion'
  })
  updatedAt: Date;

  // Relaciones
  @ManyToOne(() => Tank, (tank) => tank.supplies)
  @JoinColumn({ name: 'tanque_id' })
  tank: Tank;

  @ManyToOne(() => User, (user) => user.suppliesAsEmployee)
  @JoinColumn({ name: 'empleado_id' })
  employee: User; // Empleado que realizó el suministro
}