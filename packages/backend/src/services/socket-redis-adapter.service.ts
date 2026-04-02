import { Server as SocketIOServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { logger } from '../utils/logger';

export class SocketRedisAdapterService {
  private pubClient: any;
  private subClient: any;
  private adapter: any;

  constructor() {
    this.initializeClients();
  }

  private initializeClients(): void {
    try {
      // Create Redis clients for adapter
      this.pubClient = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        socket: {
          reconnectStrategy: (retries: number) => {
            if (retries > 10) {
              logger.error('Redis adapter reconnect failed after 10 attempts');
              return false;
            }
            return Math.min(retries * 100, 3000);
          }
        }
      });

      this.subClient = this.pubClient.duplicate();

      // Error handling
      this.pubClient.on('error', (err: any) => {
        logger.error('Redis adapter pub client error:', err);
      });

      this.subClient.on('error', (err: any) => {
        logger.error('Redis adapter sub client error:', err);
      });

      this.pubClient.on('connect', () => {
        logger.info('Redis adapter pub client connected');
      });

      this.subClient.on('connect', () => {
        logger.info('Redis adapter sub client connected');
      });

    } catch (error) {
      logger.error('Failed to initialize Redis adapter clients:', error);
      throw error;
    }
  }

  async connect(): Promise<void> {
    try {
      await Promise.all([
        this.pubClient.connect(),
        this.subClient.connect()
      ]);
      
      logger.info('Redis adapter clients connected successfully');
    } catch (error) {
      logger.error('Failed to connect Redis adapter clients:', error);
      throw error;
    }
  }

  createAdapter(io: SocketIOServer): any {
    try {
      this.adapter = createAdapter(this.pubClient, this.subClient, {
        // Adapter configuration
        requestsTimeout: 5000,
        ackTimeout: 10000,
        
        // Custom error handling
        onError: (err: any) => {
          logger.error('Socket.io Redis adapter error:', err);
        }
      });

      io.adapter(this.adapter);
      
      logger.info('Socket.io Redis adapter created successfully');
      return this.adapter;
    } catch (error) {
      logger.error('Failed to create Socket.io Redis adapter:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await Promise.all([
        this.pubClient.quit(),
        this.subClient.quit()
      ]);
      
      logger.info('Redis adapter clients disconnected');
    } catch (error) {
      logger.error('Error disconnecting Redis adapter clients:', error);
    }
  }

  // Health check for adapter
  async healthCheck(): Promise<{ status: string; pubConnected: boolean; subConnected: boolean }> {
    try {
      const pubStatus = this.pubClient.isOpen;
      const subStatus = this.subClient.isOpen;

      return {
        status: pubStatus && subStatus ? 'healthy' : 'unhealthy',
        pubConnected: pubStatus,
        subConnected: subStatus
      };
    } catch (error) {
      logger.error('Redis adapter health check failed:', error);
      return {
        status: 'unhealthy',
        pubConnected: false,
        subConnected: false
      };
    }
  }

  // Get adapter statistics
  async getStats(): Promise<any> {
    try {
      const info = await this.pubClient.info('memory');
      const clients = await this.pubClient.info('clients');
      
      return {
        memory: this.parseRedisInfo(info),
        clients: this.parseRedisInfo(clients),
        adapterConfig: {
          requestsTimeout: 5000,
          ackTimeout: 10000
        }
      };
    } catch (error) {
      logger.error('Failed to get Redis adapter stats:', error);
      return null;
    }
  }

  private parseRedisInfo(info: string): Record<string, any> {
    const lines = info.split('\r\n');
    const result: Record<string, any> = {};
    
    for (const line of lines) {
      if (line && !line.startsWith('#')) {
        const [key, value] = line.split(':');
        if (key && value) {
          result[key] = isNaN(Number(value)) ? value : Number(value);
        }
      }
    }
    
    return result;
  }

  // Custom broadcast with error handling
  async safeBroadcast(io: SocketIOServer, event: string, data: any): Promise<boolean> {
    try {
      const health = await this.healthCheck();
      
      if (health.status !== 'healthy') {
        logger.warn('Redis adapter unhealthy, falling back to local broadcast');
        io.local.emit(event, data);
        return false;
      }

      io.emit(event, data);
      return true;
    } catch (error) {
      logger.error('Failed to broadcast via Redis adapter:', error);
      io.local.emit(event, data);
      return false;
    }
  }

  // Custom room operations with error handling
  async safeRoomOperation(
    operation: 'join' | 'leave',
    io: SocketIOServer,
    room: string,
    socketId?: string
  ): Promise<boolean> {
    try {
      const health = await this.healthCheck();
      
      if (health.status !== 'healthy') {
        logger.warn('Redis adapter unhealthy, skipping room operation');
        return false;
      }

      if (operation === 'join' && socketId) {
        io.in(socketId).socketsJoin(room);
      } else if (operation === 'leave' && socketId) {
        io.in(socketId).socketsLeave(room);
      }

      return true;
    } catch (error) {
      logger.error(`Failed room operation ${operation}:`, error);
      return false;
    }
  }

  // Get connected servers count (for load balancing)
  async getConnectedServers(): Promise<number> {
    try {
      // This is a simplified implementation
      // In production, you might want to track this more carefully
      const servers = await this.pubClient.keys('socket.io:*');
      return servers.length;
    } catch (error) {
      logger.error('Failed to get connected servers count:', error);
      return 1; // Assume at least this server
    }
  }

  // Graceful shutdown
  async shutdown(): Promise<void> {
    logger.info('Shutting down Redis adapter service...');
    
    try {
      await this.disconnect();
      logger.info('Redis adapter service shut down successfully');
    } catch (error) {
      logger.error('Error during Redis adapter shutdown:', error);
    }
  }
}

export const socketRedisAdapterService = new SocketRedisAdapterService();
