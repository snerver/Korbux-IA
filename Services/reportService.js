// services/reportService.js

/**
 * @file Servicio para la generación y gestión de informes.
 * @description Centraliza la lógica para generar diversos tipos de informes
 * a partir de los datos de la aplicación y su entrega (ej. por correo electrónico).
 * @module services/reportService
 */

const path = require("path");
const logger = require(path.join(__dirname, "..", "config", "logger.js")); // Importa tu logger
const config = require(path.join(__dirname, "..", "config")); // Importa tu configuración centralizada
const { Errores } = require(path.join(__dirname, "..", "utils", "errores.js")); // Importa tus clases de errores personalizados

// Importa los servicios necesarios. Se hace de esta forma para evitar dependencias circulares
// si emailService también necesitara importar reportService.
let emailServiceInstance;
try {
  emailServiceInstance = require(path.join(
    __dirname,
    "..",
    "services",
    "emailService.js"
  ));
} catch (e) {
  logger.error(
    " [ReportService] No se pudo cargar emailService.js. Los informes por correo electrónico no funcionarán.",
    e
  );
  emailServiceInstance = null;
}

// Importa los modelos necesarios para los informes.
// Asegúrate de que estos modelos existan en tu carpeta models/.
let UserModel;
let ChatMessageModel;
let Op; // Para operadores de Sequelize como Op.gte, Op.lte

try {
  const sequelize = require(path.join(
    __dirname,
    "..",
    "config",
    "database.js"
  )); // Asume que database.js exporta la instancia de Sequelize
  UserModel = require(path.join(__dirname, "..", "models", "User.js"));
  ChatMessageModel = require(path.join(
    __dirname,
    "..",
    "models",
    "ChatMessage.js"
  ));
  Op = sequelize.Op; // Obtener Op de la instancia de Sequelize
} catch (e) {
  logger.error(
    " [ReportService] No se pudieron cargar los modelos o Sequelize. Los informes basados en DB no funcionarán.",
    e
  );
  // Define modelos dummy para evitar errores de referencia.
  UserModel = {
    findAll: async () => {
      logger.warn(" [ReportService] Modelo User no cargado.");
      return [];
    },
  };
  ChatMessageModel = {
    findAll: async () => {
      logger.warn(" [ReportService] Modelo ChatMessage no cargado.");
      return [];
    },
  };
  Op = {}; // Objeto vacío para Op.
}

/**
 * @class ReportService
 * @description Clase que gestiona la generación y entrega de informes.
 */
class ReportService {
  /**
   * @private
   * @property {string} _environment - Entorno actual de la aplicación.
   */
  _environment = "development";

  /**
   * Crea una instancia de ReportService.
   */
  constructor() {
    this._environment = config.get("app.env") || "development";
    logger.info("[ReportService] Servicio de informes inicializado.");
  }

  /**
   * Genera un informe en formato CSV a partir de un array de objetos.
   * @private
   * @param {Array<object>} data - Array de objetos a convertir a CSV.
   * @returns {string} Contenido del informe en formato CSV.
   */
  _convertToCsv(data) {
    if (!data || data.length === 0) {
      return "";
    }

    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(","), // Cabecera CSV
      ...data.map((row) =>
        headers
          .map((header) => {
            const value = row[header];
            // Escapar comas y comillas dobles en los valores
            const escapedValue = String(value).replace(/"/g, '""');
            return `"${escapedValue}"`;
          })
          .join(",")
      ),
    ];
    return csvRows.join("\n");
  }

  /**
   * Genera un informe de actividad de usuarios.
   * @private
   * @param {object} options - Opciones para el informe.
   * @param {Date} [options.startDate=null] - Fecha de inicio para filtrar la actividad.
   * @param {Date} [options.endDate=null] - Fecha de fin para filtrar la actividad.
   * @returns {Promise<Array<object>>} Datos del informe de actividad de usuarios.
   * @throws {Errores.InternalServerError} Si ocurre un error al obtener los datos.
   */
  async _generateUserActivityReport(options) {
    try {
      const { startDate, endDate } = options;
      const whereClause = {};

      if (startDate || endDate) {
        whereClause.createdAt = {};
        if (startDate) whereClause.createdAt[Op.gte] = startDate;
        if (endDate) whereClause.createdAt[Op.lte] = endDate;
      }

      // Aquí se asume que el modelo User tiene un campo 'createdAt' para la actividad.
      // Para una actividad más detallada, se necesitaría un modelo de 'AuditLog' o similar.
      const users = await UserModel.findAll({
        where: whereClause,
        attributes: ["id", "username", "email", "createdAt", "updatedAt"],
        order: [["createdAt", "ASC"]],
      });

      logger.info(
        ` [ReportService] Generado informe de actividad de usuarios: ${users.length} usuarios.`
      );
      return users.map((user) => user.toJSON()); // Convertir a objetos planos si son instancias de Sequelize.
    } catch (error) {
      logger.error(
        " [ReportService] Error al generar informe de actividad de usuarios:",
        error
      );
      throw new Errores.InternalServerError(
        "Error al generar informe de actividad de usuarios.",
        error
      );
    }
  }

