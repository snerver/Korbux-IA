// services/notificationService.js

/**
 * @file Servicio para la gestión y envío de notificaciones.
 * @description Centraliza la lógica para crear, almacenar y enviar notificaciones
 * a los usuarios a través de diferentes canales (in-app, email, push).
 * @module services/notificationService
 */

const path = require("path");
const logger = require(path.join(__dirname, "..", "config", "logger.js")); // Importa tu logger
const config = require(path.join(__dirname, "..", "config")); // Importa tu configuración centralizada
const { Errores } = require(path.join(__dirname, "..", "utils", "errores.js")); // Importa tus clases de errores personalizados

// Importa el modelo Notification. Asegúrate de que este modelo esté definido en tu carpeta models/.
// Por ejemplo, en models/Notification.js.
let NotificationModel;
try {
  NotificationModel = require(path.join(
    __dirname,
    "..",
    "models",
    "Notification.js"
  ));
} catch (e) {
  logger.error(
    " [NotificationService] No se pudo cargar el modelo Notification. Asegúrate de que models/Notification.js exista y esté configurado.",
    e
  );
  // Define un modelo dummy para evitar errores si el real no se carga.
  NotificationModel = {
    create: async (data) => {
      logger.warn(
        " [NotificationService] Operación de DB simulada: Notification model no cargado.",
        data
      );
      return data;
    },
    update: async () => {
      logger.warn(
        " [NotificationService] Operación de DB simulada: Notification model no cargado."
      );
      return [1];
    },
    findByPk: async () => {
      logger.warn(
        " [NotificationService] Operación de DB simulada: Notification model no cargado."
      );
      return null;
    },
    findAll: async () => {
      logger.warn(
        " [NotificationService] Operación de DB simulada: Notification model no cargado."
      );
      return [];
    },
  };
}

// Importa el emailService. Se hace de esta forma para evitar dependencias circulares
// si emailService también necesitara importar notificationService.
let emailServiceInstance;
// Se intentará cargar después de que todos los servicios estén inicializados,
// o se podría pasar como dependencia en el constructor si se usa un patrón de inyección más estricto.
// Para este ejemplo, lo cargamos aquí y asumimos que ya ha sido inicializado.
try {
  emailServiceInstance = require(path.join(
    __dirname,
    "..",
    "services",
    "emailService.js"
  ));
} catch (e) {
  logger.error(
    " [NotificationService] No se pudo cargar emailService.js. Las notificaciones por correo electrónico no funcionarán.",
    e
  );
  emailServiceInstance = null;
}

/**
 * @class NotificationService
 * @description Clase que gestiona la creación, almacenamiento y envío de notificaciones.
 */
class NotificationService {
  /**
   * @private
   * @property {string|null} _fcmServerKey - Clave del servidor de Firebase Cloud Messaging.
   */
  _fcmServerKey = null;

  /**
   * @private
   * @property {string|null} _oneSignalAppId - ID de la aplicación OneSignal.
   */
  _oneSignalAppId = null;

  /**
   * @private
   * @property {string|null} _oneSignalApiKey - Clave de la API de OneSignal.
   */
  _oneSignalApiKey = null;

  /**
   * @private
   * @property {string} _environment - Entorno actual de la aplicación.
   */
  _environment = "development";

  /**
   * Crea una instancia de NotificationService.
   */
  constructor() {
    this._fcmServerKey = config.get("pushNotifications.fcmServerKey") || null;
    this._oneSignalAppId =
      config.get("pushNotifications.oneSignalAppId") || null;
    this._oneSignalApiKey =
      config.get("pushNotifications.oneSignalApiKey") || null;
    this._environment = config.get("app.env") || "development";

    if (!this._fcmServerKey) {
      logger.warn(
        " [NotificationService] FCM_SERVER_KEY no configurada. Las notificaciones push vía FCM no funcionarán."
      );
    }
    if (!this._oneSignalAppId || !this._oneSignalApiKey) {
      logger.warn(
        " [NotificationService] ONESIGNAL_APP_ID o ONESIGNAL_API_KEY no configuradas. Las notificaciones push vía OneSignal no funcionarán."
      );
    }

    logger.info(
      "[NotificationService] Servicio de notificaciones inicializado."
    );
  }

