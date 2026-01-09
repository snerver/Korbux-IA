// services/emailService.js

/**
 * @file Servicio para el envío de correos electrónicos.
 * @description Centraliza la lógica para configurar y utilizar un transportador de correo electrónico
 * (ej. Nodemailer) para enviar diferentes tipos de emails transaccionales y de notificación.
 * Incorpora gestión de plantillas, cola de reintentos y verificaciones de estado.
 * @module services/emailService
 */

const path = require("path");
const nodemailer = require("nodemailer"); // Importa la librería Nodemailer.

const logger = require(path.join(__dirname, "..", "config", "logger.js")); // Importa tu logger.
const config = require(path.join(__dirname, "..", "config")); // Importa tu configuración centralizada.
const { Errores } = require(path.join(__dirname, "..", "utils", "errores.js")); // Importa tus clases de errores personalizados.

/**
 * @typedef {object} EmailQueueItem
 * @property {object} mailOptions - Opciones de correo para Nodemailer.
 * @property {number} retries - Número de intentos de envío restantes.
 * @property {string} originalTo - Destinatario original para logging.
 * @property {string} originalSubject - Asunto original para logging.
 */

/**
 * @class EmailService
 * @description Clase que gestiona el envío de correos electrónicos, incluyendo plantillas y reintentos.
 */
class EmailService {
  /**
   * @private
   * @property {nodemailer.Transporter|null} _transporter - El objeto transportador de Nodemailer.
   */
  _transporter = null;

  /**
   * @private
   * @property {string} _fromEmail - La dirección de correo electrónico del remitente por defecto.
   */
  _fromEmail = "";

  /**
   * @private
   * @property {boolean} _isReady - Indica si el servicio de email está listo para enviar correos.
   */
  _isReady = false;

  /**
   * @private
   * @property {EmailQueueItem[]} _emailQueue - Cola de correos electrónicos pendientes de reintento.
   */
  _emailQueue = [];

  /**
   * @private
   * @property {NodeJS.Timeout|null} _retryIntervalId - ID del temporizador para el mecanismo de reintento.
   */
  _retryIntervalId = null;

  /**
   * @private
   * @property {number} _maxRetries - Número máximo de reintentos para un correo fallido.
   */
  _maxRetries = 3;

  /**
   * @private
   * @property {number} _retryIntervalMs - Intervalo en milisegundos entre reintentos de cola.
   */
  _retryIntervalMs = 10000; // 10 segundos

  /**
   * Crea una instancia de EmailService.
   */
  constructor() {
    const emailHost = config.get("email.host");
    const emailPort = config.get("email.port");
    const emailUser = config.get("email.user");
    const emailPassword = config.get("email.password");
    const emailFrom = config.get("email.from"); // "Korbux <no-reply@korbux.com>"
    const appEnv = config.get("app.env");

    if (!emailHost || !emailUser || !emailPassword) {
      logger.warn(
        " [EmailService] Configuración de correo electrónico incompleta (host, user, o password faltan). El servicio de email no podrá enviar correos."
      );
      this._transporter = null;
      this._fromEmail = "no-reply@example.com"; // Fallback seguro.
      this._isReady = false;
    } else {
      try {
        this._transporter = nodemailer.createTransport({
          host: emailHost,
          port: emailPort,
          secure: emailPort === 465, // true para 465 (SSL), false para otros puertos (TLS).
          auth: {
            user: emailUser,
            pass: emailPassword,
          },
          tls: {
            // En producción, siempre rechazar certificados no autorizados.
            // En desarrollo, puedes establecerlo en false si usas un servidor SMTP local con certificado autofirmado.
            rejectUnauthorized: appEnv === "production",
          },
        });
        this._fromEmail = emailFrom || emailUser; // Usar el remitente configurado o el usuario.
        logger.info(
          "[EmailService] Servicio de correo electrónico inicializado y transportador creado."
        );

        // Verificar la conexión al servidor SMTP (opcional, pero recomendado en inicio).
        this._transporter.verify((error, success) => {
          if (error) {
            logger.error(
              " [EmailService] Error al verificar la conexión SMTP:",
              error.message
            );
            logger.error(
              "Asegúrate de que las credenciales y el host/puerto SMTP sean correctos."
            );
            this._isReady = false; // Marcar como no listo si la verificación falla.
          } else {
            logger.info(
              " [EmailService] Conexión SMTP verificada exitosamente."
            );
            this._isReady = true; // Marcar como listo solo después de la verificación.
            this._startRetryMechanism(); // Iniciar el mecanismo de reintento si está listo.
          }
        });
      } catch (error) {
        logger.error(
          " [EmailService] Error al configurar el transportador de correo electrónico:",
          error.message
        );
        this._transporter = null;
        this._isReady = false;
      }
    }
  }

