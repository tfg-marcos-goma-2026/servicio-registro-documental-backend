import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class DocumentsGateway {
  @WebSocketServer()
  server!: Server;

  @SubscribeMessage('join-job')
  async handleJoinJob(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { jobId: string },
  ) {
    const room = `job-${data.jobId}`;
    await client.join(room);
    console.log(
      `[WebSocket] Cliente ${client.id} se ha unido a la sala: ${room}`,
    );
  }

  emitJobSuccess(jobId: string, txHash: string) {
    this.server.to(`job-${jobId}`).emit('job-status', {
      status: 'completed',
      txHash,
    });
  }

  emitJobFailed(jobId: string, error: string) {
    this.server.to(`job-${jobId}`).emit('job-status', {
      status: 'failed',
      error,
    });
  }
}
