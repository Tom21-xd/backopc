import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from '../../entities/user.entity';
import { SensorReading } from '../sensors/sensor-simulator.service';

// Extender Socket con propiedades adicionales sin sobrescribir métodos
type AuthenticatedSocket = Socket & {
  userId?: string;
  userRole?: UserRole;
  tankIds?: string[];
}

@WebSocketGateway({
  cors: {
    origin: '*', // En producción, especificar el dominio del frontend
    credentials: true,
  },
  namespace: 'monitoring',
})
export class MonitoringGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private logger = new Logger('MonitoringGateway');
  private connectedClients = new Map<string, AuthenticatedSocket>();

  constructor(
    private jwtService: JwtService,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');
  }

  async handleConnection(client: AuthenticatedSocket) {
    try {
      // Extraer token del header o query
      const token = this.extractToken(client);

      if (!token) {
        this.logger.error('No token provided');
        client.disconnect();
        return;
      }

      // Verificar JWT
      const payload = this.jwtService.verify(token);
      const user = await this.userRepository.findOne({
        where: { id: payload.sub },
        relations: ['tanks'],
      });

      if (!user) {
        this.logger.error('User not found');
        client.disconnect();
        return;
      }

      // Guardar información del usuario en el socket
      client.userId = user.id;
      client.userRole = user.role;
      client.tankIds = user.tanks?.map(tank => tank.id) || [];

      // Agregar cliente a la lista
      this.connectedClients.set(client.id, client);

      // Unir al cliente a rooms específicos de sus tanques
      if (user.role === UserRole.CLIENT) {
        // Los clientes solo se unen a sus propios tanques
        for (const tankId of client.tankIds) {
          client.join(`tank:${tankId}`);
        }
      } else {
        // Los admins se unen a todos los tanques
        client.join('admin:all');
      }

      this.logger.log(`Client connected: ${client.id} (User: ${user.email})`);

      // Enviar confirmación de conexión
      client.emit('connected', {
        message: 'Connected to monitoring system',
        userId: user.id,
        role: user.role,
        tankIds: client.tankIds
      });

    } catch (error) {
      this.logger.error('Authentication error:', error.message);
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    this.connectedClients.delete(client.id);
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  private extractToken(client: Socket): string | null {
    // Intentar extraer del objeto auth primero (socket.io v3+)
    const authToken = client.handshake.auth?.token;
    if (authToken) {
      return authToken;
    }

    // Intentar extraer de query params
    const queryToken = client.handshake.query.token;
    if (queryToken) {
      return Array.isArray(queryToken) ? queryToken[0] : queryToken;
    }

    // Intentar extraer del header authorization
    const authHeader = client.handshake.headers.authorization;
    if (authHeader) {
      return authHeader.replace('Bearer ', '');
    }

    return null;
  }

  // Escuchar eventos del sistema de sensores
  @OnEvent('sensor.reading')
  handleSensorReading(reading: SensorReading) {
    // Emitir a todos los clientes suscritos a ese tanque
    this.server.to(`tank:${reading.tankId}`).emit('tank:reading', reading);

    // Emitir a todos los admins
    this.server.to('admin:all').emit('tank:reading', reading);

    this.logger.debug(
      `Sensor reading emitted for tank ${reading.tankId}: ${reading.levelPercentage.toFixed(2)}%`,
    );
  }

  // Escuchar alertas
  @OnEvent('alert.lowLevel')
  handleLowLevelAlert(data: any) {
    const alert = {
      type: 'LOW_LEVEL',
      tankId: data.tank.id,
      levelPercentage: data.levelPercentage,
      threshold: data.threshold,
      timestamp: new Date(),
      message: `Nivel bajo detectado en tanque ${data.tank.code}: ${data.levelPercentage.toFixed(2)}%`
    };

    // Emitir alerta a los interesados
    this.server.to(`tank:${data.tank.id}`).emit('alert:low', alert);
    this.server.to('admin:all').emit('alert:low', alert);
  }

  @OnEvent('alert.criticalLevel')
  handleCriticalLevelAlert(data: any) {
    const alert = {
      type: 'CRITICAL_LEVEL',
      tankId: data.tank.id,
      levelPercentage: data.levelPercentage,
      threshold: data.threshold,
      timestamp: new Date(),
      message: `¡NIVEL CRÍTICO! Tanque ${data.tank.code}: ${data.levelPercentage.toFixed(2)}%`
    };

    // Emitir alerta crítica
    this.server.to(`tank:${data.tank.id}`).emit('alert:critical', alert);
    this.server.to('admin:all').emit('alert:critical', alert);
  }

  // Suscripción manual a un tanque específico
  @SubscribeMessage('subscribe:tank')
  handleSubscribeToTank(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() tankId: string,
  ) {
    // Verificar permisos
    if (client.userRole === UserRole.ADMIN || client.tankIds?.includes(tankId)) {
      client.join(`tank:${tankId}`);
      client.emit('subscribed', { tankId, message: 'Subscribed to tank updates' });
      this.logger.log(`Client ${client.id} subscribed to tank ${tankId}`);
    } else {
      client.emit('error', { message: 'No permission to subscribe to this tank' });
    }
  }

  // Desuscripción de un tanque
  @SubscribeMessage('unsubscribe:tank')
  handleUnsubscribeFromTank(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() tankId: string,
  ) {
    client.leave(`tank:${tankId}`);
    client.emit('unsubscribed', { tankId, message: 'Unsubscribed from tank updates' });
    this.logger.log(`Client ${client.id} unsubscribed from tank ${tankId}`);
  }

  // Obtener estado de conexión
  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: AuthenticatedSocket) {
    client.emit('pong', { timestamp: new Date() });
  }
}