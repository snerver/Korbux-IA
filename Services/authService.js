// services/authService.js

/**
 * @file Servicio para la gestión de autenticación y autorización de usuarios.
 * @description Centraliza la lógica de negocio para el registro, inicio de sesión,
 * gestión de tokens JWT, restablecimiento de contraseñas y verificación de correo electrónico.
 */

const path = require("path");
const bcrypt = require("bcryptjs"); // Para hashear y comparar contraseñas.
const jwt = require("jsonwebtoken"); // Para crear y verificar JSON Web Tokens.

const logger = require(path.join(__dirname, "..", "config", "logger.js")); // Importa tu logger
const Errores = require(path.join(__dirname, "..", "utils", "errores.js")); // Importa tus clases de errores personalizados
const config = require(path.join(__dirname, "..", "config")); // Importa tu configuración centralizada

// Importa el modelo User. Asegúrate de que este modelo esté definido en tu carpeta models/.
// Por ejemplo, en models/User.js.
let User;
try {
  User = require(path.join(__dirname, "..", "models", "User.js"));
  // Opcional: Si tienes un modelo Token para restablecimiento/verificación.
  // let Token = require(path.join(__dirname, '..', 'models', 'Token.js'));
} catch (e) {
  logger.error(
    " [AuthService] No se pudo cargar el modelo User. Asegúrate de que models/User.js exista y esté configurado.",
    e
  );
  // Define un modelo dummy para evitar errores si el real no se carga.
  User = {
    findOne: async () => null,
    create: async () => {
      throw new Error("User model not loaded.");
    },
  };
}

/**
 * @class AuthService
 * @description Clase que proporciona métodos para la autenticación y gestión de usuarios.
 */
class AuthService {
  constructor() {
    this.jwtSecret = config.get("security.jwtSecret");
    this.jwtExpiresIn = config.get("security.jwtExpiresIn");
    this.jwtRefreshSecret = config.get("security.jwtRefreshSecret");
    this.jwtRefreshExpiresIn = config.get("security.jwtRefreshExpiresIn");
    this.passwordSaltRounds = 10; // Número de rondas de sal para bcrypt.

    if (!this.jwtSecret || this.jwtSecret === "clave_jwt_insegura_dev") {
      logger.warn(
        " [AuthService] JWT_SECRET no está configurado o es inseguro. ¡Cámbialo en producción!"
      );
    }
    if (
      !this.jwtRefreshSecret ||
      this.jwtRefreshSecret === "clave_refresh_insegura_dev"
    ) {
      logger.warn(
        " [AuthService] JWT_REFRESH_SECRET no está configurado o es inseguro. ¡Cámbialo en producción!"
      );
    }

    logger.info("[AuthService] Servicio de autenticación inicializado.");
  }

  /**
   * Genera un token de acceso JWT.
   * @private
   * @param {object} payload - Datos a incluir en el token.
   * @returns {string} El token de acceso JWT.
   */
  _generateAccessToken(payload) {
    return jwt.sign(payload, this.jwtSecret, { expiresIn: this.jwtExpiresIn });
  }

  /**
   * Genera un token de refresco JWT.
   * @private
   * @param {object} payload - Datos a incluir en el token.
   * @returns {string} El token de refresco JWT.
   */
  _generateRefreshToken(payload) {
    return jwt.sign(payload, this.jwtRefreshSecret, {
      expiresIn: this.jwtRefreshExpiresIn,
    });
  }

  /**
   * Registra un nuevo usuario en el sistema.
   * @param {string} username - Nombre de usuario.
   * @param {string} email - Correo electrónico del usuario (debe ser único).
   * @param {string} password - Contraseña del usuario (se hasheará).
   * @returns {Promise<object>} El objeto de usuario creado (sin la contraseña).
   * @throws {Errores.BadRequestError} Si el email ya está registrado o los datos son inválidos.
   * @throws {Errores.InternalServerError} Si ocurre un error al crear el usuario.
   */
  async registerUser(username, email, password) {
    if (!username || !email || !password) {
      throw new Errores.BadRequestError(
        "Nombre de usuario, correo electrónico y contraseña son obligatorios."
      );
    }

    // Validar formato de email (básico, se puede mejorar con una librería de validación).
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Errores.BadRequestError(
        "Formato de correo electrónico inválido."
      );
    }

