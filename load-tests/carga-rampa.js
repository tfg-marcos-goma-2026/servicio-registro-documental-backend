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
    rampa: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      stages: [
        { duration: '45s', target: Math.ceil(limites.throughputTotal * 3) },
        { duration: '30s', target: Math.ceil(limites.throughputTotal * 3) }, 
        { duration: '45s', target: 1 },                                      
      ],
      preAllocatedVUs: 20,
      maxVUs: 200,
    },
  },
};

export function setup() {
  console.log(`
┌─────────────────────────────────────────────────────┐
│              TEST: RAMPA PROGRESIVA                 │
│  Pregunta: ¿en qué punto exacto se degrada?         │
├─────────────────────────────────────────────────────┤
│  Throughput sistema : ${limites.throughputTotal.toFixed(3)} jobs/s               │
│  Pico de la rampa   : ${Math.ceil(limites.throughputTotal * 3)} req/s (3× capacidad)      │
│  Fase bajada        : verifica autorrecuperación    │
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
│                 RESULTADO RAMPA                     │
├─────────────────────────────────────────────────────┤
│  Observa en qué segundo aparecieron los primeros    │
│  diferidos y los primeros rechazos: esos son tus   │
│  umbrales reales de degradación.                   │
│                                                     │
│  Si la fase de bajada no tuvo rechazos, el sistema  │
│  se autorrecupera correctamente. ✓                  │
└─────────────────────────────────────────────────────┘
`;
  return { stdout: textSummary(data, { indent: ' ', enableColors: true }) + resumen };
}