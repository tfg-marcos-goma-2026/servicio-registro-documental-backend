import { Test, TestingModule } from '@nestjs/testing';
import { DocumentsGateway } from './documents.gateway';
import { Server, Socket } from 'socket.io';

describe('DocumentsGateway', () => {
  let gateway: DocumentsGateway;
  let mockServer: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DocumentsGateway],
    }).compile();

    gateway = module.get<DocumentsGateway>(DocumentsGateway);

    mockServer = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    };
    gateway.server = mockServer as unknown as Server;
  });

  it('debe estar definido', () => {
    expect(gateway).toBeDefined();
  });

  it('debe permitir a un cliente unirse a la sala exclusiva de un job', async () => {
    const mockClient = {
      id: 'socket-id-123',
      join: jest.fn().mockResolvedValue(undefined),
    } as unknown as Socket;

    await gateway.handleJoinJob(mockClient, { jobId: '456' });

    expect(mockClient.join).toHaveBeenCalledWith('job-456');
  });

  it('debe emitir el evento de exito a la sala correspondiente', () => {
    gateway.emitJobSuccess('456', '0xTxHash');

    expect(mockServer.to).toHaveBeenCalledWith('job-456');
    expect(mockServer.emit).toHaveBeenCalledWith('job-status', {
      status: 'completed',
      txHash: '0xTxHash',
    });
  });

  it('debe emitir el evento de error a la sala correspondiente', () => {
    gateway.emitJobFailed('456', 'Error criptografico');

    expect(mockServer.to).toHaveBeenCalledWith('job-456');
    expect(mockServer.emit).toHaveBeenCalledWith('job-status', {
      status: 'failed',
      error: 'Error criptografico',
    });
  });
});