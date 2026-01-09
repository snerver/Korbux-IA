// services/searchService.js

/**
 * @file Servicio para la gestión de búsquedas y filtrado avanzado.
 * @description Centraliza la lógica para realizar consultas complejas en la base de datos,
 * incluyendo filtrado, paginación y ordenación, y puede extenderse para integrar
 * con motores de búsqueda externos.
 * @module services/searchService
 */

const path = require("path");
const logger = require(path.join(__dirname, "..", "config", "logger.js")); // Importa tu logger
const config = require(path.join(__dirname, "..", "config")); // Importa tu configuración centralizada
const { Errores } = require(path.join(__dirname, "..", "utils", "errores.js")); // Importa tus clases de errores personalizados

// Importa Sequelize y el operador Op para consultas avanzadas.
let sequelizeInstance;
let Op;

try {
  sequelizeInstance = require(path.join(
    __dirname,
    "..",
    "config",
    "database.js"
  )); // Asume que database.js exporta la instancia de Sequelize
  Op = sequelizeInstance.Op; // Obtener Op de la instancia de Sequelize
} catch (e) {
  logger.error(
    " [SearchService] No se pudo cargar Sequelize o el archivo de configuración de la base de datos. Las búsquedas basadas en DB no funcionarán.",
    e
  );
  // Define un Op dummy para evitar errores de referencia si Sequelize no se carga.
  Op = {};
}

// Importa los modelos que serán comúnmente buscados.
let UserModel;
let ChatMessageModel;

try {
  UserModel = require(path.join(__dirname, "..", "models", "User.js"));
} catch (e) {
  logger.warn(
    " [SearchService] No se pudo cargar el modelo User. Las búsquedas de usuarios no funcionarán.",
    e.message
  );
  UserModel = null;
}

try {
  ChatMessageModel = require(path.join(
    __dirname,
    "..",
    "models",
    "ChatMessage.js"
  ));
} catch (e) {
  logger.warn(
    " [SearchService] No se pudo cargar el modelo ChatMessage. Las búsquedas de mensajes de chat no funcionarán.",
    e.message
  );
  ChatMessageModel = null;
}

/**
 * @class SearchService
 * @description Clase que gestiona las operaciones de búsqueda y filtrado.
 */
class SearchService {
  /**
   * @private
   * @property {string} _environment - Entorno actual de la aplicación.
   */
  _environment = "development";

  /**
   * @private
   * @property {boolean} _advancedSearchEnabled - Indica si las funcionalidades de búsqueda avanzada están habilitadas.
   */
  _advancedSearchEnabled = false;

  /**
   * Crea una instancia de SearchService.
   */
  constructor() {
    this._environment = config.get("app.env") || "development";
    this._advancedSearchEnabled =
      config.get("search.enableAdvancedSearch") === true; // Asume una configuración 'search.enableAdvancedSearch'

    if (!this._advancedSearchEnabled) {
      logger.warn(
        " [SearchService] La búsqueda avanzada está deshabilitada por configuración."
      );
    }

    logger.info("[SearchService] Servicio de búsqueda inicializado.");
  }

  /**
   * Construye la cláusula `where` para una consulta de Sequelize basándose en filtros.
   * @private
   * @param {object} filters - Objeto de filtros (ej. { email: 'test@example.com', username: 'john' }).
   * @param {string[]} searchableFields - Array de campos donde se debe aplicar la búsqueda de texto (ej. ['username', 'email']).
   * @param {string} [searchText=''] - Texto de búsqueda general para aplicar a `searchableFields`.
   * @returns {object} La cláusula `where` para Sequelize.
   */
  _buildWhereClause(filters, searchableFields, searchText = "") {
    const where = {};

    // Añadir filtros exactos.
    for (const key in filters) {
      if (Object.prototype.hasOwnProperty.call(filters, key)) {
        where[key] = filters[key];
      }
    }

    // Añadir búsqueda de texto general a los campos especificados.
    if (searchText && searchableFields && searchableFields.length > 0) {
      const searchConditions = searchableFields.map((field) => ({
        [field]: { [Op.like]: `%${searchText}%` }, // Búsqueda de subcadena insensible a mayúsculas/minúsculas.
      }));
      // Usar Op.or para combinar las condiciones de búsqueda.
      if (searchConditions.length > 0) {
        where[Op.or] = searchConditions;
      }
    }
    return where;
  }

