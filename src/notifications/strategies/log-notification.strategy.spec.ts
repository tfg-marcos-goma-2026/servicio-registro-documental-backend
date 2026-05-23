import { LogNotificationStrategy } from './log-notification.strategy';
import { NotificationPayload } from '../notification-strategy.interface';

describe('LogNotificationStrategy', () => {
  let strategy: LogNotificationStrategy;

  beforeEach(() => {
    strategy = new LogNotificationStrategy();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('tiene el nombre correcto', () => {
    expect(strategy.name).toBe('LOG_MOCK');
  });

  it('resuelve sin errores', async () => {
    const payload: NotificationPayload = {
      userId: 'user-1',
      title: 'Asunto',
      message: 'Cuerpo del mensaje',
    };

    await expect(strategy.send(payload)).resolves.toBeUndefined();
  });

  it('imprime el userId, title y message del payload', async () => {
    const payload: NotificationPayload = {
      userId: 'user-99',
      title: 'Registro completado',
      message: 'TxHash: 0xabc',
    };

    await strategy.send(payload);

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('user-99'),
    );
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Registro completado'),
    );
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('TxHash: 0xabc'),
    );
  });
});
