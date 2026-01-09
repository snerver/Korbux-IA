// services/encryptionService.js

/**
 * @file Servicio para la encriptación y desencriptación de datos.
 * @description Proporciona métodos para cifrar y descifrar cadenas de texto utilizando
 * algoritmos de cifrado simétrico (ej. AES-256-CBC) y claves configuradas.
 * @module services/encryptionService
 */

const crypto = require("crypto"); // Módulo criptográfico nativo de Node.js.
const path = require("path");

const logger = require(path.join(__dirname, "..", "config", "logger.js")); // Importa tu logger.
const config = require(path.join(__dirname, "..", "config")); // Importa tu configuración centralizada.
const { Errores } = require(path.join(__dirname, "..", "utils", "errores.js")); // Importa tus clases de errores personalizados.

/**
 * @class EncryptionService
 * @description Clase que gestiona las operaciones de encriptación y desencriptación.
 */
class EncryptionService {
  /**
   * @private
   * @property {Buffer} _encryptionKey - La clave de encriptación en formato Buffer.
   */
  _encryptionKey = null;

  /**
   * @private
   * @property {string} _algorithm - El algoritmo de encriptación a utilizar (ej. 'aes-256-cbc').
   */
  _algorithm = "";

  /**
   * @private
   * @property {boolean} _isReady - Indica si el servicio de encriptación está listo para operar.
   */
  _isReady = false;

  /**
   * Crea una instancia de EncryptionService.
   */
  constructor() {
    const encryptionKeyHex = config.get("encryption.key"); // Clave en formato hexadecimal (ej. 64 caracteres).
    const algorithm = config.get("encryption.algorithm") || "aes-256-cbc"; // Algoritmo por defecto.

    this._algorithm = algorithm;

    if (!encryptionKeyHex) {
      logger.error(
        " [EncryptionService] ENCRYPTION_KEY no está definida en la configuración. El servicio de encriptación no funcionará."
      );
      this._isReady = false;
    } else {
      try {
        // La clave debe ser un Buffer de 32 bytes para AES-256.
        // Si la recibes como hex string de 64 caracteres, conviértela.
        this._encryptionKey = Buffer.from(encryptionKeyHex, "hex");
        if (this._encryptionKey.length !== 32) {
          throw new Error(
            `La clave de encriptación debe ser de 32 bytes para ${this._algorithm}. Longitud actual: ${this._encryptionKey.length} bytes.`
          );
        }
        this._isReady = true;
        logger.info(
          `[EncryptionService] Servicio de encriptación inicializado con algoritmo: ${this._algorithm}.`
        );
      } catch (error) {
        logger.error(
          ` [EncryptionService] Error al inicializar la clave de encriptación: ${error.message}`
        );
        this._isReady = false;
      }
    }
  }

  /**
   * Verifica si el servicio de encriptación está listo para realizar operaciones.
   * @returns {boolean} True si el servicio está listo, false en caso contrario.
   */
  isServiceReady() {
    return this._isReady;
  }

  /**
   * Encripta una cadena de texto.
   * Genera un nuevo Vector de Inicialización (IV) para cada encriptación.
   * El IV es crucial para la seguridad y debe almacenarse junto con el texto cifrado.
   *
   * @param {string} text - La cadena de texto a encriptar.
   * @returns {string} El texto cifrado en formato 'hex', concatenado con el IV también en 'hex' (IV:ciphertext).
   * @throws {Errores.InternalServerError} Si el servicio no está listo o ocurre un error de encriptación.
   * @throws {Errores.BadRequestError} Si el texto a encriptar no es una cadena válida.
   */
  encrypt(text) {
    if (!this._isReady) {
      logger.error(
        " [EncryptionService] Intento de encriptar sin que el servicio esté listo."
      );
      throw new Errores.InternalServerError(
        "El servicio de encriptación no está configurado o disponible."
      );
    }
    if (typeof text !== "string" || text.length === 0) {
      logger.warn(
        " [EncryptionService] Intento de encriptar texto inválido o vacío."
      );
      throw new Errores.BadRequestError(
        "El texto a encriptar debe ser una cadena no vacía."
      );
    }

    try {
      // Generar un IV aleatorio para cada encriptación (16 bytes para AES).
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(
        this._algorithm,
        this._encryptionKey,
        iv
      );

      let encrypted = cipher.update(text, "utf8", "hex");
      encrypted += cipher.final("hex");

      // Retorna el IV y el texto cifrado, ambos en formato hexadecimal, separados por un delimitador.
      // Es CRÍTICO almacenar el IV junto con el texto cifrado para poder desencriptarlo.
      return iv.toString("hex") + ":" + encrypted;
    } catch (error) {
      logger.error(
        ` [EncryptionService] Error durante la encriptación: ${error.message}`,
        error
      );
      throw new Errores.InternalServerError(
        "Error al encriptar los datos.",
        error
      );
    }
  }

  /**
   * Desencripta una cadena de texto que fue previamente encriptada con `encrypt()`.
   * Requiere el texto cifrado que incluye el IV.
   *
   * @param {string} encryptedTextWithIv - El texto cifrado en formato 'hex', que incluye el IV (IV:ciphertext).
   * @returns {string} La cadena de texto desencriptada.
   * @throws {Errores.InternalServerError} Si el servicio no está listo o ocurre un error de desencriptación.
   * @throws {Errores.BadRequestError} Si el formato del texto cifrado es inválido.
   */
  decrypt(encryptedTextWithIv) {
    if (!this._isReady) {
      logger.error(
        " [EncryptionService] Intento de desencriptar sin que el servicio esté listo."
      );
      throw new Errores.InternalServerError(
        "El servicio de encriptación no está configurado o disponible."
      );
    }
    if (
      typeof encryptedTextWithIv !== "string" ||
      encryptedTextWithIv.length === 0
    ) {
      logger.warn(
        " [EncryptionService] Intento de desencriptar texto inválido o vacío."
      );
      throw new Errores.BadRequestError(
        "El texto a desencriptar debe ser una cadena no vacía."
      );
    }

    // Divide el IV y el texto cifrado.
    const parts = encryptedTextWithIv.split(":");
    if (parts.length !== 2) {
      logger.warn(
        ' [EncryptionService] Formato de texto cifrado inválido. Se esperaba "IV:ciphertext".'
      );
      throw new Errores.BadRequestError(
        'Formato de texto cifrado inválido. Se esperaba "IV:ciphertext".'
      );
    }

    try {
      const iv = Buffer.from(parts[0], "hex");
      const encryptedText = parts[1];

      if (iv.length !== 16) {
        // Verificar longitud del IV para AES.
        throw new Error("Longitud del IV inválida. Se esperaban 16 bytes.");
      }

      const decipher = crypto.createDecipheriv(
        this._algorithm,
        this._encryptionKey,
        iv
      );

      let decrypted = decipher.update(encryptedText, "hex", "utf8");
      decrypted += decipher.final("utf8");

      return decrypted;
    } catch (error) {
      logger.error(
        ` [EncryptionService] Error durante la desencriptación: ${error.message}. Posiblemente clave o IV incorrectos, o texto corrupto.`,
        error
      );
      throw new Errores.InternalServerError(
        "Error al desencriptar los datos. Verifique la clave o el texto cifrado.",
        error
      );
    }
  }
}

// Exporta una instancia única del servicio de encriptación.
module.exports = new EncryptionService();
