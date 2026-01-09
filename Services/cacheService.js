// services/cacheService.js

/**
 * @file Servicio para la gestión de caché de la aplicación.
 * @description Proporciona una interfaz unificada para interactuar con un sistema de caché
 * (como Redis) o un caché en memoria como fallback, mejorando el rendimiento
 * al almacenar datos de acceso frecuente.
 */

const path = require("path");
const logger = require(path.join(__dirname, "..", "config", "logger.js")); // Importa tu logger
const config = require(path.join(__dirname, "..", "config")); // Importa tu configuración centralizada

// Importaciones condicionales para Redis.
// Asegúrate de que 'redis' esté instalado si REDIS_URL está configurado en tu .env.
let redisClient = null;
let isRedisConnected = false;

// Intentar cargar y configurar el cliente Redis si la URL está presente.
const REDIS_URL = config.get("redis.url");
const DEFAULT_CACHE_TTL = config.get("cache.ttl") || 3600; // TTL por defecto en segundos (1 hora)

if (REDIS_URL) {
  try {
    const { createClient } = require("redis");
    redisClient = createClient({ url: REDIS_URL });

    redisClient.on("connect", () => {
      isRedisConnected = true;
      logger.info(" [CacheService] Conectado a Redis.");
    });

    redisClient.on("ready", () => {
      isRedisConnected = true;
      logger.info(" [CacheService] Cliente Redis listo para usar.");
    });

    redisClient.on("error", (err) => {
      isRedisConnected = false;
      logger.error(" [CacheService] Error de conexión a Redis:", err.message);
      // Opcional: Implementar lógica de reconexión o fallback a caché en memoria aquí.
    });

    redisClient.on("end", () => {
      isRedisConnected = false;
      logger.warn(" [CacheService] Conexión a Redis terminada.");
    });

    // Conectar el cliente Redis.
    redisClient.connect().catch((err) => {
      isRedisConnected = false;
      logger.error(
        " [CacheService] Fallo inicial al conectar a Redis:",
        err.message
      );
    });
  } catch (e) {
    logger.error(
      ' [CacheService] No se pudo cargar la librería "redis". Asegúrate de que esté instalada si REDIS_URL está configurado.',
      e
    );
    redisClient = null;
  }
} else {
  logger.info(
    "[CacheService] REDIS_URL no configurada. El servicio de caché usará un caché en memoria."
  );
}

/**
 * @class CacheService
 * @description Clase que proporciona métodos para interactuar con el sistema de caché.
 * Utiliza Redis si está configurado y disponible, de lo contrario, un caché en memoria.
 */
class CacheService {
  /**
   * @private
   * @property {Map<string, {value: any, expiry: number}>} _memoryCache - Caché en memoria para desarrollo o fallback.
   */
  _memoryCache = new Map();

  constructor() {
    logger.info("[CacheService] Servicio de caché inicializado.");
    // Limpia periódicamente el caché en memoria para evitar crecimiento ilimitado.
    setInterval(() => this._cleanMemoryCache(), 5 * 60 * 1000); // Cada 5 minutos.
  }

  /**
   * Limpia las entradas expiradas del caché en memoria.
   * @private
   */
  _cleanMemoryCache() {
    const now = Date.now();
    this._memoryCache.forEach((item, key) => {
      if (item.expiry && item.expiry < now) {
        this._memoryCache.delete(key);
        logger.debug(
          `[CacheService] Entrada expirada eliminada del caché en memoria: ${key}`
        );
      }
    });
  }

