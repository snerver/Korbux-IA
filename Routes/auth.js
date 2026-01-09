// routes/auth.js

/**
 * @file Rutas para la autenticación de usuarios.
 * @description Define los endpoints para el registro, inicio de sesión,
 * refresco de tokens, restablecimiento de contraseña y verificación de correo.
 * Estas rutas generalmente no requieren autenticación previa.
 * @module routes/auth
 */

const express = require("express");
const router = express.Router();
const path = require("path");

const logger = require(path.join(__dirname, "..", "config", "logger.js")); // Importa tu logger
const { Errores } = require(path.join(__dirname, "..", "utils", "errores.js")); // Importa tus clases de errores personalizados

// Importa el servicio de autenticación.
const authService = require(path.join(
  __dirname,
  "..",
  "services",
  "authService.js"
));

// Importa middlewares de validación específicos para las entradas de autenticación.
// Se asume que 'validationMiddleware.js' contiene funciones como 'validateRegistration', etc.
let validateRegistration;
let validateLogin;
let validatePasswordResetRequest;
let validatePasswordReset;
let validateEmailVerification;

try {
  const validationMiddleware = require(path.join(
    __dirname,
    "..",
    "middleware",
    "validationMiddleware.js"
  ));
  validateRegistration = validationMiddleware.validateRegistration;
  validateLogin = validationMiddleware.validateLogin;
  validatePasswordResetRequest =
    validationMiddleware.validatePasswordResetRequest;
  validatePasswordReset = validationMiddleware.validatePasswordReset;
  validateEmailVerification = validationMiddleware.validateEmailVerification;
} catch (e) {
  logger.error(
    " [Auth Routes] No se pudo cargar validationMiddleware.js. Las validaciones en rutas de autenticación no funcionarán. Error: " +
      e.message
  );
  // Define middlewares dummy que simplemente pasan al siguiente para evitar que la app se detenga en desarrollo.
  validateRegistration = (req, res, next) => next();
  validateLogin = (req, res, next) => next();
  validatePasswordResetRequest = (req, res, next) => next();
  validatePasswordReset = (req, res, next) => next();
  validateEmailVerification = (req, res, next) => next();
}

// ---------------------------------------------------
//  RUTA POST: Registrar un nuevo usuario
// Endpoint: POST /api/auth/register
// ---------------------------------------------------
router.post("/register", validateRegistration, async (req, res, next) => {
  logger.debug("[Auth Routes] Solicitud de registro de usuario.");
  try {
    const { username, email, password } = req.body;
    const newUser = await authService.registerUser(username, email, password);

    res.status(201).json({
      status: "success",
      message:
        "Usuario registrado exitosamente. Por favor, verifica tu correo electrónico.",
      data: newUser,
    });
  } catch (err) {
    logger.error(" [Auth Routes] Error en el registro de usuario:", err);
    next(err);
  }
});

// ---------------------------------------------------
//  RUTA POST: Iniciar sesión de usuario
// Endpoint: POST /api/auth/login
// ---------------------------------------------------
router.post("/login", validateLogin, async (req, res, next) => {
  logger.debug("[Auth Routes] Solicitud de inicio de sesión.");
  try {
    const { email, password } = req.body;
    const { accessToken, refreshToken, user } = await authService.loginUser(
      email,
      password
    );

    // Opcional: Establecer tokens en cookies HTTP-only para mayor seguridad.
    // res.cookie('accessToken', accessToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: 3600000 }); // 1 hora
    // res.cookie('refreshToken', refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: 604800000 }); // 7 días

    res.status(200).json({
      status: "success",
      message: "Inicio de sesión exitoso.",
      data: {
        accessToken,
        refreshToken,
        user,
      },
    });
  } catch (err) {
    logger.error(" [Auth Routes] Error en el inicio de sesión:", err);
    next(err);
  }
});

