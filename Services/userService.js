// services/userService.js

/**
 * @file Servicio de lógica de negocio para la gestión de usuarios.
 * @description Centraliza las operaciones CRUD (Crear, Leer, Actualizar, Eliminar)
 * de usuarios, manteniendo la separación de responsabilidades con el servicio de autenticación.
 * @module services/userService
 */

const path = require("path");
const logger = require(path.join(__dirname, "..", "config", "logger.js")); // Importa tu logger
const { Errores } = require(path.join(__dirname, "..", "utils", "errores.js")); // Importa tus clases de errores personalizados

// Importa el modelo User. Asegúrate de que este modelo esté definido en tu carpeta models/.
// Por ejemplo, en models/User.js.
let UserModel;
try {
  UserModel = require(path.join(__dirname, "..", "models", "User.js"));
} catch (e) {
  logger.error(
    " [UserService] No se pudo cargar el modelo User. Asegúrate de que models/User.js exista y esté configurado.",
    e
  );
  // Define un modelo dummy para evitar errores si el real no se carga.
  UserModel = {
    create: async (data) => {
      logger.warn(
        " [UserService] Operación de DB simulada: User model no cargado."
      );
      return data;
    },
    findByPk: async () => {
      logger.warn(
        " [UserService] Operación de DB simulada: User model no cargado."
      );
      return null;
    },
    findAll: async () => {
      logger.warn(
        " [UserService] Operación de DB simulada: User model no cargado."
      );
      return [];
    },
    update: async () => {
      logger.warn(
        " [UserService] Operación de DB simulada: User model no cargado."
      );
      return [0];
    },
    destroy: async () => {
      logger.warn(
        " [UserService] Operación de DB simulada: User model no cargado."
      );
      return 0;
    },
    findOne: async () => {
      logger.warn(
        " [UserService] Operación de DB simulada: User model no cargado."
      );
      return null;
    },
  };
}

/**
 * @class UserService
 * @description Clase que gestiona las operaciones de negocio relacionadas con los usuarios.
 */
class UserService {
  constructor() {
    logger.info("[UserService] Servicio de usuario inicializado.");
  }

  /**
   * Crea un nuevo usuario en la base de datos.
   * Nota: El hashing de la contraseña debe realizarse en el `authService` o en un hook del modelo `User`
   * antes de llamar a este método, o este método podría delegar en `authService.registerUser`.
   * Este método asume que la contraseña ya está hasheada si se pasa.
   *
   * @param {object} userData - Datos del nuevo usuario.
   * @param {string} userData.username - Nombre de usuario.
   * @param {string} userData.email - Correo electrónico (debe ser único).
   * @param {string} userData.passwordHash - Contraseña hasheada.
   * @param {string} [userData.role='user'] - Rol del usuario.
   * @returns {Promise<object>} El objeto de usuario creado (sin la contraseña hasheada).
   * @throws {Errores.BadRequestError} Si los datos son inválidos o el email ya existe.
   * @throws {Errores.InternalServerError} Si ocurre un error al crear el usuario.
   */
  async createUser(userData) {
    if (
      !userData ||
      !userData.username ||
      !userData.email ||
      !userData.passwordHash
    ) {
      logger.warn(
        " [UserService] Intento de crear usuario con datos incompletos."
      );
      throw new Errores.BadRequestError(
        "Nombre de usuario, correo electrónico y contraseña hasheada son obligatorios."
      );
    }

    try {
      // Verificar si el email ya está en uso.
      const existingUser = await UserModel.findOne({
        where: { email: userData.email },
      });
      if (existingUser) {
        logger.warn(
          ` [UserService] Intento de crear usuario con email ya registrado: ${userData.email}`
        );
        throw new Errores.BadRequestError(
          "El correo electrónico ya está registrado."
        );
      }

      const newUser = await UserModel.create({
        username: userData.username,
        email: userData.email,
        passwordHash: userData.passwordHash,
        role: userData.role || "user", // Rol por defecto.
        // Otros campos por defecto si los tienes en tu modelo.
      });

      logger.info(
        ` [UserService] Usuario creado: ${newUser.email} (ID: ${newUser.id}).`
      );
      // Retornar solo datos seguros del usuario.
      const { passwordHash, ...userWithoutPassword } = newUser.toJSON();
      return userWithoutPassword;
    } catch (error) {
      if (error instanceof Errores.AppError) {
        throw error; // Re-lanzar errores de aplicación específicos.
      }
      logger.error(
        ` [UserService] Error al crear usuario '${userData.email}':`,
        error
      );
      throw new Errores.InternalServerError(
        "Error al crear el usuario.",
        error
      );
    }
  }

