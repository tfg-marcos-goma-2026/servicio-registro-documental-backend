# Servicio de Registro Documental (Backend)

API RESTful diseñada para el registro inmutable y la verificación de huellas documentales (hashes) en redes blockchain compatibles con EVM (Ethereum Virtual Machine).

Este microservicio está diseñado para entornos de alta concurrencia. Implementa un sistema de colas distribuidas (BullMQ), exclusión mutua asíncrona (Redlock) y un gestor de secretos seguro (HashiCorp Vault) para la firma de transacciones sin exponer claves privadas.

## Puesta en Marcha

Antes de ejecutar los contenedores, es necesario configurar el entorno local.

### 1. Configuración de Certificados SSL (Nginx)

Toda la comunicación con el backend pasa a través de un proxy inverso Nginx configurado para requerir HTTPS (puerto 443).

* **En Producción (Entorno Real):** Copia los certificados válidos de tu Entidad Certificadora institucional en la carpeta `nginx/` asegurándote de que se llamen `server.crt` y `server.key`.
* **En Desarrollo / Simulación Local:** Para evitar bloqueos CORS o advertencias de seguridad en el navegador, genera certificados locales confiables utilizando `mkcert`:

  ```bash
  # Instalar la CA local en el sistema/navegador
  mkcert -install
  
  # Generar los certificados dentro de la carpeta nginx
  cd nginx
  mkcert -cert-file server.crt -key-file server.key localhost
  cd ..

### 2. Despliegue del Smart Contract
El código de la infraestructura blockchain se encuentra integrado en el directorio hardhat/. Antes de configurar el entorno del servidor, es necesario desplegar el contrato inteligente para obtener su dirección en la red:

Bash
cd hardhat
npm install
npx hardhat run scripts/deploy.ts --network <tu_red> 
cd ..

### 3. Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto basándote en el archivo `.env.example` proporcionado. Las claves indispensables para el arranque son:

- `BLOCKCHAIN_RPC_URL`: Endpoint del nodo blockchain (ej. Hardhat para desarrollo local o Alastria en producción).
- `REGISTRO_CONTRATO_ADDRESS`: Dirección del Smart Contract tras su despliegue.
- `VAULT_ENDPOINT` y `VAULT_TOKEN`: Credenciales de acceso al gestor de secretos.
- `REDIS_HOST` y `REDIS_PORT`: Infraestructura para la cola de trabajos y los bloqueos.

### 4. Ejecución de la Infraestructura

El sistema depende de servicios externos (Redis, Vault, Nodo RPC). Para levantar el backend y sus dependencias mediante Docker:

```bash
# Levantar toda la infraestructura en segundo plano
$ docker compose up -d

# Visualizar los logs del backend en tiempo real
$ docker logs -f tfg-backend-prod
```

El backend arranca correctamente sin necesidad de que Vault contenga la clave privada. Dicha clave solo se requiere en el momento en que se procesa una solicitud de registro; si no está inyectada en ese momento, la operación fallará con error interno.

### 5. Inyección de la Clave Privada en Vault

Una vez levantada la infraestructura, es necesario almacenar en Vault la clave privada de la cuenta firmante. Esta clave es la que autoriza las transacciones en la red blockchain.

**En Alastria (producción):** la clave privada se encuentra en el directorio de claves del nodo, generada durante el proceso de onboarding:

```bash
cat /data/alastria-node-besu/keys/key
```

**Inyección en Vault:**

```bash
curl -H "X-Vault-Token: <VAULT_TOKEN>" \
     -X POST \
     -d '{"data":{"privateKey":"<CLAVE_PRIVADA>"}}' \
     http://localhost:8200/v1/secret/data/blockchain
```

Una vez inyectada, el servicio está operativo y listo para procesar solicitudes.

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

Este archivo se encarga también de configurar la variable `BLOCKCHAIN_MOCK_MODE=true`, para evitar saturar la red blockchain real y medir exclusivamente el rendimiento y límites del servicio.

**Carga Sostenida**

```bash
$ npm run test:load
```

Propósito: Evalúa la estabilidad del consumo de memoria y la gestión interna de la cola bajo un tráfico constante y moderado durante un periodo prolongado. Proporciona una estimación de los valores óptimos de `QUEUE_HIGH_LOAD_LIMIT` y `QUEUE_EXTREME_LOAD_LIMIT` según los tiempos de respuesta configurados para los mocks de blockchain.

**Carga en Rampa (Escalado Progresivo)**

```bash
$ npm run test:load-rampa
```

Propósito: Incrementa el número de usuarios concurrentes de forma progresiva. Sirve para identificar el punto exacto de saturación en el cual el sistema activa el encolado en modo diferido o empieza a rechazar peticiones con código HTTP 503.

**Carga Pico (Estrés)**

```bash
$ npm run test:load-pico
```

Propósito: Simula una entrada masiva y repentina de peticiones en un intervalo de pocos segundos. Verifica la robustez de la exclusión mutua con Redlock y asegura la correcta asignación secuencial de Nonces bajo un nivel de concurrencia crítico.