  /**
   * Genera un informe de estadísticas de uso del chat.
   * @private
   * @param {object} options - Opciones para el informe.
   * @param {Date} [options.startDate=null] - Fecha de inicio para filtrar mensajes.
   * @param {Date} [options.endDate=null] - Fecha de fin para filtrar mensajes.
   * @returns {Promise<Array<object>>} Datos del informe de estadísticas de chat.
   * @throws {Errores.InternalServerError} Si ocurre un error al obtener los datos.
   */
  async _generateChatUsageReport(options) {
    try {
      const { startDate, endDate } = options;
      const whereClause = {};

      if (startDate || endDate) {
        whereClause.timestamp = {}; // Asume que el modelo ChatMessage tiene un campo 'timestamp'.
        if (startDate) whereClause.timestamp[Op.gte] = startDate;
        if (endDate) whereClause.timestamp[Op.lte] = endDate;
      }

      // Contar mensajes por usuario y tipo.
      const chatStats = await ChatMessageModel.findAll({
        where: whereClause,
        attributes: [
          "userId",
          "username",
          "type", // 'user' o 'assistant'
          [
            ChatMessageModel.sequelize.fn(
              "COUNT",
              ChatMessageModel.sequelize.col("id")
            ),
            "messageCount",
          ],
        ],
        group: ["userId", "username", "type"],
        order: [
          ["userId", "ASC"],
          ["type", "ASC"],
        ],
      });

      logger.info(
        ` [ReportService] Generado informe de estadísticas de chat: ${chatStats.length} entradas.`
      );
      return chatStats.map((stat) => stat.toJSON());
    } catch (error) {
      logger.error(
        " [ReportService] Error al generar informe de estadísticas de chat:",
        error
      );
      throw new Errores.InternalServerError(
        "Error al generar informe de estadísticas de chat.",
        error
      );
    }
  }

  /**
   * Genera un informe basado en el tipo especificado.
   * @param {'user_activity'|'chat_usage'} reportType - El tipo de informe a generar.
   * @param {object} [options={}] - Opciones específicas para la generación del informe.
   * @param {Date} [options.startDate=null] - Fecha de inicio para el rango del informe.
   * @param {Date} [options.endDate=null] - Fecha de fin para el rango del informe.
   * @returns {Promise<object>} Un objeto que contiene el tipo de informe, las opciones y los datos generados.
   * @throws {Errores.BadRequestError} Si el tipo de informe no es válido.
   * @throws {Errores.InternalServerError} Si ocurre un error durante la generación del informe.
   */
  async generateReport(reportType, options = {}) {
    let reportData;
    let reportName;

    switch (reportType) {
      case "user_activity":
        reportData = await this._generateUserActivityReport(options);
        reportName = "Actividad de Usuarios";
        break;
      case "chat_usage":
        reportData = await this._generateChatUsageReport(options);
        reportName = "Estadísticas de Uso de Chat";
        break;
      // Añadir más casos para otros tipos de informes aquí.
      default:
        logger.warn(
          ` [ReportService] Tipo de informe no válido solicitado: ${reportType}`
        );
        throw new Errores.BadRequestError(
          `Tipo de informe no válido: ${reportType}.`
        );
    }

    return {
      reportType,
      reportName,
      options,
      data: reportData,
      generatedAt: new Date(),
    };
  }