  /**
   * Inicia el mecanismo periódico de reintento de envío de correos en cola.
   * @private
   */
  _startRetryMechanism() {
    if (this._retryIntervalId) {
      clearInterval(this._retryIntervalId);
    }
    this._retryIntervalId = setInterval(() => {
      if (this._emailQueue.length > 0 && this._isReady) {
        this._processEmailQueue();
      }
    }, this._retryIntervalMs);
    logger.info(
      `[EmailService] Mecanismo de reintento de correos iniciado (cada ${
        this._retryIntervalMs / 1000
      }s).`
    );
  }

  /**
   * Detiene el mecanismo periódico de reintento de envío de correos.
   * @private
   */
  _stopRetryMechanism() {
    if (this._retryIntervalId) {
      clearInterval(this._retryIntervalId);
      this._retryIntervalId = null;
      logger.info("[EmailService] Mecanismo de reintento de correos detenido.");
    }
  }

  /**
   * Procesa la cola de correos electrónicos pendientes de envío.
   * @private
   * @returns {Promise<void>}
   */
  async _processEmailQueue() {
    if (this._emailQueue.length === 0 || !this._isReady) {
      return;
    }

    logger.debug(
      `[EmailService] Procesando cola de correos (${this._emailQueue.length} pendientes).`
    );
    const emailsToProcess = [...this._emailQueue];
    this._emailQueue = []; // Limpiar la cola para nuevas entradas.

    for (const item of emailsToProcess) {
      try {
        const info = await this._transporter.sendMail(item.mailOptions);
        logger.info(
          ` [EmailService] Correo en cola re-enviado a ${item.originalTo}. Message ID: ${info.messageId} (Intentos restantes: ${item.retries}).`
        );
      } catch (error) {
        logger.error(
          ` [EmailService] Error al re-enviar correo en cola a ${
            item.originalTo
          } (asunto: "${item.originalSubject}", intentos restantes: ${
            item.retries - 1
          }):`,
          error.message
        );
        if (item.retries > 1) {
          item.retries--;
          this._emailQueue.push(item); // Reencolar para otro intento.
        } else {
          logger.error(
            ` [EmailService] Correo a ${item.originalTo} (asunto: "${item.originalSubject}") falló después de ${this._maxRetries} intentos. Descartado.`
          );
        }
      }
    }
  }

  /**
   * Encola un correo electrónico para reintento si el envío falla.
   * @private
   * @param {object} mailOptions - Opciones de correo para Nodemailer.
   * @param {string} originalTo - Destinatario original para logging.
   * @param {string} originalSubject - Asunto original para logging.
   */
  _enqueueEmail(mailOptions, originalTo, originalSubject) {
    this._emailQueue.push({
      mailOptions,
      retries: this._maxRetries,
      originalTo,
      originalSubject,
    });
    logger.debug(
      `[EmailService] Correo encolado para reintento. Cola actual: ${this._emailQueue.length}`
    );
  }

  /**
   * Envía un correo electrónico genérico.
   * Si el servicio no está listo, encola el correo para reintento.
   * @param {string} to - Dirección de correo electrónico del destinatario.
   * @param {string} subject - Asunto del correo electrónico.
   * @param {string} htmlContent - Contenido HTML del correo electrónico.
   * @param {string} [textContent=''] - Contenido de texto plano del correo electrónico (fallback).
   * @returns {Promise<object|void>} Información sobre el envío del correo (ej. messageId) o void si encolado.
   * @throws {Errores.BadRequestError} Si faltan parámetros obligatorios.
   * @throws {Errores.InternalServerError} Si el servicio de email no está configurado y no puede encolar.
   */
  async sendEmail(to, subject, htmlContent, textContent = "") {
    if (!to || !subject || !htmlContent) {
      logger.warn(
        " [EmailService] Intento de enviar correo con parámetros incompletos."
      );
      throw new Errores.BadRequestError(
        "Destinatario, asunto y contenido HTML son obligatorios para enviar un correo."
      );
    }

    const mailOptions = {
      from: this._fromEmail,
      to: to,
      subject: subject,
      html: htmlContent,
      text: textContent || htmlContent.replace(/<[^>]*>/g, ""), // Genera texto plano si no se proporciona.
    };

    if (!this._transporter || !this._isReady) {
      logger.warn(
        ` [EmailService] Transportador no listo para enviar correo a ${to}. Encolando para reintento.`
      );
      this._enqueueEmail(mailOptions, to, subject);
      return; // No lanza error si se encola.
    }

    try {
      logger.debug(
        `[EmailService] Intentando enviar correo a: ${to} con asunto: "${subject}"`
      );
      const info = await this._transporter.sendMail(mailOptions);
      logger.info(
        ` [EmailService] Correo enviado a ${to}. Message ID: ${info.messageId}`
      );
      return info;
    } catch (error) {
      logger.error(
        ` [EmailService] Error al enviar correo a ${to} con asunto "${subject}":`,
        error.message
      );
      // Encolar para reintento en caso de fallo de envío.
      this._enqueueEmail(mailOptions, to, subject);
      throw new Errores.InternalServerError(
        `Error al enviar correo electrónico a ${to}. El correo ha sido encolado para reintento.`,
        error
      );
    }
  }

