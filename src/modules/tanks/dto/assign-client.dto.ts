import { IsUUID, IsOptional } from 'class-validator';

export class AssignClientDto {
  @IsUUID('4', { message: 'El ID del cliente debe ser un UUID válido' })
  @IsOptional()
  clientId?: string; // Puede ser null para desasignar
}
