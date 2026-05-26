import http from 'k6/http';
import { check } from 'k6';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.2/index.js';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import {
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
  return {
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
    '/reports/reporte-pico.html': htmlReport(data, { title: 'Test de Carga: Pico Súbito' }),
    '/reports/resumen-pico.json': JSON.stringify(data, null, 2),
  };
}