  /**
   * Construye la cláusula `order` para una consulta de Sequelize.
   * @private
   * @param {string} [sortBy='createdAt'] - Campo por el cual ordenar.
   * @param {'ASC'|'DESC'} [sortOrder='DESC'] - Orden de clasificación ('ASC' o 'DESC').
   * @param {string[]} allowedSortFields - Campos permitidos para la ordenación.
   * @returns {Array<Array<string>>} La cláusula `order` para Sequelize.
   */
  _buildOrderClause(sortBy, sortOrder, allowedSortFields) {
    const finalSortBy = allowedSortFields.includes(sortBy)
      ? sortBy
      : "createdAt"; // Fallback a 'createdAt'
    const finalSortOrder = ["ASC", "DESC"].includes(sortOrder.toUpperCase())
      ? sortOrder.toUpperCase()
      : "DESC";
    return [[finalSortBy, finalSortOrder]];
  }

  /**
   * Realiza una búsqueda genérica en un modelo de Sequelize.
   * @param {object} model - La instancia del modelo Sequelize (ej. `UserModel`, `ChatMessageModel`).
   * @param {object} [options={}] - Opciones de búsqueda y filtrado.
   * @param {string} [options.searchText=''] - Texto general para buscar en los campos configurados.
   * @param {object} [options.filters={}] - Filtros exactos por campo (ej. { status: 'active' }).
   * @param {number} [options.limit=20] - Número máximo de resultados a devolver.
   * @param {number} [options.offset=0] - Número de resultados a omitir (para paginación).
   * @param {string} [options.sortBy='createdAt'] - Campo por el cual ordenar los resultados.
   * @param {'ASC'|'DESC'} [options.sortOrder='DESC'] - Orden de clasificación ('ASC' o 'DESC').
   * @param {string[]} [options.searchableFields=[]] - Campos del modelo donde aplicar `searchText`.
   * @param {string[]} [options.allowedSortFields=[]] - Campos permitidos para la ordenación.
   * @param {string[]} [options.attributes=null] - Atributos específicos a seleccionar (null para todos).
   * @returns {Promise<object[]>} Un array de objetos encontrados.
   * @throws {Errores.BadRequestError} Si el modelo no es válido o las opciones son inválidas.
   * @throws {Errores.InternalServerError} Si ocurre un error en la consulta a la base de datos.
   */
  async search(model, options = {}) {
    if (!this._advancedSearchEnabled) {
      logger.warn(
        " [SearchService] Intento de búsqueda avanzada mientras el servicio está deshabilitado."
      );
      throw new Errores.ServiceUnavailableError(
        "El servicio de búsqueda avanzada está actualmente deshabilitado."
      );
    }
    if (!model || typeof model.findAll !== "function") {
      logger.error(
        " [SearchService] Modelo inválido proporcionado para la búsqueda."
      );
      throw new Errores.BadRequestError(
        "Se requiere un modelo Sequelize válido para realizar la búsqueda."
      );
    }
    if (!Op) {
      logger.error(
        " [SearchService] El operador Op de Sequelize no está disponible. Asegúrate de que Sequelize se inicialice correctamente."
      );
      throw new Errores.InternalServerError(
        "Fallo en la configuración del servicio de búsqueda (Sequelize Op no disponible)."
      );
    }

    const {
      searchText = "",
      filters = {},
      limit = 20,
      offset = 0,
      sortBy = "createdAt",
      sortOrder = "DESC",
      searchableFields = [],
      allowedSortFields = ["createdAt", "updatedAt"], // Campos por defecto permitidos para ordenar
      attributes = null,
    } = options;

    try {
      const whereClause = this._buildWhereClause(
        filters,
        searchableFields,
        searchText
      );
      const orderClause = this._buildOrderClause(
        sortBy,
        sortOrder,
        allowedSortFields
      );

      logger.debug(
        `[SearchService] Realizando búsqueda en el modelo ${
          model.name
        }. Where: ${JSON.stringify(whereClause)}, Order: ${JSON.stringify(
          orderClause
        )}, Limit: ${limit}, Offset: ${offset}`
      );

      const results = await model.findAll({
        where: whereClause,
        limit: limit,
        offset: offset,
        order: orderClause,
        attributes: attributes, // Seleccionar atributos específicos.
        // include: [], // Opcional: Incluir relaciones (ej. para búsqueda con joins).
      });

      logger.info(
        ` [SearchService] Búsqueda en el modelo ${model.name} completada. Encontrados ${results.length} resultados.`
      );
      return results.map((item) => item.toJSON()); // Convertir a objetos planos.
    } catch (error) {
      logger.error(
        ` [SearchService] Error al realizar búsqueda en el modelo ${model.name}:`,
        error
      );
      throw new Errores.InternalServerError(
        `Error al realizar búsqueda en ${model.name}.`,
        error
      );
    }
  }

