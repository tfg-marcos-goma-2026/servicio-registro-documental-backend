import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPORTS_DIR = join(__dirname, 'reports');

function leerConfig() {
  return {
    VAULT_MS:           parseInt(process.env.VAULT_MOCK_LATENCY_MS      || '200'),
    BLOCKCHAIN_MS:      parseInt(process.env.BLOCKCHAIN_MOCK_LATENCY_MS  || '2000'),
    WORKERS:            parseInt(process.env.WORKER_CONCURRENCY          || '5'),
    WAIT_HIGH_S:        parseInt(process.env.WAIT_HIGH_SEC               || '30'),
    WAIT_EXTREME_S:     parseInt(process.env.WAIT_EXTREME_SEC            || '120'),
    HIGH_LOAD_LIMIT:    parseInt(process.env.QUEUE_HIGH_LOAD_LIMIT       || '0'),
    EXTREME_LOAD_LIMIT: parseInt(process.env.QUEUE_EXTREME_LOAD_LIMIT    || '0'),
  };
}

function calcularLimites(cfg) {
  const totalMs         = cfg.VAULT_MS + cfg.BLOCKCHAIN_MS;
  const throughputTotal = cfg.WORKERS * (1000 / totalMs);
  return {
    totalMs,
    throughputTotal,
    optimalHigh:    Math.ceil(cfg.WAIT_HIGH_S    * throughputTotal),
    optimalExtreme: Math.ceil(cfg.WAIT_EXTREME_S * throughputTotal),
  };
}

function cargarJSON(nombre) {
  const ruta = join(REPORTS_DIR, nombre);
  if (!existsSync(ruta)) {
    console.error(`\nNo se encontró: ${ruta}`);
    process.exit(1);
  }
  return JSON.parse(readFileSync(ruta, 'utf8'));
}

function metrica(data, clave) { return data.metrics?.[clave] ?? null; }
function count(m)              { return m?.values?.count ?? null; }
function pct(m, percentil)     { return m?.values?.[`p(${percentil})`] ?? null; }
function porcentaje(p, t)      { return t ? ((p / t) * 100).toFixed(2) : '0.00'; }
function ok(condicion)         { return condicion ? '✅' : '❌'; }
function seccion(titulo) {
  console.log(`\n${'─'.repeat(60)}\n  ${titulo}\n${'─'.repeat(60)}`);
}

const sostenida = cargarJSON('resumen-sostenida.json');
const rampa     = cargarJSON('resumen-rampa.json');
const pico      = cargarJSON('resumen-pico.json');

const cfg               = leerConfig();
const limites_teoricos  = calcularLimites(cfg);
const sos_total         = count(metrica(sostenida, 'http_reqs')) ?? 0;
const throughput_real   = sos_total / 120;
const limites_empiricos = {
  high:    Math.ceil(cfg.WAIT_HIGH_S    * throughput_real),
  extreme: Math.ceil(cfg.WAIT_EXTREME_S * throughput_real),
};

seccion('ANÁLISIS DE CAPACIDAD');
console.log(`  Throughput fórmula  (latencias) : ${limites_teoricos.throughputTotal.toFixed(2)} req/s`);
console.log(`  Throughput empírico (test 1)    : ${throughput_real.toFixed(2)} req/s`);
console.log(`  HIGH_LOAD_LIMIT   configurado   : ${cfg.HIGH_LOAD_LIMIT}`);
console.log(`  HIGH_LOAD_LIMIT   por fórmula   : ${limites_teoricos.optimalHigh}`);
console.log(`  HIGH_LOAD_LIMIT   empírico      : ${limites_empiricos.high}`);
console.log(`  EXTREME_LOAD_LIMIT configurado  : ${cfg.EXTREME_LOAD_LIMIT}`);
console.log(`  EXTREME_LOAD_LIMIT por fórmula  : ${limites_teoricos.optimalExtreme}`);
console.log(`  EXTREME_LOAD_LIMIT empírico     : ${limites_empiricos.extreme}`);

seccion('TEST 1 — Carga Sostenida');
const sos_normal    = count(metrica(sostenida, 'estado_normal_pending'));
const sos_diferido  = count(metrica(sostenida, 'estado_diferido_deferred'));
const sos_rechazado = count(metrica(sostenida, 'estado_saturado_overloaded'));
const sos_throttled = count(metrica(sostenida, 'estado_rate_limit_429'));
const sos_failed    = metrica(sostenida, 'http_req_failed')?.values?.rate ?? 0;
const sos_p95       = pct(metrica(sostenida, 'http_req_duration'), 95);
const sos_estable   = !sos_rechazado || sos_rechazado === 0;