  /**
   * Crea y almacena una nueva notificación en la base de datos.
   * @param {string} userId - ID del usuario al que va dirigida la notificación.
   * @param {string} type - Tipo de notificación (ej. 'new_message', 'order_status', 'system_alert').
   * @param {string} title - Título de la notificación.
   * @param {string} message - Contenido del mensaje de la notificación.
   * @param {object} [data={}] - Datos adicionales asociados a la notificación (ej. ID de pedido, URL).
   * @param {boolean} [isRead=false] - Estado inicial de lectura de la notificación.
   * @returns {Promise<object>} El objeto de notificación creado.
   * @throws {Errores.BadRequestError} Si faltan parámetros obligatorios.
   * @throws {Errores.InternalServerError} Si ocurre un error al guardar en la base de datos.
   */
  async createNotification(
    userId,
    type,
    title,
    message,
    data = {},
    isRead = false
  ) {
    if (!userId || !type || !title || !message) {
      logger.warn(
        " [NotificationService] Intento de crear notificación con parámetros incompletos."
      );
      throw new Errores.BadRequestError(
        "userId, type, title y message son obligatorios para crear una notificación."
      );
    }

    try {
      const newNotification = await NotificationModel.create({
        userId,
        type,
        title,
        message,
        data, // Sequelize con DataTypes.JSON maneja objetos directamente.
        isRead,
        createdAt: new Date(),
      });
      logger.info(
        ` [NotificationService] Notificación creada para usuario ${userId} (Tipo: ${type}, Título: "${title}").`
      );
      return newNotification;
    } catch (error) {
      logger.error(
        ` [NotificationService] Error al crear notificación para usuario ${userId}:`,
        error
      );
      throw new Errores.InternalServerError(
        "Error al crear la notificación en la base de datos.",
        error
      );
    }
  }

  /**
   * Envía una notificación a un usuario a través de uno o más canales.
   * Este es el método principal para disparar notificaciones.
   *
   * @param {string} userId - ID del usuario al que se enviará la notificación.
   * @param {string} type - Tipo de notificación (ej. 'new_message', 'system_alert').
   * @param {string} title - Título de la notificación.
   * @param {string} message - Contenido del mensaje de la notificación.
   * @param {object} [options={}] - Opciones de envío.
   * @param {string[]} [options.channels=['in-app']] - Canales a través de los cuales enviar (ej. ['in-app', 'email', 'push']).
   * @param {string} [options.userEmail=null] - Correo electrónico del usuario (requerido para canal 'email').
   * @param {string} [options.username=null] - Nombre de usuario (para personalización de emails).
   * @param {string[]} [options.deviceTokens=[]] - Tokens de dispositivo para notificaciones push.
   * @param {object} [options.notificationData={}] - Datos adicionales para la notificación (se guardan en BD y se envían a canales).
   * @returns {Promise<object>} Un objeto con el estado de envío por cada canal.
   */
  async sendNotification(userId, type, title, message, options = {}) {
    const {
      channels = ["in-app"],
      userEmail = null,
      username = "Usuario",
      deviceTokens = [],
      notificationData = {},
    } = options;

    const results = {};

    // 1. Crear la notificación en la base de datos (in-app).
    try {
      const notificationRecord = await this.createNotification(
        userId,
        type,
        title,
        message,
        notificationData
      );
      results["in-app"] = {
        success: true,
        notificationId: notificationRecord.id,
      };
    } catch (error) {
      logger.error(
        ` [NotificationService] Fallo al crear notificación in-app para ${userId}:`,
        error.message
      );
      results["in-app"] = { success: false, error: error.message };
      // Si la notificación in-app falla, puede que no queramos enviar por otros canales.
      // Depende de la lógica de negocio. Aquí continuamos, pero se podría lanzar un error.
    }

    // 2. Enviar a otros canales según lo especificado.
    for (const channel of channels) {
      if (channel === "email" && userEmail) {
        try {
          await this._sendEmailNotification(
            userEmail,
            username,
            title,
            message,
            notificationData
          );
          results["email"] = { success: true };
        } catch (error) {
          logger.error(
            ` [NotificationService] Fallo al enviar email a ${userEmail}:`,
            error.message
          );
          results["email"] = { success: false, error: error.message };
        }
      } else if (channel === "push" && deviceTokens.length > 0) {
        try {
          await this._sendPushNotification(
            userId,
            deviceTokens,
            title,
            message,
            notificationData
          );
          results["push"] = { success: true };
        } catch (error) {
          logger.error(
            ` [NotificationService] Fallo al enviar push a usuario ${userId}:`,
            error.message
          );
          results["push"] = { success: false, error: error.message };
        }
      }
      // Añadir más canales aquí (ej. SMS, WebSockets)
    }

    logger.info(
      ` [NotificationService] Intento de envío de notificación para ${userId} completado. Resultados:`,
      results
    );
    return results;
  }