  /**
   * Simula un motor de plantillas básico (para un uso real, considera Handlebars, EJS, Pug).
   * @private
   * @param {string} templateName - Nombre de la plantilla (ej. 'passwordReset', 'welcome').
   * @param {object} data - Datos a inyectar en la plantilla.
   * @returns {object} Un objeto con `html` y `text` content.
   * @throws {Errores.BadRequestError} Si la plantilla no existe o faltan datos críticos.
   */
  _getTemplateContent(templateName, data) {
    let html = "";
    let text = "";
    let subject = "";

    switch (templateName) {
      case "passwordReset":
        if (!data.username || !data.resetLink) {
          throw new Errores.BadRequestError(
            "Datos incompletos para la plantilla de restablecimiento de contraseña."
          );
        }
        subject = "Restablecimiento de Contraseña para tu cuenta";
        html = `
                    <p>Hola ${data.username},</p>
                    <p>Hemos recibido una solicitud para restablecer la contraseña de tu cuenta.</p>
                    <p>Por favor, haz clic en el siguiente enlace para restablecer tu contraseña:</p>
                    <p><a href="${data.resetLink}" style="color: #1a73e8; text-decoration: none;">Restablecer mi contraseña</a></p>
                    <p>Este enlace expirará en 1 hora.</p>
                    <p>Si no solicitaste un restablecimiento de contraseña, por favor ignora este correo.</p>
                    <p>Gracias,</p>
                    <p>El equipo de Korbux</p>
                `;
        text = `Hola ${data.username},\n\nHemos recibido una solicitud para restablecer la contraseña de tu cuenta.\nPor favor, copia y pega el siguiente enlace en tu navegador para restablecer tu contraseña:\n${data.resetLink}\n\nEste enlace expirará en 1 hora.\n\nSi no solicitaste un restablecimiento de contraseña, por favor ignora este correo.\n\nGracias,\nEl equipo de Korbux`;
        break;

      case "verifyAccount":
        if (!data.username || !data.verificationLink) {
          throw new Errores.BadRequestError(
            "Datos incompletos para la plantilla de verificación de cuenta."
          );
        }
        subject = "Verifica tu cuenta de Korbux";
        html = `
                    <p>Hola ${data.username},</p>
                    <p>¡Gracias por registrarte en Korbux! Para activar tu cuenta, por favor haz clic en el siguiente enlace:</p>
                    <p><a href="${data.verificationLink}" style="color: #1a73e8; text-decoration: none;">Verificar mi cuenta</a></p>
                    <p>Este enlace expirará en 24 horas.</p>
                    <p>Si no te registraste en Korbux, por favor ignora este correo.</p>
                    <p>Saludos,</p>
                    <p>El equipo de Korbux</p>
                `;
        text = `Hola ${data.username},\n\n¡Gracias por registrarte en Korbux! Para activar tu cuenta, por favor copia y pega el siguiente enlace en tu navegador:\n${data.verificationLink}\n\nEste enlace expirará en 24 horas.\n\nSi no te registraste en Korbux, por favor ignora este correo.\n\nSaludos,\nEl equipo de Korbux`;
        break;

      case "welcome":
        if (!data.username) {
          throw new Errores.BadRequestError(
            "Datos incompletos para la plantilla de bienvenida."
          );
        }
        subject = "¡Bienvenido a Korbux!";
        html = `
                    <p>Hola ${data.username},</p>
                    <p>¡Bienvenido a Korbux! Estamos emocionados de tenerte a bordo.</p>
                    <p>Ahora puedes empezar a explorar todas las funciones de nuestra aplicación.</p>
                    <p>Si tienes alguna pregunta, no dudes en contactarnos.</p>
                    <p>Saludos,</p>
                    <p>El equipo de Korbux</p>
                `;
        text = `Hola ${data.username},\n\n¡Bienvenido a Korbux! Estamos emocionados de tenerte a bordo.\nAhora puedes empezar a explorar todas las funciones de nuestra aplicación.\nSi tienes alguna pregunta, no dudes en contactarnos.\n\nSaludos,\nEl equipo de Korbux`;
        break;

      default:
        logger.error(
          ` [EmailService] Plantilla de correo no encontrada: ${templateName}`
        );
        throw new Errores.BadRequestError(
          `Plantilla de correo '${templateName}' no encontrada.`
        );
    }
    return { subject, html, text };
  }

