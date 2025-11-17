import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Tank } from './tank.entity';
import { Supply } from './supply.entity';

export enum UserRole {
  ADMIN = 'admin', // Empresa
  CLIENT = 'client', // Cliente
}

@Entity('usuarios')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    name: 'correo_electronico',
    unique: true
  })
  email: string;

  @Column({
    name: 'contrasena'
  })
  password: string;

  @Column({
    name: 'nombre'
  })
  firstName: string;

  @Column({
    name: 'apellido'
  })
  lastName: string;

  @Column({
    name: 'telefono',
    nullable: true
  })
  phone: string;

  @Column({
    name: 'tipo_identificacion',
    nullable: true
  })
  identificationType: string;

  @Column({
    name: 'numero_identificacion',
    nullable: true
  })
  identificationNumber: string;

  @Column({
    name: 'empresa',
    nullable: true
  })
  company: string;

  @Column({
    name: 'direccion',
    nullable: true
  })
  address: string;

  @Column({
    name: 'rol',
    type: 'enum',
    enum: UserRole,
    default: UserRole.CLIENT,
  })
  role: UserRole;

  @Column({
    name: 'activo',
    default: true
  })
  isActive: boolean;

  @CreateDateColumn({
    name: 'fecha_creacion'
  })
  createdAt: Date;

  @UpdateDateColumn({
    name: 'fecha_actualizacion'
  })
  updatedAt: Date;

  // Relaciones
  @OneToMany(() => Tank, (tank) => tank.client)
  tanks: Tank[];

  @OneToMany(() => Supply, (supply) => supply.employee)
  suppliesAsEmployee: Supply[];

  // Métodos
  @BeforeInsert()
  @BeforeUpdate()
  async hashPassword() {
    if (this.password && !this.password.startsWith('$2b$')) {
      this.password = await bcrypt.hash(this.password, 10);
    }
  }

  async comparePassword(password: string): Promise<boolean> {
    return bcrypt.compare(password, this.password);
  }
}