// ---------------------------------------------------
//  RUTA POST: Refrescar token de acceso
// Endpoint: POST /api/auth/refresh-token
// Requiere un token de refresco válido en el cuerpo o en una cookie.
// ---------------------------------------------------
router.post("/refresh-token", async (req, res, next) => {
  logger.debug("[Auth Routes] Solicitud de refresco de token.");
  try {
    // Obtener el refresh token del cuerpo o de las cookies.
    const refreshToken = req.body.refreshToken || req.cookies?.refreshToken;

    if (!refreshToken) {
      throw new Errores.BadRequestError("Token de refresco no proporcionado.");
    }

    const newAccessToken = await authService.refreshAccessToken(refreshToken);

    // Opcional: Actualizar la cookie del access token si se usa.
    // res.cookie('accessToken', newAccessToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: 3600000 });

    res.status(200).json({
      status: "success",
      message: "Token de acceso refrescado exitosamente.",
      data: {
        accessToken: newAccessToken,
      },
    });
  } catch (err) {
    logger.error(" [Auth Routes] Error al refrescar token:", err);
    next(err);
  }
});

// ---------------------------------------------------
//  RUTA POST: Solicitar restablecimiento de contraseña
// Endpoint: POST /api/auth/request-password-reset
// Envía un correo con un enlace de restablecimiento.
// ---------------------------------------------------
router.post(
  "/request-password-reset",
  validatePasswordResetRequest,
  async (req, res, next) => {
    logger.debug("[Auth Routes] Solicitud de restablecimiento de contraseña.");
    try {
      const { email } = req.body;
      await authService.requestPasswordReset(email);

      res.status(200).json({
        status: "success",
        message:
          "Si el correo electrónico está registrado, se ha enviado un enlace para restablecer la contraseña.",
      });
    } catch (err) {
      logger.error(
        " [Auth Routes] Error al solicitar restablecimiento de contraseña:",
        err
      );
      next(err);
    }
  }
);

// ---------------------------------------------------
//  RUTA POST: Restablecer contraseña
// Endpoint: POST /api/auth/reset-password
// Utiliza el token del enlace de restablecimiento.
// ---------------------------------------------------
router.post(
  "/reset-password",
  validatePasswordReset,
  async (req, res, next) => {
    logger.debug(
      "[Auth Routes] Solicitud de restablecimiento de contraseña (confirmación)."
    );
    try {
      const { token, newPassword } = req.body;
      await authService.resetPassword(token, newPassword);

      res.status(200).json({
        status: "success",
        message: "Contraseña restablecida exitosamente.",
      });
    } catch (err) {
      logger.error(" [Auth Routes] Error al restablecer contraseña:", err);
      next(err);
    }
  }
);

// ---------------------------------------------------
//  RUTA GET: Verificar correo electrónico
// Endpoint: GET /api/auth/verify-email
// Utiliza un token de verificación enviado por correo.
// ---------------------------------------------------
router.get(
  "/verify-email",
  validateEmailVerification,
  async (req, res, next) => {
    logger.debug(
      "[Auth Routes] Solicitud de verificación de correo electrónico."
    );
    try {
      const { token } = req.query; // El token suele venir como query parameter.
      await authService.verifyEmail(token);

      res.status(200).json({
        status: "success",
        message:
          "Correo electrónico verificado exitosamente. Ya puedes iniciar sesión.",
      });
      // Opcional: Redirigir a una página de éxito en el frontend.
      // res.redirect('/verification-success');
    } catch (err) {
      logger.error(
        " [Auth Routes] Error al verificar correo electrónico:",
        err
      );
      next(err);
    }
  }
);

// ---------------------------------------------------
//  Ruta Catch-all para 404 dentro de /api/auth
// Este middleware DEBE ser el ÚLTIMO en este archivo de rutas.
// Si una solicitud llega a este router `/api/auth` pero no coincide con ninguna de las rutas
// definidas anteriormente, se considera un 404 (Not Found) dentro de este contexto.
// ---------------------------------------------------
router.use((req, res, next) => {
  next(
    new Errores.NotFoundError(
      `La ruta de autenticación solicitada (${req.method} ${req.originalUrl}) no fue encontrada en este módulo.`
    )
  );
});

//  Exportación del router para que pueda ser utilizado por 'app.js' (o 'server.js').
module.exports = router;