  /**
   * Almacena un valor en la caché.
   * @param {string} key - La clave bajo la cual se almacenará el valor.
   * @param {any} value - El valor a almacenar. Puede ser un objeto, string, número, etc.
   * @param {number} [ttl=DEFAULT_CACHE_TTL] - Tiempo de vida en segundos. Si es 0, no expira (solo para Redis).
   * @returns {Promise<boolean>} True si se almacenó correctamente, false en caso contrario.
   */
  async set(key, value, ttl = DEFAULT_CACHE_TTL) {
    if (!key || value === undefined) {
      logger.warn(
        " [CacheService] Intento de establecer caché con clave o valor inválido."
      );
      return false;
    }

    const serializedValue = JSON.stringify(value); // Serializar para Redis y para consistencia.

    if (redisClient && isRedisConnected) {
      try {
        if (ttl > 0) {
          await redisClient.setEx(key, ttl, serializedValue);
        } else {
          await redisClient.set(key, serializedValue); // Sin expiración.
        }
        logger.debug(
          ` [CacheService] Clave '${key}' establecida en Redis con TTL: ${ttl}s.`
        );
        return true;
      } catch (error) {
        logger.error(
          ` [CacheService] Error al establecer clave '${key}' en Redis:`,
          error.message
        );
        // Fallback a caché en memoria si Redis falla.
        this._setInMemory(key, value, ttl);
        return false;
      }
    } else {
      this._setInMemory(key, value, ttl);
      logger.debug(
        ` [CacheService] Clave '${key}' establecida en caché en memoria con TTL: ${ttl}s.`
      );
      return true;
    }
  }

  /**
   * Método interno para establecer una clave en el caché en memoria.
   * @private
   * @param {string} key - La clave.
   * @param {any} value - El valor.
   * @param {number} ttl - Tiempo de vida en segundos.
   */
  _setInMemory(key, value, ttl) {
    const expiry = ttl > 0 ? Date.now() + ttl * 1000 : 0; // 0 significa no expira.
    this._memoryCache.set(key, { value: value, expiry: expiry });
  }

  /**
   * Recupera un valor de la caché.
   * @param {string} key - La clave del valor a recuperar.
   * @returns {Promise<any|null>} El valor almacenado, o null si no se encuentra o ha expirado.
   */
  async get(key) {
    if (!key) {
      logger.warn(
        " [CacheService] Intento de obtener caché con clave inválida."
      );
      return null;
    }

    if (redisClient && isRedisConnected) {
      try {
        const serializedValue = await redisClient.get(key);
        if (serializedValue === null) {
          logger.debug(`[CacheService] Clave '${key}' no encontrada en Redis.`);
          return null;
        }
        const value = JSON.parse(serializedValue);
        logger.debug(` [CacheService] Clave '${key}' recuperada de Redis.`);
        return value;
      } catch (error) {
        logger.error(
          ` [CacheService] Error al obtener clave '${key}' de Redis:`,
          error.message
        );
        // Fallback a caché en memoria si Redis falla.
        return this._getInMemory(key);
      }
    } else {
      return this._getInMemory(key);
    }
  }

  /**
   * Método interno para obtener una clave del caché en memoria.
   * @private
   * @param {string} key - La clave.
   * @returns {any|null} El valor, o null.
   */
  _getInMemory(key) {
    const item = this._memoryCache.get(key);
    if (!item) {
      return null;
    }
    if (item.expiry && item.expiry < Date.now()) {
      this._memoryCache.delete(key); // Eliminar si ha expirado.
      logger.debug(
        `[CacheService] Clave '${key}' expirada en caché en memoria.`
      );
      return null;
    }
    return item.value;
  }

