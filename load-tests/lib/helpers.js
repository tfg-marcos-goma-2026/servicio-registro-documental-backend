import { Counter } from 'k6/metrics';

export const metricNormal    = new Counter('estado_normal_pending');
export const metricDiferido  = new Counter('estado_diferido_deferred');
export const metricRechazado = new Counter('estado_saturado_overloaded');
export const metricThrottled = new Counter('estado_rate_limit_429');
export const metricError5xx  = new Counter('error_5xx_unexpected'); 

export function generarHashFalso() {
  const chars = '0123456789abcdef';
  let hash = '0x';
  for (let i = 0; i < 64; i++) hash += chars[Math.floor(Math.random() * 16)];
  return hash;
}

export function registrarRespuesta(res) {
  if (res.status === 429) { metricThrottled.add(1); return; }
  if (res.status === 503) { metricRechazado.add(1); return; }
  if (res.status >= 500)  { metricError5xx.add(1);  return; } 
  if (res.status > 0) {
    try {
      const body = res.json();
      if (body.status === 'pending')  metricNormal.add(1);
      if (body.status === 'deferred') metricDiferido.add(1);
    } catch (_) {}
  }
}

export function leerConfig() {
  return {
    VAULT_MS:       parseInt(__ENV.VAULT_MOCK_LATENCY_MS      || '200'),
    BLOCKCHAIN_MS:  parseInt(__ENV.BLOCKCHAIN_MOCK_LATENCY_MS || '2000'),
    WORKERS:        parseInt(__ENV.WORKER_CONCURRENCY         || '5'),
    WAIT_HIGH_S:    parseInt(__ENV.WAIT_HIGH_SEC              || '30'),
    WAIT_EXTREME_S: parseInt(__ENV.WAIT_EXTREME_SEC           || '120'),
    BASE_URL:       __ENV.BASE_URL || 'http://localhost:3000',
  };
}

export function calcularLimites(cfg) {
  const totalMs         = cfg.VAULT_MS + cfg.BLOCKCHAIN_MS;
  const throughputTotal = cfg.WORKERS * (1000 / totalMs);
  return {
    totalMs,
    throughputTotal,
    optimalHigh:    Math.ceil(cfg.WAIT_HIGH_S    * throughputTotal),
    optimalExtreme: Math.ceil(cfg.WAIT_EXTREME_S * throughputTotal),
  };
}