  /**
   * Envía un informe generado por correo electrónico.
   * El informe se adjuntará como un archivo CSV.
   * @param {string} toEmail - Correo electrónico del destinatario.
   * @param {object} report - Objeto de informe generado por `generateReport`.
   * @param {string} [username='Usuario'] - Nombre de usuario para personalizar el correo.
   * @returns {Promise<object>} Información sobre el envío del correo.
   * @throws {Errores.InternalServerError} Si el servicio de correo no está disponible o falla el envío.
   * @throws {Errores.BadRequestError} Si el objeto de informe es inválido.
   */
  async sendReportByEmail(toEmail, report, username = "Usuario") {
    if (!emailServiceInstance || !emailServiceInstance.isServiceReady()) {
      logger.error(
        " [ReportService] emailService no está disponible o no está listo para enviar correos."
      );
      throw new Errores.InternalServerError(
        "Servicio de correo electrónico no disponible para enviar informes."
      );
    }
    if (!report || !report.reportName || !Array.isArray(report.data)) {
      logger.warn(
        " [ReportService] Objeto de informe inválido para enviar por correo."
      );
      throw new Errores.BadRequestError(
        "El objeto de informe proporcionado es inválido."
      );
    }

    try {
      const csvContent = this._convertToCsv(report.data);
      const reportFileName = `${report.reportName.replace(
        /\s/g,
        "_"
      )}_${new Date().toISOString().slice(0, 10)}.csv`;

      const subject = `Informe de Korbux: ${report.reportName}`;
      const htmlContent = `
                <p>Hola ${username},</p>
                <p>Adjunto encontrarás el informe de <strong>${
                  report.reportName
                }</strong> generado el ${report.generatedAt.toLocaleString()}.</p>
                <p>Esperamos que esta información te sea útil.</p>
                <p>Saludos,</p>
                <p>El equipo de Korbux</p>
            `;
      const textContent = `Hola ${username},\n\nAdjunto encontrarás el informe de ${
        report.reportName
      } generado el ${report.generatedAt.toLocaleString()}.\nEsperamos que esta información te sea útil.\n\nSaludos,\nEl equipo de Korbux`;

      const mailOptions = {
        to: toEmail,
        subject: subject,
        html: htmlContent,
        text: textContent,
        attachments: [
          {
            filename: reportFileName,
            content: csvContent,
            contentType: "text/csv",
          },
        ],
      };

      // Usar el método sendEmail del emailService, que ya maneja from y otras opciones.
      const info = await emailServiceInstance.sendEmail(
        mailOptions.to,
        mailOptions.subject,
        mailOptions.html,
        mailOptions.text,
        mailOptions.attachments
      );
      logger.info(
        ` [ReportService] Informe "${
          report.reportName
        }" enviado por correo a ${toEmail}. Message ID: ${
          info.messageId || "N/A"
        }`
      );
      return info;
    } catch (error) {
      logger.error(
        ` [ReportService] Error al enviar informe "${report.reportName}" por correo a ${toEmail}:`,
        error
      );
      throw new Errores.InternalServerError(
        `Fallo al enviar informe por correo a ${toEmail}.`,
        error
      );
    }
  }

  // Opcional: Métodos para guardar informes en almacenamiento local o en la nube.
  /**
   * Guarda un informe generado en el sistema de archivos local.
   * @param {object} report - Objeto de informe generado por `generateReport`.
   * @param {string} [format='csv'] - Formato del archivo ('csv', 'json').
   * @param {string} [directory='reports'] - Directorio donde guardar el informe.
   * @returns {Promise<string>} Ruta al archivo guardado.
   * @throws {Errores.InternalServerError} Si falla la escritura del archivo.
   */
  async saveReportToFile(report, format = "csv", directory = "reports") {
    const fs = require("fs").promises; // Importar fs.promises para async/await
    const reportsDir = path.join(process.cwd(), directory); // Directorio absoluto.

    if (!report || !report.reportName || !report.data) {
      throw new Errores.BadRequestError(
        "Objeto de informe inválido para guardar en archivo."
      );
    }

    let fileContent;
    let fileName;
    const baseFileName = `${report.reportName.replace(/\s/g, "_")}_${new Date()
      .toISOString()
      .slice(0, 10)}`;

    switch (format.toLowerCase()) {
      case "csv":
        fileContent = this._convertToCsv(report.data);
        fileName = `${baseFileName}.csv`;
        break;
      case "json":
        fileContent = JSON.stringify(report.data, null, 2);
        fileName = `${baseFileName}.json`;
        break;
      default:
        throw new Errores.BadRequestError(
          `Formato de informe no soportado para guardar: ${format}.`
        );
    }

    try {
      await fs.mkdir(reportsDir, { recursive: true }); // Crear directorio si no existe.
      const filePath = path.join(reportsDir, fileName);
      await fs.writeFile(filePath, fileContent, "utf8");
      logger.info(
        ` [ReportService] Informe "${report.reportName}" guardado en: ${filePath}`
      );
      return filePath;
    } catch (error) {
      logger.error(
        ` [ReportService] Error al guardar informe "${report.reportName}" en archivo:`,
        error
      );
      throw new Errores.InternalServerError(
        "Error al guardar el informe en el sistema de archivos.",
        error
      );
    }
  }
}

// Exporta una instancia única del servicio de informes.
module.exports = new ReportService();