  /**
   * Envía una notificación por correo electrónico.
   * @private
   * @param {string} toEmail - Dirección de correo electrónico del destinatario.
   * @param {string} username - Nombre de usuario.
   * @param {string} subject - Asunto del correo.
   * @param {string} body - Cuerpo del mensaje (HTML o texto plano).
   * @param {object} [data={}] - Datos adicionales para la plantilla de email.
   * @returns {Promise<object>} Información del envío del correo.
   * @throws {Errores.InternalServerError} Si el emailService no está disponible o falla el envío.
   */
  async _sendEmailNotification(toEmail, username, subject, body, data = {}) {
    if (!emailServiceInstance || !emailServiceInstance.isServiceReady()) {
      logger.error(
        " [NotificationService] emailService no está disponible o no está listo para enviar correos."
      );
      throw new Errores.InternalServerError(
        "Servicio de correo electrónico no disponible."
      );
    }
    try {
      // Puedes usar una plantilla genérica o crear plantillas específicas en emailService.
      const htmlContent = `<p>Hola ${username},</p><p>${body}</p><p>Datos adicionales: ${JSON.stringify(
        data
      )}</p>`;
      const textContent = `Hola ${username},\n\n${body}\n\nDatos adicionales: ${JSON.stringify(
        data
      )}`;

      return await emailServiceInstance.sendEmail(
        toEmail,
        subject,
        htmlContent,
        textContent
      );
    } catch (error) {
      logger.error(
        ` [NotificationService] Error al enviar notificación por email a ${toEmail}:`,
        error
      );
      throw new Errores.InternalServerError(
        `Fallo al enviar notificación por email a ${toEmail}.`,
        error
      );
    }
  }