  /**
   * Busca usuarios en la base de datos.
   * @param {object} [options={}] - Opciones de búsqueda (ver `search` método).
   * @returns {Promise<object[]>} Un array de objetos de usuario encontrados.
   * @throws {Errores.BadRequestError} Si el modelo User no está disponible.
   * @throws {Errores.InternalServerError} Si ocurre un error en la consulta.
   */
  async searchUsers(options = {}) {
    if (!UserModel) {
      throw new Errores.InternalServerError(
        "El modelo de usuario no está disponible para la búsqueda."
      );
    }
    // Definir campos buscables y ordenables específicos para el modelo User.
    const userSearchableFields = ["username", "email"];
    const userAllowedSortFields = [
      "id",
      "username",
      "email",
      "createdAt",
      "updatedAt",
    ];

    return this.search(UserModel, {
      ...options,
      searchableFields: options.searchableFields || userSearchableFields,
      allowedSortFields: options.allowedSortFields || userAllowedSortFields,
    });
  }

  /**
   * Busca mensajes de chat en la base de datos.
   * @param {object} [options={}] - Opciones de búsqueda (ver `search` método).
   * @returns {Promise<object[]>} Un array de objetos de mensaje de chat encontrados.
   * @throws {Errores.BadRequestError} Si el modelo ChatMessage no está disponible.
   * @throws {Errores.InternalServerError} Si ocurre un error en la consulta.
   */
  async searchChatMessages(options = {}) {
    if (!ChatMessageModel) {
      throw new Errores.InternalServerError(
        "El modelo de mensaje de chat no está disponible para la búsqueda."
      );
    }
    // Definir campos buscables y ordenables específicos para el modelo ChatMessage.
    const chatMessageSearchableFields = ["message", "username"];
    const chatMessageAllowedSortFields = ["id", "userId", "timestamp", "type"];

    return this.search(ChatMessageModel, {
      ...options,
      searchableFields: options.searchableFields || chatMessageSearchableFields,
      allowedSortFields:
        options.allowedSortFields || chatMessageAllowedSortFields,
      sortBy: options.sortBy || "timestamp", // Por defecto ordenar mensajes por timestamp.
      sortOrder: options.sortOrder || "ASC", // Por defecto ordenar mensajes de más antiguo a más nuevo.
    });
  }

  // Opcional: Métodos para integrar con motores de búsqueda externos (ej. Elasticsearch).
  /**
   * Realiza una búsqueda avanzada utilizando un motor de búsqueda externo (placeholder).
   * @param {string} indexName - Nombre del índice donde buscar.
   * @param {object} queryBody - Cuerpo de la consulta para el motor de búsqueda.
   * @returns {Promise<object[]>} Resultados de la búsqueda del motor externo.
   * @throws {Errores.ServiceUnavailableError} Si el motor de búsqueda no está configurado o disponible.
   */
  async searchExternal(indexName, queryBody) {
    if (!this._advancedSearchEnabled) {
      throw new Errores.ServiceUnavailableError(
        "El servicio de búsqueda avanzada está deshabilitado."
      );
    }
    // Aquí iría la lógica para interactuar con un cliente de Elasticsearch, Algolia, etc.
    // Ejemplo:
    // const elasticsearchClient = require('../config/elasticsearchClient'); // Asume un archivo de configuración para el cliente ES.
    // if (!elasticsearchClient) {
    //     throw new Errores.InternalServerError('Cliente de Elasticsearch no configurado.');
    // }
    // try {
    //     const response = await elasticsearchClient.search({
    //         index: indexName,
    //         body: queryBody
    //     });
    //     logger.info(` [SearchService] Búsqueda externa en índice '${indexName}' completada.`);
    //     return response.hits.hits.map(hit => hit._source);
    // } catch (error) {
    //     logger.error(` [SearchService] Error al realizar búsqueda externa en índice '${indexName}':`, error);
    //     throw new Errores.InternalServerError('Error al realizar búsqueda externa.', error);
    // }

    logger.warn(
      " [SearchService] La búsqueda externa no está implementada. Esto es un placeholder."
    );
    return []; // Retorna un array vacío como placeholder.
  }
}

// Exporta una instancia única del servicio de búsqueda.
module.exports = new SearchService();
