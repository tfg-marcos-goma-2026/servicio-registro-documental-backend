import http from 'k6/http';
import { check } from 'k6';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.2/index.js';
import {
  metricNormal, metricDiferido, metricRechazado,
  generarHashFalso, registrarRespuesta, leerConfig, calcularLimites,
} from './lib/helpers.js';

const cfg     = leerConfig();
const limites = calcularLimites(cfg);

export const options = {
  scenarios: {
    avalancha: {
      executor: 'constant-arrival-rate',
      rate: 10,
      timeUnit: '1s',
      duration: '60s',
      preAllocatedVUs: 20,
      maxVUs: 150,
    },
  },
};

export function setup() {
  console.log(`
┌─────────────────────────────────────────────────────┐
│              TEST: CARGA SOSTENIDA                  │
│  Pregunta: ¿cuánto aguanta a ritmo constante?       │
├─────────────────────────────────────────────────────┤
│  Workers: ${String(cfg.WORKERS).padEnd(6)} × ${String(limites.totalMs).padEnd(6)} ms/job            │
│  Throughput total : ${limites.throughputTotal.toFixed(3).padEnd(6)} jobs/s               │
│  Tasa de entrada  : 10 req/s                        │
│  Saturación en    : ~${Math.ceil(limites.optimalExtreme / (10 - limites.throughputTotal))} segundos                    │
├─────────────────────────────────────────────────────┤
│  LÍMITES RECOMENDADOS                               │
│  QUEUE_HIGH_LOAD_LIMIT    = ${String(limites.optimalHigh).padEnd(24)}│
│  QUEUE_EXTREME_LOAD_LIMIT = ${String(limites.optimalExtreme).padEnd(24)}│
└─────────────────────────────────────────────────────┘
  `);
}

export default function () {
  const res = http.post(
    `${cfg.BASE_URL}/api/v1/documents/register`,
    JSON.stringify({ hash: generarHashFalso() }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  check(res, { 'no hay 500': r => r.status !== 500 });
  registrarRespuesta(res);
}

export function handleSummary(data) {
  const resumen = `
┌─────────────────────────────────────────────────────┐
│         RECOMENDACIÓN: copia esto en tu .env        │
├─────────────────────────────────────────────────────┤
│  # ${cfg.WORKERS} workers × (Vault=${cfg.VAULT_MS}ms + Blockchain=${cfg.BLOCKCHAIN_MS}ms)
│  # Throughput total: ${limites.throughputTotal.toFixed(3)} jobs/s
│  QUEUE_HIGH_LOAD_LIMIT=${limites.optimalHigh}
│  QUEUE_EXTREME_LOAD_LIMIT=${limites.optimalExtreme}
│
│  (espera normal ≤ ${cfg.WAIT_HIGH_S}s | rechazo a partir de ${cfg.WAIT_EXTREME_S}s)
└─────────────────────────────────────────────────────┘
`;
  return { stdout: textSummary(data, { indent: ' ', enableColors: true }) + resumen };
}