  /**
   * Envía un correo electrónico utilizando una plantilla predefinida.
   * @param {string} toEmail - Dirección de correo electrónico del destinatario.
   * @param {string} templateName - Nombre de la plantilla a usar (ej. 'passwordReset', 'welcome').
   * @param {object} data - Objeto con los datos para rellenar la plantilla (ej. { username: 'Juan', resetLink: '...' }).
   * @returns {Promise<object|void>} Información sobre el envío del correo o void si encolado.
   * @throws {Errores.BadRequestError} Si la plantilla no existe o los datos son insuficientes.
   * @throws {Errores.InternalServerError} Si el envío falla o el servicio no está listo.
   */
  async sendTemplatedEmail(toEmail, templateName, data = {}) {
    try {
      const { subject, html, text } = this._getTemplateContent(
        templateName,
        data
      );
      return this.sendEmail(toEmail, subject, html, text);
    } catch (error) {
      if (error instanceof Errores.BadRequestError) {
        throw error; // Errores de plantilla o datos incompletos.
      }
      logger.error(
        ` [EmailService] Error al preparar o enviar correo con plantilla '${templateName}' a ${toEmail}:`,
        error
      );
      throw new Errores.InternalServerError(
        `Error al enviar correo con plantilla '${templateName}' a ${toEmail}.`,
        error
      );
    }
  }

  /**
   * Envía un correo electrónico de restablecimiento de contraseña.
   * @param {string} toEmail - Dirección de correo electrónico del usuario.
   * @param {string} resetLink - El enlace para restablecer la contraseña.
   * @param {string} [username='Usuario'] - Nombre de usuario para personalizar el correo.
   * @returns {Promise<object|void>} Información sobre el envío del correo o void si encolado.
   * @throws {Errores.InternalServerError} Si el envío falla.
   */
  async sendPasswordResetEmail(toEmail, resetLink, username = "Usuario") {
    return this.sendTemplatedEmail(toEmail, "passwordReset", {
      username,
      resetLink,
    });
  }

  /**
   * Envía un correo electrónico de verificación de cuenta.
   * @param {string} toEmail - Dirección de correo electrónico del usuario.
   * @param {string} verificationLink - El enlace para verificar la cuenta.
   * @param {string} [username='Usuario'] - Nombre de usuario para personalizar el correo.
   * @returns {Promise<object|void>} Información sobre el envío del correo o void si encolado.
   * @throws {Errores.InternalServerError} Si el envío falla.
   */
  async sendVerificationEmail(toEmail, verificationLink, username = "Usuario") {
    return this.sendTemplatedEmail(toEmail, "verifyAccount", {
      username,
      verificationLink,
    });
  }

  /**
   * Envía un correo de bienvenida a un nuevo usuario.
   * @param {string} toEmail - Dirección de correo electrónico del nuevo usuario.
   * @param {string} [username='Usuario'] - Nombre de usuario para personalizar el correo.
   * @returns {Promise<object|void>} Información sobre el envío del correo o void si encolado.
   * @throws {Errores.InternalServerError} Si el envío falla.
   */
  async sendWelcomeEmail(toEmail, username = "Usuario") {
    return this.sendTemplatedEmail(toEmail, "welcome", { username });
  }

  /**
   * Verifica si el servicio de correo electrónico está listo para enviar.
   * @returns {boolean} True si el transportador está configurado y verificado, false en caso contrario.
   */
  isServiceReady() {
    return this._isReady;
  }

  /**
   * Cierra el transportador de correo electrónico y detiene el mecanismo de reintento.
   * Debería ser llamado durante el apagado elegante de la aplicación.
   * @returns {Promise<void>}
   */
  async closeTransporter() {
    this._stopRetryMechanism(); // Detener reintentos.
    if (this._emailQueue.length > 0) {
      logger.warn(
        ` [EmailService] Quedan ${this._emailQueue.length} correos en cola al cerrar el servicio. Intentando vaciar...`
      );
      await this._processEmailQueue(); // Intentar un último vaciado.
    }
    if (this._transporter) {
      this._transporter.close();
      logger.info(
        "[EmailService] Transportador de correo electrónico cerrado."
      );
    }
    this._isReady = false;
  }
}

// Exporta una instancia única del servicio de correo electrónico.
const emailServiceInstance = new EmailService();

// Asegura que el transportador se cierre al apagar la aplicación.
process.on("SIGINT", async () => {
  await emailServiceInstance.closeTransporter();
});
process.on("SIGTERM", async () => {
  await emailServiceInstance.closeTransporter();
});

module.exports = emailServiceInstance;