    try {
      const existingUser = await User.findOne({ where: { email } });
      if (existingUser) {
        throw new Errores.BadRequestError(
          "El correo electrónico ya está registrado."
        );
      }

      const hashedPassword = await bcrypt.hash(
        password,
        this.passwordSaltRounds
      );

      const newUser = await User.create({
        username,
        email,
        passwordHash: hashedPassword,
        // Otros campos por defecto, ej. isActive: false, roleId: defaultRoleId
      });

      logger.info(`✔️ [AuthService] Usuario registrado: ${newUser.email}`);
      // Retornar solo datos seguros del usuario.
      const { passwordHash, ...userWithoutPassword } = newUser.toJSON();
      return userWithoutPassword;
    } catch (error) {
      if (error instanceof Errores.BadRequestError) {
        throw error; // Re-lanzar errores de validación específicos.
      }
      logger.error(
        ` [AuthService] Error al registrar usuario '${email}':`,
        error
      );
      throw new Errores.InternalServerError(
        "Error al registrar el usuario.",
        error
      );
    }
  }

  /**
   * Inicia sesión de un usuario y genera tokens de acceso y refresco.
   * @param {string} email - Correo electrónico del usuario.
   * @param {string} password - Contraseña del usuario.
   * @returns {Promise<object>} Un objeto con el token de acceso, token de refresco y datos del usuario.
   * @throws {Errores.UnauthorizedError} Si las credenciales son inválidas.
   * @throws {Errores.InternalServerError} Si ocurre un error inesperado.
   */
  async loginUser(email, password) {
    if (!email || !password) {
      throw new Errores.BadRequestError(
        "Correo electrónico y contraseña son obligatorios."
      );
    }

    try {
      const user = await User.findOne({ where: { email } });
      if (!user) {
        throw new Errores.UnauthorizedError("Credenciales inválidas.");
      }

      const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
      if (!isPasswordValid) {
        throw new Errores.UnauthorizedError("Credenciales inválidas.");
      }

      // Opcional: Verificar si la cuenta está activa.
      // if (!user.isActive) {
      //     throw new Errores.UnauthorizedError('La cuenta no está activa. Por favor, verifica tu correo electrónico.');
      // }

      const payload = {
        userId: user.id,
        email: user.email,
        username: user.username,
        // role: user.role // Incluir rol si lo tienes.
      };

      const accessToken = this._generateAccessToken(payload);
      const refreshToken = this._generateRefreshToken(payload);

      // Opcional: Guardar el refresh token en la DB para invalidación.
      // await user.update({ refreshToken: refreshToken }); // Asumiendo campo en el modelo User

      logger.info(
        ` [AuthService] Usuario '${user.email}' ha iniciado sesión.`
      );
      return {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          // role: user.role
        },
      };
    } catch (error) {
      if (
        error instanceof Errores.UnauthorizedError ||
        error instanceof Errores.BadRequestError
      ) {
        throw error;
      }
      logger.error(
        ` [AuthService] Error al iniciar sesión para '${email}':`,
        error
      );
      throw new Errores.InternalServerError("Error al iniciar sesión.", error);
    }
  }

  /**
   * Refresca un token de acceso JWT utilizando un token de refresco válido.
   * @param {string} refreshToken - El token de refresco proporcionado por el cliente.
   * @returns {Promise<string>} Un nuevo token de acceso.
   * @throws {Errores.UnauthorizedError} Si el token de refresco es inválido o ha expirado.
   * @throws {Errores.InternalServerError} Si ocurre un error inesperado.
   */
  async refreshAccessToken(refreshToken) {
    if (!refreshToken) {
      throw new Errores.BadRequestError("Token de refresco es obligatorio.");
    }

    try {
      const decoded = jwt.verify(refreshToken, this.jwtRefreshSecret);

      // Opcional: Verificar que el refresh token exista en la DB y no haya sido invalidado.
      // const user = await User.findOne({ where: { id: decoded.userId, refreshToken: refreshToken } });
      // if (!user) {
      //     throw new Errores.UnauthorizedError('Token de refresco inválido o no encontrado.');
      // }

      const newAccessToken = this._generateAccessToken({
        userId: decoded.userId,
        email: decoded.email,
        username: decoded.username,
        // role: decoded.role
      });

      logger.info(
        ` [AuthService] Token de acceso refrescado para usuario ID: ${decoded.userId}`
      );
      return newAccessToken;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Errores.UnauthorizedError("Token de refresco expirado.");
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Errores.UnauthorizedError("Token de refresco inválido.");
      }
      logger.error(
        ` [AuthService] Error al refrescar token de acceso:`,
        error
      );
      throw new Errores.InternalServerError(
        "Error al refrescar token de acceso.",
        error
      );
    }
  }

  /**
   * Solicita un restablecimiento de contraseña para un usuario.
   * Genera un token de restablecimiento y lo envía por correo electrónico.
   * @param {string} email - Correo electrónico del usuario.
   * @returns {Promise<void>}
   * @throws {Errores.NotFoundError} Si el usuario no existe.
   * @throws {Errores.InternalServerError} Si falla el envío del correo o la generación del token.
   */
  async requestPasswordReset(email) {
    if (!email) {
      throw new Errores.BadRequestError("Correo electrónico es obligatorio.");
    }

    try {
      const user = await User.findOne({ where: { email } });
      if (!user) {
        // Para seguridad, no indicar si el email existe o no.
        logger.warn(
          ` [AuthService] Intento de restablecimiento de contraseña para email no encontrado: ${email}`
        );
        // Aun así, retornamos éxito para no dar pistas a atacantes.
        return;
      }

      // Generar un token único y seguro para el restablecimiento.
      const resetToken = jwt.sign({ userId: user.id }, this.jwtSecret, {
        expiresIn: "1h",
      }); // Token de corta duración.

      // Opcional: Guardar el token en la DB (ej. en un modelo Token o en el usuario).
      // await Token.create({ userId: user.id, type: 'password_reset', token: resetTokenHash, expiresAt: new Date(Date.now() + 3600000) });
      // O: await user.update({ resetToken: resetToken, resetTokenExpires: new Date(Date.now() + 3600000) });

      // Aquí deberías integrar tu emailService para enviar el correo.
      // const emailService = require('./emailService'); // Importar el servicio de email
      // await emailService.sendPasswordResetEmail(user.email, resetToken);

      logger.info(
        ` [AuthService] Solicitud de restablecimiento de contraseña para ${email} procesada.`
      );
    } catch (error) {
      logger.error(
        ` [AuthService] Error al solicitar restablecimiento de contraseña para '${email}':`,
        error
      );
      throw new Errores.InternalServerError(
        "Error al solicitar restablecimiento de contraseña.",
        error
      );
    }
  }

  /**
   * Restablece la contraseña de un usuario utilizando un token de restablecimiento.
   * @param {string} token - El token de restablecimiento recibido por correo.
   * @param {string} newPassword - La nueva contraseña.
   * @returns {Promise<void>}
   * @throws {Errores.BadRequestError} Si el token es inválido o la contraseña es débil.
   * @throws {Errores.UnauthorizedError} Si el token ha expirado o no es válido.
   * @throws {Errores.InternalServerError} Si ocurre un error al actualizar la contraseña.
   */
  async resetPassword(token, newPassword) {
    if (!token || !newPassword) {
      throw new Errores.BadRequestError(
        "Token y nueva contraseña son obligatorios."
      );
    }

    // Opcional: Validar fortaleza de la nueva contraseña.
    if (newPassword.length < 8) {
      throw new Errores.BadRequestError(
        "La contraseña debe tener al menos 8 caracteres."
      );
    }

    try {
      const decoded = jwt.verify(token, this.jwtSecret); // Verificar el token.

      // Opcional: Buscar el token en la DB para asegurar que es válido y no ha sido usado.
      // const tokenRecord = await Token.findOne({ where: { userId: decoded.userId, type: 'password_reset', token: tokenHash, expiresAt: { [Op.gt]: new Date() } } });
      // if (!tokenRecord) {
      //     throw new Errores.UnauthorizedError('Token de restablecimiento inválido o expirado.');
      // }

      const user = await User.findByPk(decoded.userId);
      if (!user) {
        throw new Errores.UnauthorizedError(
          "Usuario no encontrado para el token."
        );
      }

      const hashedPassword = await bcrypt.hash(
        newPassword,
        this.passwordSaltRounds
      );
      await user.update({
        passwordHash: hashedPassword,
        // resetToken: null, // Limpiar el token de restablecimiento en la DB.
        // resetTokenExpires: null,
      });

      // Opcional: Marcar el token como usado o eliminarlo de la DB.
      // await tokenRecord.destroy();

      logger.info(
        ` [AuthService] Contraseña restablecida para usuario ID: ${user.id}`
      );
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Errores.UnauthorizedError(
          "Token de restablecimiento expirado."
        );
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Errores.UnauthorizedError(
          "Token de restablecimiento inválido."
        );
      }
      if (
        error instanceof Errores.BadRequestError ||
        error instanceof Errores.UnauthorizedError
      ) {
        throw error;
      }
      logger.error(` [AuthService] Error al restablecer contraseña:`, error);
      throw new Errores.InternalServerError(
        "Error al restablecer la contraseña.",
        error
      );
    }
  }

  /**
   * Verifica la dirección de correo electrónico de un usuario.
   * @param {string} verificationToken - El token de verificación de correo.
   * @returns {Promise<void>}
   * @throws {Errores.BadRequestError} Si el token es inválido.
   * @throws {Errores.UnauthorizedError} Si el token ha expirado o no es válido.
   * @throws {Errores.InternalServerError} Si ocurre un error al verificar el correo.
   */
  async verifyEmail(verificationToken) {
    if (!verificationToken) {
      throw new Errores.BadRequestError(
        "Token de verificación es obligatorio."
      );
    }

    try {
      const decoded = jwt.verify(verificationToken, this.jwtSecret); // Asumiendo el mismo secreto JWT.

      // Buscar el token en la DB y verificar su validez (tipo, expiración, si ya fue usado).
      // const tokenRecord = await Token.findOne({ where: { userId: decoded.userId, type: 'email_verification', token: verificationTokenHash, expiresAt: { [Op.gt]: new Date() } } });
      // if (!tokenRecord) {
      //     throw new Errores.UnauthorizedError('Token de verificación inválido o expirado.');
      // }

      const user = await User.findByPk(decoded.userId);
      if (!user) {
        throw new Errores.UnauthorizedError(
          "Usuario no encontrado para el token de verificación."
        );
      }

      if (user.isEmailVerified) {
        logger.warn(
          ` [AuthService] Intento de verificar email ya verificado para usuario ID: ${user.id}`
        );
        return; // Ya verificado, no hacer nada.
      }

      await user.update({ isEmailVerified: true });

      // Marcar el token como usado o eliminarlo de la DB.
      // await tokenRecord.destroy();

      logger.info(
        ` [AuthService] Correo electrónico verificado para usuario ID: ${user.id}`
      );
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Errores.UnauthorizedError("Token de verificación expirado.");
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Errores.UnauthorizedError("Token de verificación inválido.");
      }
      if (
        error instanceof Errores.BadRequestError ||
        error instanceof Errores.UnauthorizedError
      ) {
        throw error;
      }
      logger.error(
        ` [AuthService] Error al verificar correo electrónico:`,
        error
      );
      throw new Errores.InternalServerError(
        "Error al verificar el correo electrónico.",
        error
      );
    }
  }
}

// Exporta una instancia única del servicio de autenticación.
module.exports = new AuthService();