  /**
   * Obtiene un usuario por su ID.
   * @param {string} userId - El ID único del usuario.
   * @returns {Promise<object|null>} El objeto de usuario, o null si no se encuentra.
   * @throws {Errores.BadRequestError} Si el ID de usuario es inválido.
   * @throws {Errores.InternalServerError} Si ocurre un error al acceder a la base de datos.
   */
  async getUserById(userId) {
    if (!userId || typeof userId !== "string" || userId.trim() === "") {
      logger.warn(
        ` [UserService] Intento de obtener usuario con ID inválido: '${userId}'`
      );
      throw new Errores.BadRequestError(
        "El ID de usuario es requerido y debe ser una cadena válida."
      );
    }

    try {
      const user = await UserModel.findByPk(userId, {
        attributes: { exclude: ["passwordHash"] }, // Excluir el hash de la contraseña por seguridad.
      });

      if (!user) {
        logger.info(`[UserService] Usuario con ID ${userId} no encontrado.`);
        return null;
      }

      logger.debug(` [UserService] Usuario con ID ${userId} encontrado.`);
      return user.toJSON(); // Convertir a objeto plano.
    } catch (error) {
      logger.error(
        ` [UserService] Error al obtener usuario por ID ${userId}:`,
        error
      );
      throw new Errores.InternalServerError(
        "Error al obtener el usuario.",
        error
      );
    }
  }

  /**
   * Obtiene una lista de todos los usuarios (con paginación y filtrado opcional).
   * @param {object} [options={}] - Opciones de consulta.
   * @param {number} [options.limit=20] - Número máximo de usuarios a devolver.
   * @param {number} [options.offset=0] - Número de usuarios a omitir (para paginación).
   * @param {string} [options.sortBy='createdAt'] - Campo por el cual ordenar.
   * @param {'ASC'|'DESC'} [options.sortOrder='DESC'] - Orden de clasificación.
   * @param {object} [options.filters={}] - Filtros adicionales (ej. { role: 'admin' }).
   * @param {string} [options.searchText=''] - Texto para buscar en campos como username o email.
   * @returns {Promise<object[]>} Un array de objetos de usuario.
   * @throws {Errores.InternalServerError} Si ocurre un error al acceder a la base de datos.
   */
  async getAllUsers(options = {}) {
    const {
      limit = 20,
      offset = 0,
      sortBy = "createdAt",
      sortOrder = "DESC",
      filters = {},
      searchText = "",
    } = options;

    try {
      // Campos permitidos para la ordenación.
      const allowedSortFields = [
        "id",
        "username",
        "email",
        "role",
        "createdAt",
        "updatedAt",
      ];
      const finalSortBy = allowedSortFields.includes(sortBy)
        ? sortBy
        : "createdAt";
      const finalSortOrder = ["ASC", "DESC"].includes(sortOrder.toUpperCase())
        ? sortOrder.toUpperCase()
        : "DESC";

      // Construir la cláusula where.
      const whereClause = { ...filters };
      if (searchText) {
        // Asumiendo que Op está disponible (importado desde sequelizeInstance.Op)
        whereClause[Op.or] = [
          { username: { [Op.like]: `%${searchText}%` } },
          { email: { [Op.like]: `%${searchText}%` } },
        ];
      }

      const users = await UserModel.findAll({
        where: whereClause,
        limit: limit,
        offset: offset,
        order: [[finalSortBy, finalSortOrder]],
        attributes: { exclude: ["passwordHash"] }, // Excluir el hash de la contraseña.
      });

      logger.info(
        ` [UserService] ${users.length} usuarios obtenidos (limit: ${limit}, offset: ${offset}).`
      );
      return users.map((user) => user.toJSON());
    } catch (error) {
      logger.error(
        " [UserService] Error al obtener todos los usuarios:",
        error
      );
      throw new Errores.InternalServerError(
        "Error al obtener la lista de usuarios.",
        error
      );
    }
  }