  /**
   * Envía una notificación push a los tokens de dispositivo especificados.
   * Este es un placeholder. La implementación real requiere integración con FCM/OneSignal.
   * @private
   * @param {string} userId - ID del usuario.
   * @param {string[]} deviceTokens - Array de tokens de dispositivo.
   * @param {string} title - Título de la notificación push.
   * @param {string} message - Contenido del mensaje push.
   * @param {object} [data={}] - Datos de payload adicionales para la notificación push.
   * @returns {Promise<object>} Resultado del envío de la notificación push.
   * @throws {Errores.InternalServerError} Si la configuración es inválida o falla el envío.
   */
  async _sendPushNotification(userId, deviceTokens, title, message, data = {}) {
    if (
      !this._fcmServerKey &&
      (!this._oneSignalAppId || !this._oneSignalApiKey)
    ) {
      logger.error(
        " [NotificationService] No hay claves de FCM o OneSignal configuradas para enviar notificaciones push."
      );
      throw new Errores.InternalServerError(
        "Configuración de notificaciones push incompleta."
      );
    }
    if (deviceTokens.length === 0) {
      logger.warn(
        ` [NotificationService] No hay tokens de dispositivo para enviar notificación push a usuario ${userId}.`
      );
      return { success: true, message: "No device tokens provided." };
    }

    logger.debug(
      `[NotificationService] Intentando enviar notificación push a ${deviceTokens.length} dispositivos para usuario ${userId}.`
    );

    // --- Lógica de integración con FCM (Firebase Cloud Messaging) ---
    // Esto es un ejemplo. La implementación real de FCM requiere el SDK de Firebase Admin.
    // if (this._fcmServerKey) {
    //     // Ejemplo de cómo se vería una llamada a la API de FCM (requiere un módulo http client)
    //     const fcmEndpoint = 'https://fcm.googleapis.com/fcm/send';
    //     const headers = {
    //         'Content-Type': 'application/json',
    //         'Authorization': `key=${this._fcmServerKey}`
    //     };
    //     const payload = {
    //         notification: { title, body: message },
    //         data: { ...data, type: 'push_notification', userId },
    //         registration_ids: deviceTokens // Para enviar a múltiples tokens
    //     };
    //     try {
    //         // Aquí harías una solicitud HTTP POST a fcmEndpoint con headers y payload
    //         // const response = await fetch(fcmEndpoint, { method: 'POST', headers, body: JSON.stringify(payload) });
    //         // const result = await response.json();
    //         logger.info(` [NotificationService] Notificación push enviada vía FCM (simulado).`);
    //         return { success: true, provider: 'FCM', result: 'simulated' };
    //     } catch (fcmError) {
    //         logger.error(` [NotificationService] Error al enviar push vía FCM:`, fcmError);
    //         throw new Errores.InternalServerError('Error al enviar notificación push vía FCM.', fcmError);
    //     }
    // }

    // --- Lógica de integración con OneSignal ---
    // Esto es un ejemplo. La implementación real de OneSignal requiere llamadas a su API.
    // if (this._oneSignalAppId && this._oneSignalApiKey) {
    //     const oneSignalEndpoint = 'https://onesignal.com/api/v1/notifications';
    //     const headers = {
    //         'Content-Type': 'application/json',
    //         'Authorization': `Basic ${this._oneSignalApiKey}`
    //     };
    //     const payload = {
    //         app_id: this._oneSignalAppId,
    //         contents: { en: message, es: message }, // Soporte multi-idioma
    //         headings: { en: title, es: title },
    //         include_player_ids: deviceTokens, // Para enviar a IDs de OneSignal
    //         data: { ...data, type: 'push_notification', userId },
    //     };
    //     try {
    //         // Aquí harías una solicitud HTTP POST a oneSignalEndpoint con headers y payload
    //         // const response = await fetch(oneSignalEndpoint, { method: 'POST', headers, body: JSON.stringify(payload) });
    //         // const result = await response.json();
    //         logger.info(` [NotificationService] Notificación push enviada vía OneSignal (simulado).`);
    //         return { success: true, provider: 'OneSignal', result: 'simulated' };
    //     } catch (osError) {
    //         logger.error(` [NotificationService] Error al enviar push vía OneSignal:`, osError);
    //         throw new Errores.InternalServerError('Error al enviar notificación push vía OneSignal.', osError);
    //     }
    // }

    // Si ninguna configuración de push está activa, lanzar error o registrar.
    logger.warn(
      " [NotificationService] No se pudo enviar notificación push: No hay integraciones de push activas o configuradas correctamente."
    );
    throw new Errores.InternalServerError(
      "No hay servicio de notificaciones push configurado o disponible."
    );
  }

