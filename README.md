# Servicio de Registro Documental (Backend)

API RESTful diseñada para el registro inmutable y la verificación de huellas documentales (hashes) en redes blockchain compatibles con EVM (Ethereum Virtual Machine).

Este microservicio está diseñado para entornos de alta concurrencia. Implementa un sistema de colas distribuidas (BullMQ), exclusión mutua asíncrona (Redlock) y un gestor de secretos seguro (HashiCorp Vault) para la firma de transacciones sin exponer claves privadas.

## Puesta en Marcha

Antes de ejecutar los contenedores, es necesario configurar el entorno local.

### 1. Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto basándote en el archivo `.env.example` proporcionado. Las claves indispensables para el arranque son:

- `BLOCKCHAIN_RPC_URL`: Endpoint del nodo blockchain (ej. Hardhat para desarrollo local o Alastria en producción).
- `REGISTRO_CONTRATO_ADDRESS`: Dirección del Smart Contract tras su despliegue.
- `VAULT_ENDPOINT` y `VAULT_TOKEN`: Credenciales de acceso al gestor de secretos.
- `REDIS_HOST` y `REDIS_PORT`: Infraestructura para la cola de trabajos y los bloqueos.

### 2. Ejecución de la Infraestructura

El sistema depende de servicios externos (Redis, Vault, Nodo RPC). Para levantar el backend y sus dependencias mediante Docker:

```bash
# Levantar toda la infraestructura en segundo plano
$ docker compose up -d

# Visualizar los logs del backend en tiempo real
$ docker logs -f tfg-backend
```

Una vez arrancado, la documentación interactiva de la API (Swagger) estará disponible en: http://localhost:3000/api/docs

## Estrategia de Pruebas

El proyecto cuenta con dos suites de pruebas diferenciadas: Unitarias y de Carga.

### Pruebas Unitarias y Cobertura

Evalúan la lógica de negocio, la inyección de dependencias y el aislamiento de fallos utilizando estructuras simuladas (Mocks) para la infraestructura de Vault y la Blockchain.

```bash
# Ejecutar suite de pruebas unitarias
$ npm run test

# Ejecutar pruebas y generar reporte de cobertura
$ npm run test:cov
```

### Pruebas de Rendimiento y Carga (K6 + Docker)

Diseñadas para evaluar los mecanismos de tolerancia a fallos y la política de desconexión de carga bajo condiciones de estrés. Se ejecutan en contenedores aislados orquestados por el archivo `docker-compose.load.yml`.

Este archivo se encarga también de configurar la variable `BLOCKCHAIN_MOCK_MODE=true` en el archivo `.env` antes de lanzarlas, para evitar saturar la red blockchain real y medir exclusivamente el rendimiento y límites del servicio. 

**Carga Sostenida**

```bash
$ npm run test:load
```

Propósito: Evalúa la estabilidad del consumo de memoria y la gestión interna de la cola bajo un tráfico constante y moderado durante un periodo prolongado. Nos proporciona una estimación de los valores óptimos de QUEUE_HIGH_LOAD_LIMIT y QUEUE_EXTREME_LOAD_LIMIT según los tiempos de respuesta configurados para los mocks de blockchain.

**Carga en Rampa (Escalado Progresivo)**

```bash
$ npm run test:load-rampa
```

Propósito: Incrementa el número de usuarios concurrentes de forma progresiva. Sirve para identificar el punto exacto de saturación en el cual el sistema activa el encolado en modo diferido o empieza a rechazar peticiones con código HTTP 503.

**Carga Pico (Estrés por Aluvión)**

```bash
$ npm run test:load-pico
```

Propósito: Simula una entrada masiva y repentina de peticiones en un intervalo de pocos segundos. Verifica la robustez de la exclusión mutua con Redlock y asegura la correcta asignación secuencial de Nonces bajo un nivel de concurrencia crítico.