import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { LogNotificationStrategy } from './strategies/log-notification.strategy';
import { WebSocketNotificationStrategy } from './strategies/websocket-notification.strategy';
import { NotificationPayload } from './notification-strategy.interface';

const BASE_PAYLOAD: NotificationPayload = {
  userId: 'user-1',
  title: 'Título de prueba',
  message: 'Mensaje de prueba',
};

describe('NotificationsService', () => {
  let service: NotificationsService;

  const mockLogStrategy = { name: 'LOG_MOCK', send: jest.fn() };
  const mockWsStrategy = { name: 'WEBSOCKET', send: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockLogStrategy.send.mockResolvedValue(undefined);
    mockWsStrategy.send.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: LogNotificationStrategy, useValue: mockLogStrategy },
        { provide: WebSocketNotificationStrategy, useValue: mockWsStrategy },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  it('usa LogNotificationStrategy cuando deferred=true', async () => {
    await service.enviarNotificacion(BASE_PAYLOAD, true);

    expect(mockLogStrategy.send).toHaveBeenCalledWith(BASE_PAYLOAD);
    expect(mockWsStrategy.send).not.toHaveBeenCalled();
  });

  it('usa WebSocketNotificationStrategy cuando deferred=false', async () => {
    await service.enviarNotificacion(BASE_PAYLOAD, false);

    expect(mockWsStrategy.send).toHaveBeenCalledWith(BASE_PAYLOAD);
    expect(mockLogStrategy.send).not.toHaveBeenCalled();
  });

  it('propaga el payload completo a la estrategia seleccionada', async () => {
    const payload: NotificationPayload = {
      ...BASE_PAYLOAD,
      jobId: 'job-42',
      txHash: '0xabc',
      status: 'completed',
    };

    await service.enviarNotificacion(payload, false);

    expect(mockWsStrategy.send).toHaveBeenCalledWith(payload);
  });

  it('propaga errores lanzados por la estrategia', async () => {
    mockLogStrategy.send.mockRejectedValue(new Error('Fallo de estrategia'));

    await expect(
      service.enviarNotificacion(BASE_PAYLOAD, true),
    ).rejects.toThrow('Fallo de estrategia');
  });
});