  /**
   * Marca una notificación como leída.
   * @param {string} notificationId - ID de la notificación a marcar.
   * @param {string} userId - ID del usuario propietario de la notificación (para seguridad).
   * @returns {Promise<boolean>} True si se marcó como leída, false si no se encontró o no es del usuario.
   * @throws {Errores.BadRequestError} Si los IDs son inválidos.
   * @throws {Errores.InternalServerError} Si ocurre un error de base de datos.
   */
  async markNotificationAsRead(notificationId, userId) {
    if (!notificationId || !userId) {
      throw new Errores.BadRequestError(
        "notificationId y userId son obligatorios."
      );
    }
    try {
      const notification = await NotificationModel.findByPk(notificationId);
      if (!notification) {
        logger.warn(
          ` [NotificationService] Notificación ${notificationId} no encontrada para marcar como leída.`
        );
        return false;
      }
      if (notification.userId !== userId) {
        logger.warn(
          ` [NotificationService] Intento de marcar notificación ${notificationId} no perteneciente a usuario ${userId}.`
        );
        throw new Errores.UnauthorizedError(
          "No autorizado para marcar esta notificación."
        );
      }
      if (notification.isRead) {
        logger.info(
          `[NotificationService] Notificación ${notificationId} ya estaba marcada como leída.`
        );
        return true;
      }

      const [updatedRows] = await NotificationModel.update(
        { isRead: true },
        { where: { id: notificationId, userId: userId } }
      );

      if (updatedRows === 0) {
        logger.warn(
          ` [NotificationService] No se pudo actualizar la notificación ${notificationId} como leída.`
        );
        return false;
      }
      logger.info(
        ` [NotificationService] Notificación ${notificationId} marcada como leída para usuario ${userId}.`
      );
      return true;
    } catch (error) {
      if (error instanceof Errores.AppError) throw error;
      logger.error(
        ` [NotificationService] Error al marcar notificación ${notificationId} como leída:`,
        error
      );
      throw new Errores.InternalServerError(
        "Error al marcar notificación como leída.",
        error
      );
    }
  }

  /**
   * Obtiene las notificaciones de un usuario.
   * @param {string} userId - ID del usuario.
   * @param {object} [options={}] - Opciones de consulta.
   * @param {boolean} [options.readStatus=null] - Filtrar por estado de lectura (true/false/null para todos).
   * @param {number} [options.limit=20] - Límite de resultados.
   * @param {number} [options.offset=0] - Offset de resultados.
   * @returns {Promise<object[]>} Array de notificaciones.
   * @throws {Errores.BadRequestError} Si el ID de usuario es inválido.
   * @throws {Errores.InternalServerError} Si ocurre un error de base de datos.
   */
  async getNotifications(userId, options = {}) {
    if (!userId) {
      throw new Errores.BadRequestError(
        "userId es obligatorio para obtener notificaciones."
      );
    }
    const { readStatus = null, limit = 20, offset = 0 } = options;

    const whereClause = { userId: userId };
    if (readStatus !== null) {
      whereClause.isRead = readStatus;
    }

    try {
      const notifications = await NotificationModel.findAll({
        where: whereClause,
        limit: limit,
        offset: offset,
        order: [["createdAt", "DESC"]], // Notificaciones más recientes primero.
      });
      logger.info(
        ` [NotificationService] ${notifications.length} notificaciones obtenidas para usuario ${userId}.`
      );
      return notifications;
    } catch (error) {
      logger.error(
        ` [NotificationService] Error al obtener notificaciones para usuario ${userId}:`,
        error
      );
      throw new Errores.InternalServerError(
        "Error al obtener notificaciones.",
        error
      );
    }
  }

  /**
   * Elimina una notificación específica.
   * @param {string} notificationId - ID de la notificación a eliminar.
   * @param {string} userId - ID del usuario propietario (para seguridad).
   * @returns {Promise<boolean>} True si se eliminó, false si no se encontró o no es del usuario.
   * @throws {Errores.BadRequestError} Si los IDs son inválidos.
   * @throws {Errores.InternalServerError} Si ocurre un error de base de datos.
   */
  async deleteNotification(notificationId, userId) {
    if (!notificationId || !userId) {
      throw new Errores.BadRequestError(
        "notificationId y userId son obligatorios para eliminar."
      );
    }
    try {
      const deletedRows = await NotificationModel.destroy({
        where: { id: notificationId, userId: userId },
      });
      if (deletedRows === 0) {
        logger.warn(
          ` [NotificationService] Notificación ${notificationId} no encontrada o no pertenece al usuario ${userId} para eliminar.`
        );
        return false;
      }
      logger.info(
        ` [NotificationService] Notificación ${notificationId} eliminada para usuario ${userId}.`
      );
      return true;
    } catch (error) {
      logger.error(
        ` [NotificationService] Error al eliminar notificación ${notificationId}:`,
        error
      );
      throw new Errores.InternalServerError(
        "Error al eliminar notificación.",
        error
      );
    }
  }
}

// Exporta una instancia única del servicio de notificaciones.
module.exports = new NotificationService();
