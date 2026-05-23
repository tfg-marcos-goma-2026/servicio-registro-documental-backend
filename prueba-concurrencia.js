const crypto = require('crypto');

const NUM_USUARIOS = 10; 
const URL = 'http://localhost:3000/api/v1/documents/register';

async function simularUsuario(id) {
  const hash = '0x' + crypto.randomBytes(32).toString('hex');
  const startTime = Date.now();

  try {
    const res = await fetch(URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hash })
    });
    
    const data = await res.json();
    const duration = Date.now() - startTime;

    return { id, status: res.status, hash, response: data, duration };
  } catch (err) {
    return { id, status: 'ERROR', hash, error: err.message, duration: Date.now() - startTime };
  }
}

async function dispararPrueba() {
  console.log(`Lanzando ${NUM_USUARIOS} peticiones concurrentes al entorno de DESARROLLO...\n`);
  
  const promesas = Array.from({ length: NUM_USUARIOS }, (_, i) => simularUsuario(i + 1));
  const resultados = await Promise.all(promesas);

  console.log(`Resultados recibidos:\n`);
  
  resultados.forEach(r => {
    console.log(`👤 Usuario ${r.id} | HTTP: ${r.status} | Tiempo de respuesta: ${r.duration}ms`);
    console.log(`   📄 Documento : ${r.hash}`);
    
    if (r.response && r.response.success) {
        console.log(`   ✅ Estado    : ${r.response.status.toUpperCase()}`);
        console.log(`   ⚙️  Job ID    : ${r.response.jobId}`);
    } else {
        console.log(`   ❌ Error     : ${r.error || r.response?.message || 'Desconocido'}`);
    }
    console.log('---------------------------------------------------');
  });
}

dispararPrueba();