import { WebSocketNotificationStrategy } from './websocket-notification.strategy';
import { NotificationPayload } from '../notification-strategy.interface';

describe('WebSocketNotificationStrategy', () => {
  let strategy: WebSocketNotificationStrategy;

  const mockEmit = jest.fn();
  const mockTo = jest.fn().mockReturnValue({ emit: mockEmit });
  const mockServer = { to: mockTo };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    strategy = new WebSocketNotificationStrategy();
    strategy.server = mockServer as never;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('tiene el nombre correcto', () => {
    expect(strategy.name).toBe('WEBSOCKET');
  });

  it('emite job-status completed con txHash a la sala correcta', async () => {
    const payload: NotificationPayload = {
      userId: 'user-1',
      title: 'Completado',
      message: 'Ok',
      jobId: 'job-42',
      txHash: '0xabc',
      status: 'completed',
    };

    await strategy.send(payload);

    expect(mockTo).toHaveBeenCalledWith('job-job-42');
    expect(mockEmit).toHaveBeenCalledWith('job-status', {
      status: 'completed',
      txHash: '0xabc',
    });
  });

  it('emite job-status failed con error a la sala correcta', async () => {
    const payload: NotificationPayload = {
      userId: 'user-1',
      title: 'Fallo',
      message: 'Error',
      jobId: 'job-42',
      error: 'Error en la red blockchain',
      status: 'failed',
    };

    await strategy.send(payload);

    expect(mockTo).toHaveBeenCalledWith('job-job-42');
    expect(mockEmit).toHaveBeenCalledWith('job-status', {
      status: 'failed',
      error: 'Error en la red blockchain',
    });
  });

  it('no emite nada si falta jobId y lanza warn', async () => {
    const payload: NotificationPayload = {
      userId: 'user-1',
      title: 'Sin jobId',
      message: 'Ok',
      status: 'completed',
    };

    await strategy.send(payload);

    expect(mockTo).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalled();
  });

  it('no emite nada si falta status y lanza warn', async () => {
    const payload: NotificationPayload = {
      userId: 'user-1',
      title: 'Sin status',
      message: 'Ok',
      jobId: 'job-42',
    };

    await strategy.send(payload);

    expect(mockTo).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalled();
  });

  it('no emite nada si status=completed pero falta txHash', async () => {
    const payload: NotificationPayload = {
      userId: 'user-1',
      title: 'Sin txHash',
      message: 'Ok',
      jobId: 'job-42',
      status: 'completed',
    };

    await strategy.send(payload);

    expect(mockEmit).not.toHaveBeenCalled();
  });

  it('no emite nada si status=failed pero falta error', async () => {
    const payload: NotificationPayload = {
      userId: 'user-1',
      title: 'Sin error',
      message: 'Ok',
      jobId: 'job-42',
      status: 'failed',
    };

    await strategy.send(payload);

    expect(mockEmit).not.toHaveBeenCalled();
  });

  it('resuelve siempre como Promise<void>', async () => {
    const payload: NotificationPayload = {
      userId: 'user-1',
      title: 'Test',
      message: 'Ok',
      jobId: 'job-1',
      txHash: '0x1',
      status: 'completed',
    };

    await expect(strategy.send(payload)).resolves.toBeUndefined();
  });
});
