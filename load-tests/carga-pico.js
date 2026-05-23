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
    fondo: {
      executor: 'constant-arrival-rate',
      rate: Math.floor(limites.throughputTotal * 0.8),
      timeUnit: '1s',
      duration: '2m',
      preAllocatedVUs: 10,
      maxVUs: 30,
      tags: { fase: 'fondo' },
    },

    pico: {
      executor: 'constant-arrival-rate',
      rate: Math.ceil(limites.throughputTotal * 10),
      timeUnit: '1s',
      duration: '10s',
      startTime: '30s',  
      preAllocatedVUs: 100,
      maxVUs: 300,
      tags: { fase: 'pico' },
    },
  },
};

export function setup() {
  const tasaFondo = Math.floor(limites.throughputTotal * 0.8);
  const tasaPico  = Math.ceil(limites.throughputTotal * 10);
  console.log(`
┌─────────────────────────────────────────────────────┐
│              TEST: PICO SÚBITO (SPIKE)              │
│  Pregunta: ¿sobrevive a un burst repentino?         │
├─────────────────────────────────────────────────────┤
│  Throughput sistema : ${limites.throughputTotal.toFixed(3)} jobs/s               │
│  Carga de fondo     : ${String(tasaFondo).padEnd(6)} req/s (80% capacidad) │
│  Carga del pico     : ${String(tasaPico).padEnd(6)} req/s (10× capacidad) │
│  Duración del pico  : 10 segundos (arranca en t=30s)│
│                                                     │
│  Lo que buscamos:                                   │
│  ✓ 0 errores 500 en todo el test                   │
│  ✓ Diferidos durante el pico → normal               │
│  ✓ Rechazos durante el pico → aceptable             │
│  ✓ Recuperación tras el pico → crítico              │
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
│                RESULTADO SPIKE                      │
├─────────────────────────────────────────────────────┤
│  Rechazos durante el pico   → esperado (load shed)  │
│  Rechazos DESPUÉS del pico  → problema grave ✗      │
│  0 errores 500 en todo el test → sistema robusto ✓  │
└─────────────────────────────────────────────────────┘
`;
  return { stdout: textSummary(data, { indent: ' ', enableColors: true }) + resumen };
}