  /**
   * Actualiza la información de un usuario existente.
   * @param {string} userId - El ID único del usuario a actualizar.
   * @param {object} updateData - Objeto con los campos a actualizar (ej. { username: 'NuevoNombre', role: 'admin' }).
   * @returns {Promise<object>} El objeto de usuario actualizado (sin la contraseña hasheada).
   * @throws {Errores.BadRequestError} Si el ID de usuario es inválido o los datos de actualización son inválidos.
   * @throws {Errores.NotFoundError} Si el usuario no se encuentra.
   * @throws {Errores.InternalServerError} Si ocurre un error al actualizar el usuario.
   */
  async updateUser(userId, updateData) {
    if (!userId || typeof userId !== "string" || userId.trim() === "") {
      logger.warn(
        ` [UserService] Intento de actualizar usuario con ID inválido: '${userId}'`
      );
      throw new Errores.BadRequestError(
        "El ID de usuario es requerido y debe ser una cadena válida para actualizar."
      );
    }
    if (!updateData || Object.keys(updateData).length === 0) {
      logger.warn(
        ` [UserService] Intento de actualizar usuario ${userId} sin datos de actualización.`
      );
      throw new Errores.BadRequestError(
        "Se requieren datos para actualizar el usuario."
      );
    }

    // Evitar que se actualice directamente el passwordHash o el ID.
    const forbiddenFields = ["id", "passwordHash", "createdAt"];
    for (const field of forbiddenFields) {
      if (updateData.hasOwnProperty(field)) {
        logger.warn(
          ` [UserService] Intento de actualizar campo prohibido: ${field} para usuario ${userId}.`
        );
        throw new Errores.BadRequestError(
          `No se permite actualizar el campo '${field}'.`
        );
      }
    }

    try {
      const user = await UserModel.findByPk(userId);
      if (!user) {
        logger.info(
          `[UserService] Usuario con ID ${userId} no encontrado para actualizar.`
        );
        throw new Errores.NotFoundError("Usuario no encontrado.");
      }

      // Si se intenta actualizar el email, verificar unicidad.
      if (updateData.email && updateData.email !== user.email) {
        const existingUserWithEmail = await UserModel.findOne({
          where: { email: updateData.email },
        });
        if (existingUserWithEmail && existingUserWithEmail.id !== userId) {
          logger.warn(
            ` [UserService] Intento de actualizar email a uno ya en uso: ${updateData.email} para usuario ${userId}.`
          );
          throw new Errores.BadRequestError(
            "El nuevo correo electrónico ya está en uso por otro usuario."
          );
        }
      }

      const [updatedRows] = await UserModel.update(updateData, {
        where: { id: userId },
        returning: true, // Para PostgreSQL, devuelve los registros actualizados.
      });

      if (updatedRows === 0) {
        // Esto podría ocurrir si el usuario fue eliminado justo antes de la actualización,
        // o si no hubo cambios reales en los datos.
        logger.warn(
          ` [UserService] No se pudo actualizar el usuario ${userId} (0 filas afectadas).`
        );
        throw new Errores.InternalServerError(
          "No se pudo actualizar el usuario. Es posible que no haya cambios o que el usuario no exista."
        );
      }

      // Obtener el usuario actualizado para retornarlo.
      const updatedUser = await UserModel.findByPk(userId, {
        attributes: { exclude: ["passwordHash"] },
      });

      logger.info(
        ` [UserService] Usuario con ID ${userId} actualizado exitosamente.`
      );
      return updatedUser.toJSON();
    } catch (error) {
      if (error instanceof Errores.AppError) {
        throw error;
      }
      logger.error(
        ` [UserService] Error al actualizar usuario ${userId}:`,
        error
      );
      throw new Errores.InternalServerError(
        "Error al actualizar el usuario.",
        error
      );
    }
  }

  /**
   * Elimina un usuario de la base de datos.
   * @param {string} userId - El ID único del usuario a eliminar.
   * @returns {Promise<boolean>} True si el usuario fue eliminado, false si no se encontró.
   * @throws {Errores.BadRequestError} Si el ID de usuario es inválido.
   * @throws {Errores.InternalServerError} Si ocurre un error al eliminar el usuario.
   */
  async deleteUser(userId) {
    if (!userId || typeof userId !== "string" || userId.trim() === "") {
      logger.warn(
        ` [UserService] Intento de eliminar usuario con ID inválido: '${userId}'`
      );
      throw new Errores.BadRequestError(
        "El ID de usuario es requerido y debe ser una cadena válida para eliminar."
      );
    }

    try {
      const deletedRows = await UserModel.destroy({
        where: { id: userId },
      });

      if (deletedRows === 0) {
        logger.info(
          `[UserService] Usuario con ID ${userId} no encontrado para eliminar.`
        );
        return false; // No se encontró el usuario.
      }

      logger.info(
        ` [UserService] Usuario con ID ${userId} eliminado exitosamente.`
      );
      return true; // Usuario eliminado.
    } catch (error) {
      logger.error(
        ` [UserService] Error al eliminar usuario ${userId}:`,
        error
      );
      throw new Errores.InternalServerError(
        "Error al eliminar el usuario.",
        error
      );
    }
  }
}

// Exporta una instancia única del servicio de usuario.
module.exports = new UserService();
