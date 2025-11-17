import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  OneToOne,
} from 'typeorm';
import { User } from './user.entity';
import { Tank } from './tank.entity';
import { ClientPreferences } from './client-preferences.entity';

export enum IdentificationType {
  CEDULA = 'cedula',
  NIT = 'nit',
  PASAPORTE = 'pasaporte',
  EXTRANJERIA = 'extranjeria',
}

@Entity('clientes')
export class Client {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    name: 'nombre_empresa',
    type: 'varchar',
    length: 255,
    nullable: true,
    comment: 'Nombre de la empresa (opcional)'
  })
  companyName: string;

  @Column({
    name: 'nombre',
    type: 'varchar',
    length: 100
  })
  firstName: string;

  @Column({
    name: 'apellido',
    type: 'varchar',
    length: 100
  })
  lastName: string;

  @Column({
    name: 'tipo_identificacion',
    type: 'enum',
    enum: IdentificationType,
    default: IdentificationType.CEDULA,
  })
  identificationType: IdentificationType;

  @Column({
    name: 'numero_identificacion',
    type: 'varchar',
    length: 50,
    unique: true
  })
  identificationNumber: string;

  @Column({
    name: 'correo_electronico',
    type: 'varchar',
    length: 255,
    unique: true
  })
  email: string;

  @Column({
    name: 'correo_notificaciones',
    type: 'varchar',
    length: 255,
    nullable: true
  })
  notificationEmail: string;

  @Column({
    name: 'telefono',
    type: 'varchar',
    length: 50,
    nullable: true
  })
  phone: string;

  @Column({
    name: 'direccion',
    type: 'varchar',
    length: 500,
    nullable: true
  })
  address: string;

  @Column({
    name: 'activo',
    type: 'boolean',
    default: true
  })
  isActive: boolean;

  @Column({
    name: 'umbral_gas_bajo',
    type: 'int',
    default: 20,
    comment: 'Porcentaje para alerta de nivel bajo'
  })
  lowGasThreshold: number;

  @Column({
    name: 'umbral_gas_critico',
    type: 'int',
    default: 10,
    comment: 'Porcentaje para alerta de nivel crítico'
  })
  criticalGasThreshold: number;

  @CreateDateColumn({
    name: 'fecha_creacion'
  })
  createdAt: Date;

  @UpdateDateColumn({
    name: 'fecha_actualizacion'
  })
  updatedAt: Date;

  // Relations
  @OneToMany(() => Tank, (tank) => tank.client)
  tanks: Tank[];

  @OneToOne(() => ClientPreferences, (preferences) => preferences.cliente, {
    cascade: true,
    eager: true,
  })
  preferences: ClientPreferences;
}