console.log(`  Peticiones totales : ${sos_total}`);
console.log(`  Estado PENDING     : ${sos_normal ?? 0}`);
console.log(`  Estado DEFERRED    : ${sos_diferido ?? 0}`);
console.log(`  Rechazadas (503)   : ${sos_rechazado ?? 0}`);
console.log(`  Bloqueadas (429)   : ${sos_throttled ?? 0}`);
console.log(`  Tasa de fallo HTTP : ${(sos_failed * 100).toFixed(2)}%`);
console.log(`  Latencia p95       : ${sos_p95 ? `${sos_p95.toFixed(0)}ms` : 'N/A'}`);
console.log(`\n  ${ok(sos_estable)} Sin rechazos 503 bajo carga normal`);
console.log(`  ${ok(sos_p95 && sos_p95 < 500)} Latencia p95 < 500ms`);

seccion('TEST 2 — Rampa Progresiva');
const ram_total      = count(metrica(rampa, 'http_reqs')) ?? 0;
const ram_normal     = count(metrica(rampa, 'estado_normal_pending'));
const ram_diferido   = count(metrica(rampa, 'estado_diferido_deferred'));
const ram_rechazado  = count(metrica(rampa, 'estado_saturado_overloaded'));
const ram_throttled  = count(metrica(rampa, 'estado_rate_limit_429'));
const ram_p95        = pct(metrica(rampa, 'http_req_duration'), 95);
const ram_proteccion = (ram_diferido ?? 0) > 0 || (ram_rechazado ?? 0) > 0 || (ram_throttled ?? 0) > 0;

console.log(`  Peticiones totales : ${ram_total}`);
console.log(`  Estado PENDING     : ${ram_normal ?? 0} (${porcentaje(ram_normal ?? 0, ram_total)}%)`);
console.log(`  Estado DEFERRED    : ${ram_diferido ?? 0} (${porcentaje(ram_diferido ?? 0, ram_total)}%)`);
console.log(`  Rechazadas (503)   : ${ram_rechazado ?? 0} (${porcentaje(ram_rechazado ?? 0, ram_total)}%)`);
console.log(`  Bloqueadas (429)   : ${ram_throttled ?? 0} (${porcentaje(ram_throttled ?? 0, ram_total)}%)`);
console.log(`  Latencia p95       : ${ram_p95 ? `${ram_p95.toFixed(0)}ms` : 'N/A'}`);
console.log(`\n  ${ok(ram_proteccion)} Sistema de protección activado durante la rampa`);
console.log(`  ${ok((ram_diferido ?? 0) > 0)} Modo DEFERRED activado (HIGH_LOAD_LIMIT alcanzado)`);

seccion('TEST 3 — Pico Súbito (validación Redlock)');
const pico_total      = count(metrica(pico, 'http_reqs')) ?? 0;
const pico_normal     = count(metrica(pico, 'estado_normal_pending'));
const pico_diferido   = count(metrica(pico, 'estado_diferido_deferred'));
const pico_rechazado  = count(metrica(pico, 'estado_saturado_overloaded'));
const pico_throttled  = count(metrica(pico, 'estado_rate_limit_429'));
const pico_errors_5xx = count(metrica(pico, 'error_5xx_unexpected')) ?? 0;
const pico_failed     = metrica(pico, 'http_req_failed')?.values?.rate ?? 0;
const pico_p99        = pct(metrica(pico, 'http_req_duration'), 99);
const pico_sin_500        = pico_errors_5xx === 0;
const pico_hay_proteccion = (pico_diferido ?? 0) > 0 || (pico_rechazado ?? 0) > 0 || (pico_throttled ?? 0) > 0;

console.log(`  Peticiones totales : ${pico_total}`);
console.log(`  Estado PENDING     : ${pico_normal ?? 0}`);
console.log(`  Estado DEFERRED    : ${pico_diferido ?? 0}`);
console.log(`  Rechazadas (503)   : ${pico_rechazado ?? 0}`);
console.log(`  Bloqueadas (429)   : ${pico_throttled ?? 0}`);
console.log(`  Errores 5xx reales : ${pico_errors_5xx}`);
console.log(`  Tasa fallo HTTP    : ${(pico_failed * 100).toFixed(2)}%`);
console.log(`  Latencia p99       : ${pico_p99 ? `${pico_p99.toFixed(0)}ms` : 'N/A'}`);
console.log(`\n  ${ok(pico_sin_500)} Sin errores 500 bajo pico (Redlock previene colisiones de nonce)`);
console.log(`  ${ok(pico_hay_proteccion)} Sistema aplica protección bajo avalancha`);

seccion('RESUMEN EJECUTIVO');
const todos_ok = sos_estable && (sos_p95 && sos_p95 < 500) && ram_proteccion && pico_sin_500 && pico_hay_proteccion;
console.log(`
  Carga sostenida sin 503            ${ok(sos_estable)}
  Latencia HTTP < 500ms en sostenida ${ok(sos_p95 && sos_p95 < 500)}
  Protección activa en rampa         ${ok(ram_proteccion)}
  Sin errores 500 bajo pico          ${ok(pico_sin_500)}
  Protección bajo avalancha          ${ok(pico_hay_proteccion)}

  Resultado global: ${todos_ok ? 'SISTEMA VALIDADO' : 'REVISAR CONFIGURACIÓN'}
`);