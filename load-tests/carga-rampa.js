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
    '/reports/reporte-rampa.html': htmlReport(data, { title: 'Test de Carga: Rampa Progresiva' })
  };
}