  /**
   * Elimina una clave específica de la caché.
   * @param {string} key - La clave a eliminar.
   * @returns {Promise<boolean>} True si se eliminó correctamente, false en caso contrario.
   */
  async del(key) {
    if (!key) {
      logger.warn(
        " [CacheService] Intento de eliminar caché con clave inválida."
      );
      return false;
    }

    if (redisClient && isRedisConnected) {
      try {
        const deletedCount = await redisClient.del(key);
        if (deletedCount > 0) {
          logger.debug(` [CacheService] Clave '${key}' eliminada de Redis.`);
          return true;
        }
        logger.debug(
          `[CacheService] Clave '${key}' no encontrada en Redis para eliminar.`
        );
        return false;
      } catch (error) {
        logger.error(
          ` [CacheService] Error al eliminar clave '${key}' de Redis:`,
          error.message
        );
        // Intentar eliminar del caché en memoria si Redis falla.
        this._memoryCache.delete(key);
        return false;
      }
    } else {
      const deleted = this._memoryCache.delete(key);
      if (deleted) {
        logger.debug(
          ` [CacheService] Clave '${key}' eliminada del caché en memoria.`
        );
      } else {
        logger.debug(
          `[CacheService] Clave '${key}' no encontrada en caché en memoria para eliminar.`
        );
      }
      return deleted;
    }
  }

  /**
   * Verifica si una clave existe en la caché y no ha expirado.
   * @param {string} key - La clave a verificar.
   * @returns {Promise<boolean>} True si la clave existe y es válida, false en caso contrario.
   */
  async has(key) {
    if (!key) {
      logger.warn(
        " [CacheService] Intento de verificar caché con clave inválida."
      );
      return false;
    }

    if (redisClient && isRedisConnected) {
      try {
        const exists = await redisClient.exists(key);
        logger.debug(
          `[CacheService] Verificación de clave '${key}' en Redis: ${
            exists ? "existe" : "no existe"
          }.`
        );
        return exists === 1;
      } catch (error) {
        logger.error(
          ` [CacheService] Error al verificar clave '${key}' en Redis:`,
          error.message
        );
        // Fallback a caché en memoria si Redis falla.
        return this._hasInMemory(key);
      }
    } else {
      return this._hasInMemory(key);
    }
  }

  /**
   * Método interno para verificar si una clave existe en el caché en memoria y no ha expirado.
   * @private
   * @param {string} key - La clave.
   * @returns {boolean} True si existe y es válida, false si no.
   */
  _hasInMemory(key) {
    const item = this._memoryCache.get(key);
    if (!item) {
      return false;
    }
    if (item.expiry && item.expiry < Date.now()) {
      this._memoryCache.delete(key); // Eliminar si ha expirado.
      return false;
    }
    return true;
  }

  /**
   * Limpia toda la caché (elimina todas las entradas).
   * ¡Usar con precaución en producción, ya que puede afectar el rendimiento!
   * @returns {Promise<boolean>} True si se limpió correctamente, false en caso de error.
   */
  async clear() {
    if (redisClient && isRedisConnected) {
      try {
        await redisClient.flushdb(); // Elimina todas las claves de la DB actual de Redis.
        logger.info(" [CacheService] Caché de Redis limpiada completamente.");
        return true;
      } catch (error) {
        logger.error(
          " [CacheService] Error al limpiar caché de Redis:",
          error.message
        );
        return false;
      }
    } else {
      this._memoryCache.clear();
      logger.info(" [CacheService] Caché en memoria limpiada completamente.");
      return true;
    }
  }

  /**
   * Cierra la conexión a Redis si está activa.
   * Debería ser llamado durante el apagado elegante de la aplicación.
   * @returns {Promise<void>}
   */
  async disconnect() {
    if (redisClient && isRedisConnected) {
      try {
        await redisClient.quit();
        logger.info(" [CacheService] Conexión a Redis cerrada.");
        isRedisConnected = false;
      } catch (error) {
        logger.error(
          " [CacheService] Error al desconectar de Redis:",
          error.message
        );
      }
    }
  }
}

// Exporta una instancia única del servicio de caché.
const cacheServiceInstance = new CacheService();

// Asegura que la conexión a Redis se cierre al apagar la aplicación.
// Esto es importante para un apagado limpio.
process.on("SIGINT", async () => {
  await cacheServiceInstance.disconnect();
});
process.on("SIGTERM", async () => {
  await cacheServiceInstance.disconnect();
});

module.exports = cacheServiceInstance;
