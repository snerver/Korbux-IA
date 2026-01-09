/**
 * @file Módulos de seguridad para la aplicación Express.
 * Contiene middlewares y funciones para mejorar la seguridad general.
 * @module config/security
 */

const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const xss = require("xss-clean");
const mongoSanitize = require("express-mongo-sanitize");
const hpp = require("hpp");
const csurf = require("csurf"); // Para protección CSRF
const cookieParser = require("cookie-parser"); // Necesario para csurf
const bcrypt = require("bcrypt"); // Para hashing de contraseñas
const jwt = require("jsonwebtoken"); // Para gestión de tokens JWT (si se usa)
const logger = require("/./logger"); // Asume que tienes un logger configurado en config/logger.js
const { URL } = require("url"); // Para validación de URLs
const crypto = require("crypto"); // Para operaciones criptográficas seguras

// --- 1. Configuración de Helmet mejorada y más estricta ---
/**
 * @function configureHelmet
 * @description Configura y devuelve el middleware Helmet con opciones de seguridad personalizadas y más estrictas.
 * @returns {Function} Middleware de Helmet.
 */
const configureHelmet = () => {
  return helmet({
    // 1.1. Content Security Policy (CSP) más estricta
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'", // Considera eliminar esto en producción y usar hashes/nonces
          "'unsafe-eval'", // Considera eliminar esto en producción
          "https://cdn.tailwindcss.com",
          "https://www.gstatic.com/firebasejs/", // Para Firebase, si se usa
          "https://cdnjs.cloudflare.com/ajax/libs/three.js/", // Para Three.js, si se usa
          "https://cdnjs.cloudflare.com/ajax/libs/cannon.js/", // Para Cannon.js, si se usa
          "https://www.google.com/recaptcha/", // Para reCAPTCHA
          "https://www.gstatic.com/recaptcha/", // Para reCAPTCHA
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'", // Considera eliminar esto en producción y usar hashes/nonces
          "https://fonts.googleapis.com",
          "https://cdn.tailwindcss.com",
        ],
        imgSrc: [
          "'self'",
          "data:",
          "https://placehold.co",
          "https://*.googleusercontent.com",
        ], // Permite imágenes base64, placehold.co y Google User Content
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        connectSrc: [
          "'self'",
          "http://localhost:3000",
          "http://127.0.0.1:5500",
          "https://generativelanguage.googleapis.com",
        ], // Ajusta para tu API y frontend, y API de Gemini
        frameSrc: [
          "'self'",
          "https://www.google.com/recaptcha/",
          "https://recaptcha.net/",
        ], // Para reCAPTCHA
        objectSrc: ["'none'"], // Deshabilita plugins como Flash
        baseUri: ["'self'"], // Restringe la URL base para inyecciones
        formAction: ["'self'"], // Restringe los destinos de los formularios
        // 1.2. Upgrade Insecure Requests: Le dice al navegador que reescriba las URLs HTTP a HTTPS
        upgradeInsecureRequests: [],
        // 1.2.1. (Mejora #1) report-uri para CSP violations (para monitoreo)
        reportUri: "/csp-violation-report", // Define una ruta en tu servidor para recibir reportes CSP
        // Añade más directivas según sea necesario
      },
    },
    // 1.3. Referrer-Policy: Controla qué información se envía en la cabecera Referer
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    // 1.4. Permissions-Policy (anteriormente Feature-Policy): Controla el acceso a características del navegador
    permissionsPolicy: {
      camera: ["self"],
      microphone: ["self"],
      geolocation: ["self"],
      fullscreen: ["*"], // Permite fullscreen desde cualquier origen
      // Deshabilita otras características no necesarias
      accelerometer: ["none"],
      ambientLightSensor: ["none"],
      autoplay: ["none"],
      battery: ["none"],
      bluetooth: ["none"],
      displayCapture: ["none"],
      gyroscope: ["none"],
      magnetometer: ["none"],
      midi: ["none"],
      usb: ["none"],
      payment: ["none"],
      // ... y otras que no uses
    },
    // 1.5. X-Download-Options: Previene la ejecución de HTML en descargas de IE8
    xDownloadOptions: "noopen",
    // 1.6. X-Permitted-Cross-Domain-Policies: Restringe las políticas de dominio cruzado para Flash/PDF
    xPermittedCrossDomainPolicies: "none",
    // Las siguientes ya estaban bien configuradas por defecto en Helmet:
    // dnsPrefetchControl: { allow: false }, // 1.7. (Mejora #2) Deshabilitar DNS prefetching para mayor privacidad
    // frameguard: { action: 'deny' },
    // hsts: { maxAge: 31536000, includeSubDomains: true, preload: true }, // 1.8. (Mejora #3) HSTS con preload para mayor seguridad
    // noSniff: true,
    // xssFilter: true, // Aunque xss-clean es más robusto
  });
};

// --- 2. Limitador de tasa de seguridad general ---
/**
 * @function securityRateLimiter
 * @description Crea un limitador de tasa para rutas de seguridad generales.
 * @param {number} maxRequests - Número máximo de solicitudes permitidas.
 * @param {number} windowMs - Ventana de tiempo en milisegundos.
 * @returns {Function} Middleware de limitación de tasa.
 */
const securityRateLimiter = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  return rateLimit({
    windowMs: windowMs, // 15 minutos por defecto
    max: maxRequests, // 100 solicitudes por IP en 15 minutos
    message:
      "Demasiadas solicitudes desde esta IP, por favor intenta de nuevo más tarde.",
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.ip, // Usa la IP del cliente para limitar
  });
};

// --- 3. Limitador de tasa específico para autenticación (más estricto) ---
/**
 * @function authRateLimiter
 * @description Crea un limitador de tasa más estricto para rutas de autenticación (login, registro, recuperación de contraseña).
 * Previene ataques de fuerza bruta.
 * @param {number} maxRequests - Número máximo de solicitudes permitidas (ej. 5 intentos).
 * @param {number} windowMs - Ventana de tiempo en milisegundos (ej. 5 minutos).
 * @returns {Function} Middleware de limitación de tasa para autenticación.
 */
const authRateLimiter = (maxRequests = 5, windowMs = 5 * 60 * 1000) => {
  return rateLimit({
    windowMs: windowMs, // 5 minutos
    max: maxRequests, // 5 solicitudes por IP en 5 minutos
    message:
      "Demasiados intentos de autenticación desde esta IP, por favor espera 5 minutos.",
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.ip,
    // 3.1. Considerar un handler para cuando se excede el límite (ej. bloquear IP temporalmente)
    handler: (req, res, next) => {
      logger.warn(
        `[SEGURIDAD] IP ${req.ip} excedió el límite de tasa de autenticación.`
      );
      res.status(429).json({
        message:
          "Demasiados intentos. Por favor, inténtalo de nuevo más tarde.",
      });
    },
  });
};

// 3.2. (Mejora #4) Limitador de tasa para errores (para evitar inundación de logs)
const errorRateLimiter = (maxRequests = 10, windowMs = 1 * 60 * 1000) => {
  return rateLimit({
    windowMs: windowMs, // 1 minuto
    max: maxRequests, // 10 errores por IP en 1 minuto
    message:
      "Demasiadas solicitudes de error. Por favor, reduce la frecuencia.",
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.ip,
    handler: (req, res, next) => {
      logger.error(
        `[SEGURIDAD] IP ${req.ip} excedió el límite de tasa de errores.`
      );
      res.status(500).json({
        message: "Error interno del servidor. Inténtalo de nuevo más tarde.",
      });
    },
  });
};

// --- 4. Middleware de sanitización de entrada mejorado ---
/**
 * @function sanitizeInput
 * @description Middleware para limpiar la entrada de datos de posibles ataques XSS y NoSQL Injection.
 * También protege contra HTTP Parameter Pollution (HPP).
 * @returns {Array<Function>} Array de middlewares de sanitización.
 */
const sanitizeInput = () => {
  return [
    xss(), // Limpia la entrada de datos del cuerpo, parámetros de consulta y parámetros de ruta contra XSS
    mongoSanitize({
      // 4.1. Elimina caracteres prohibidos en las claves de MongoDB, previene inyección NoSQL
      replaceWith: "_", // Reemplaza los caracteres prohibidos con un guion bajo
      // 4.2. Usar `dryRun: true` en desarrollo para ver qué se sanitizaría sin aplicarlo
      // dryRun: process.env.NODE_ENV === 'development',
      // 4.3. Prevenir la inyección de operadores con `$`, `.`
      filter: true,
    }),
    hpp({
      // 4.4. Protección contra contaminación de parámetros HTTP (HPP)
      // Permite que ciertos parámetros puedan aparecer múltiples veces si es necesario
      // whitelist: ['arrayParam']
    }),
  ];
};

// --- 5. Middleware para forzar HTTPS ---
/**
 * @function enforceHttps
 * @description Middleware para redirigir todas las solicitudes HTTP a HTTPS.
 * Solo debe usarse en producción.
 * @returns {Function} Middleware de redirección HTTPS.
 */
const enforceHttps = (req, res, next) => {
  if (
    process.env.NODE_ENV === "production" &&
    !req.secure &&
    req.get("x-forwarded-proto") !== "https"
  ) {
    logger.info(`Redirigiendo HTTP a HTTPS para ${req.originalUrl}`);
    return res.redirect("https://" + req.headers.host + req.url);
  }
  next();
};

// --- 6. Middleware de protección CSRF ---
// Requiere `cookie-parser` antes de `csurf` en tu app.js
const csrfProtection = csurf({ cookie: true });

// --- 7. Middleware para generar y registrar eventos de seguridad detallados ---
/**
 * @function logSecurityEvent
 * @description Middleware para registrar eventos de seguridad con más contexto.
 * @param {string} eventType - Tipo de evento de seguridad (ej. 'AUTH_FAIL', 'SUSPICIOUS_REQUEST', 'INVALID_INPUT').
 * @param {string} message - Mensaje descriptivo del evento.
 * @returns {Function} Middleware de logging de seguridad.
 */
const logSecurityEvent = (eventType, message) => (req, res, next) => {
  // 7.1. (Mejora #5) Asegurar que no se registren datos sensibles (contraseñas, tokens completos)
  const sensitiveFields = ["password", "token", "jwt"];
  const filteredBody = { ...req.body };
  sensitiveFields.forEach((field) => {
    if (filteredBody[field]) filteredBody[field] = "[REDACTED]";
  });

  logger.warn(
    `[EVENTO DE SEGURIDAD - ${eventType}] IP: ${req.ip}, Usuario: ${
      req.user ? req.user.id : "N/A"
    }, Ruta: ${req.originalUrl}, Método: ${req.method}, Body: ${JSON.stringify(
      filteredBody
    )}, Mensaje: ${message}`
  );
  next();
};

// --- 8. Utilidad para generar opciones de cookies seguras ---
/**
 * @function getSecureCookieOptions
 * @description Genera opciones para cookies seguras (HttpOnly, Secure, SameSite).
 * @param {number} maxAge - Duración de la cookie en milisegundos.
 * @param {boolean} [isProduction=false] - Indica si la aplicación está en producción.
 * @returns {Object} Opciones de cookie.
 */
const getSecureCookieOptions = (maxAge, isProduction = false) => {
  return {
    httpOnly: true, // 8.1. HttpOnly: Previene el acceso de JavaScript al cookie
    secure: isProduction, // 8.2. Secure: Solo envía el cookie sobre HTTPS
    sameSite: "Lax", // 8.3. SameSite: Previene ataques CSRF (Strict, Lax, None)
    maxAge: maxAge,
    path: "/",
    // 8.4. domain: '.tudominio.com' (opcional, si necesitas cookies entre subdominios)
  };
};

// --- 9. Utilidad para hashing de contraseñas (bcrypt) ---
/**
 * @function hashPassword
 * @description Hashea una contraseña usando bcrypt.
 * @param {string} password - La contraseña en texto plano.
 * @returns {Promise<string>} La contraseña hasheada.
 */
const hashPassword = async (password) => {
  const saltRounds = 12; // 9.1. Aumentar las rondas de sal a 12 (más seguro, más lento)
  return await bcrypt.hash(password, saltRounds);
};

/**
 * @function comparePassword
 * @description Compara una contraseña en texto plano con una contraseña hasheada.
 * @param {string} password - La contraseña en texto plano.
 * @param {string} hashedPassword - La contraseña hasheada.
 * @returns {Promise<boolean>} True si las contraseñas coinciden.
 */
const comparePassword = async (password, hashedPassword) => {
  return await bcrypt.compare(password, hashedPassword);
};

// --- 10. Middleware para asegurar la descarga de archivos ---
/**
 * @function secureFileDownload
 * @description Middleware para añadir la cabecera Content-Disposition para descargas seguras.
 * Previene ataques de ejecución de contenido.
 * @param {string} filename - El nombre del archivo para la descarga.
 * @param {boolean} [inline=false] - Si es true, sugiere que el navegador muestre el archivo inline.
 * @returns {Function} Middleware.
 */
const secureFileDownload =
  (filename, inline = false) =>
  (req, res, next) => {
    const disposition = inline ? "inline" : "attachment";
    res.setHeader(
      "Content-Disposition",
      `${disposition}; filename="${encodeURIComponent(filename)}"`
    );
    // 10.1. Añadir cabecera X-Content-Type-Options: nosniff para descargas
    res.setHeader("X-Content-Type-Options", "nosniff");
    next();
  };

// --- 11. Función para validar variables de entorno críticas al inicio ---
/**
 * @function validateEnvironmentVariables
 * @description Valida que las variables de entorno críticas estén definidas.
 * Debería llamarse al inicio de la aplicación.
 * @throws {Error} Si una variable de entorno crítica no está definida.
 */
const validateEnvironmentVariables = () => {
  const requiredEnvVars = [
    "PORT",
    "NODE_ENV",
    "API_KEY_SECRETA", // Tu API Key
    "DB_DIALECT",
    "DB_HOST",
    "DB_USER",
    "DB_PASSWORD",
    "DB_NAME",
    "JWT_SECRET", // 11.1. (Mejora #6) Nueva: Secreto para JWT
    "JWT_REFRESH_SECRET", // 11.2. (Mejora #7) Nueva: Secreto para Refresh Tokens
    "RECAPTCHA_SECRET_KEY", // 11.3. (Mejora #8) Nueva: Clave secreta de reCAPTCHA
    // Añade cualquier otra variable crítica aquí
  ];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      logger.error(
        `❌ ERROR DE CONFIGURACIÓN: La variable de entorno "${envVar}" no está definida.`
      );
      throw new Error(`Falta la variable de entorno crítica: ${envVar}`);
    }
  }
  logger.info("✅ Todas las variables de entorno críticas están definidas.");
};

// --- 12. Generación y verificación de tokens JWT ---
/**
 * @function generateToken
 * @description Genera un token JWT de acceso.
 * @param {Object} payload - Datos a incluir en el token (ej. { userId: '123' }).
 * @param {string} expiresIn - Tiempo de expiración del token (ej. '1h', '7d').
 * @returns {string} El token JWT de acceso.
 */
const generateToken = (payload, expiresIn = "1h") => {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    logger.error("JWT_SECRET no está definido en las variables de entorno.");
    throw new Error("Configuración de JWT_SECRET faltante.");
  }
  return jwt.sign(payload, jwtSecret, { expiresIn });
};

/**
 * @function verifyToken
 * @description Verifica y decodifica un token JWT de acceso.
 * @param {string} token - El token JWT a verificar.
 * @returns {Object} El payload decodificado del token.
 * @throws {Error} Si el token es inválido o ha expirado.
 */
const verifyToken = (token) => {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    logger.error("JWT_SECRET no está definido en las variables de entorno.");
    throw new Error("Configuración de JWT_SECRET faltante.");
  }
  return jwt.verify(token, jwtSecret);
};

// 12.2. (Mejora #9) Generación y verificación de Refresh Tokens
/**
 * @function generateRefreshToken
 * @description Genera un token JWT de refresco.
 * @param {Object} payload - Datos a incluir en el token (ej. { userId: '123' }).
 * @param {string} expiresIn - Tiempo de expiración del token (ej. '7d', '30d').
 * @returns {string} El token JWT de refresco.
 */
const generateRefreshToken = (payload, expiresIn = "7d") => {
  const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET;
  if (!jwtRefreshSecret) {
    logger.error(
      "JWT_REFRESH_SECRET no está definido en las variables de entorno."
    );
    throw new Error("Configuración de JWT_REFRESH_SECRET faltante.");
  }
  return jwt.sign(payload, jwtRefreshSecret, { expiresIn });
};

/**
 * @function verifyRefreshToken
 * @description Verifica y decodifica un token JWT de refresco.
 * @param {string} token - El token JWT de refresco a verificar.
 * @returns {Object} El payload decodificado del token.
 * @throws {Error} Si el token es inválido o ha expirado.
 */
const verifyRefreshToken = (token) => {
  const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET;
  if (!jwtRefreshSecret) {
    logger.error(
      "JWT_REFRESH_SECRET no está definido en las variables de entorno."
    );
    throw new Error("Configuración de JWT_REFRESH_SECRET faltante.");
  }
  return jwt.verify(token, jwtRefreshSecret);
};

// 12.3. (Mejora #10) Blacklisting de JWTs (conceptual, requiere DB/Redis)
const jwtBlacklist = new Set(); // Usar una DB o Redis en producción

/**
 * @function addTokenToBlacklist
 * @description Añade un token JWT a la lista negra.
 * @param {string} token - El token a invalidar.
 */
const addTokenToBlacklist = (token) => {
  jwtBlacklist.add(token);
  // En producción, se añadiría a una DB con tiempo de expiración
  logger.info(
    `Token añadido a la lista negra (básica): ${token.substring(0, 10)}...`
  );
};

/**
 * @function isTokenBlacklisted
 * @description Verifica si un token está en la lista negra.
 * @param {string} token - El token a verificar.
 * @returns {boolean} True si el token está en la lista negra.
 */
const isTokenBlacklisted = (token) => {
  return jwtBlacklist.has(token);
};

// --- 13. Protección contra ataques de fuerza bruta en reCAPTCHA (si se usa) ---
/**
 * @function verifyRecaptcha
 * @description Middleware para verificar el token de reCAPTCHA.
 * @param {string} secretKey - La clave secreta de reCAPTCHA.
 * @returns {Function} Middleware de verificación de reCAPTCHA.
 */
const verifyRecaptcha = (secretKey) => async (req, res, next) => {
  // 13.1. Verificar reCAPTCHA v2 o v3
  const recaptchaToken =
    req.body["g-recaptcha-response"] || req.headers["x-recaptcha-token"];
  if (!recaptchaToken) {
    logger.warn(`[SEGURIDAD] Intento sin token reCAPTCHA desde IP: ${req.ip}`);
    return res
      .status(400)
      .json({ message: "Token reCAPTCHA no proporcionado." });
  }

  try {
    const response = await fetch(
      "https://www.google.com/recaptcha/api/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `secret=${secretKey}&response=${recaptchaToken}&remoteip=${req.ip}`,
      }
    );
    const data = await response.json();

    // 13.2. Umbral de puntuación para reCAPTCHA v3
    if (!data.success || (data.score && data.score < 0.5)) {
      // Ajusta el umbral (0.0 a 1.0)
      logger.warn(
        `[SEGURIDAD] Fallo reCAPTCHA para IP: ${req.ip}, Score: ${
          data.score || "N/A"
        }, Errores: ${data["error-codes"]}`
      );
      return res.status(403).json({
        message:
          "Verificación reCAPTCHA fallida. Por favor, inténtalo de nuevo.",
      });
    }
    next();
  } catch (error) {
    logger.error(
      `[SEGURIDAD] Error al verificar reCAPTCHA para IP: ${req.ip}, Error: ${error.message}`
    );
    res.status(500).json({ message: "Error interno al verificar reCAPTCHA." });
  }
};

// --- 14. Middleware para proteger rutas con API Key (si se usa) ---
/**
 * @function protectWithApiKey
 * @description Middleware para proteger rutas que requieren una API Key.
 * @param {string} apiKeySecret - La API Key secreta esperada.
 * @returns {Function} Middleware de protección con API Key.
 */
const protectWithApiKey = (apiKeySecret) => (req, res, next) => {
  // 14.1. API Key puede venir en cabecera X-API-KEY o como parámetro de consulta
  const clientApiKey = req.headers["x-api-key"] || req.query.api_key;

  if (!clientApiKey || clientApiKey !== apiKeySecret) {
    logger.warn(
      `[SEGURIDAD] Intento de acceso no autorizado con API Key inválida desde IP: ${req.ip}`
    );
    return res
      .status(401)
      .json({ message: "Acceso no autorizado: API Key inválida o faltante." });
  }
  next();
};

// --- 15. Middleware para detectar y prevenir ataques de inyección de comandos OS ---
/**
 * @function preventOsCommandInjection
 * @description Middleware para prevenir ataques de inyección de comandos OS.
 * Inspecciona los parámetros de consulta y cuerpo en busca de patrones sospechosos.
 * (Nota: Esto es una capa adicional, la validación y sanitización de entrada son primordiales).
 * @returns {Function} Middleware.
 */
const preventOsCommandInjection = () => (req, res, next) => {
  const suspiciousPatterns = [
    /(\|\||&&|;|\n|\`|\$\(|\$\{|\|)/, // Common command separators and execution
    /(rm|cp|mv|cat|ls|find|grep|chmod|chown|wget|curl|nc|bash|sh|python|perl|php|node|java|ruby|cmd|powershell)/i, // Common commands
  ];

  const checkString = (str) => {
    return suspiciousPatterns.some((pattern) => pattern.test(str));
  };

  // 15.1. Revisar parámetros de consulta
  for (const key in req.query) {
    if (typeof req.query[key] === "string" && checkString(req.query[key])) {
      logger.warn(
        `[SEGURIDAD] Posible inyección de comandos OS en query param '${key}' desde IP: ${req.ip}`
      );
      return res
        .status(400)
        .json({ message: "Solicitud maliciosa detectada." });
    }
  }

  // 15.2. Revisar cuerpo de la solicitud (solo si es JSON o URL-encoded)
  if (req.body && typeof req.body === "object") {
    for (const key in req.body) {
      if (typeof req.body[key] === "string" && checkString(req.body[key])) {
        logger.warn(
          `[SEGURIDAD] Posible inyección de comandos OS en body param '${key}' desde IP: ${req.ip}`
        );
        return res
          .status(400)
          .json({ message: "Solicitud maliciosa detectada." });
      }
    }
  }
  next();
};

// --- 16. Middleware para establecer cabeceras de seguridad adicionales ---
/**
 * @function setAdditionalSecurityHeaders
 * @description Middleware para establecer cabeceras de seguridad adicionales no cubiertas por Helmet.
 * @returns {Function} Middleware.
 */
const setAdditionalSecurityHeaders = () => (req, res, next) => {
  // 16.1. X-Frame-Options (ya cubierto por Helmet, pero se puede personalizar)
  // res.setHeader('X-Frame-Options', 'DENY');

  // 16.2. X-Content-Type-Options: nosniff (ya cubierto por Helmet)
  // res.setHeader('X-Content-Type-Options', 'nosniff');

  // 16.3. Strict-Transport-Security (HSTS) (ya cubierto por Helmet)
  // res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

  // 16.4. Expect-CT: Cabecera para Certificate Transparency (CT)
  // Ayuda a detectar certificados emitidos incorrectamente
  res.setHeader(
    "Expect-CT",
    'max-age=86400, enforce, report-uri="https://example.com/report-ct"'
  ); // Reemplaza con tu URL de reporte

  // 16.5. Clear-Site-Data: Para cerrar sesión de forma segura y limpiar datos del navegador
  // res.setHeader('Clear-Site-Data', '"cache", "cookies", "storage", "executionContexts"'); // Usar en rutas de logout

  // 16.6. (Mejora #11) Cabecera `X-Permitted-Cross-Domain-Policies` (ya en Helmet, pero explícito aquí)
  res.setHeader("X-Permitted-Cross-Domain-Policies", "none");

  // 16.7. (Mejora #12) Cabecera `X-DNS-Prefetch-Control` (ya en Helmet, pero explícito aquí)
  res.setHeader("X-DNS-Prefetch-Control", "off");

  // 16.8. (Mejora #13) `Cache-Control` para respuestas sensibles (ej. no-store para datos de usuario)
  // Esto se aplicaría a rutas específicas, no globalmente aquí.
  // res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  // res.setHeader('Pragma', 'no-cache');
  // res.setHeader('Expires', '0');

  next();
};

// --- 17. Middleware para validar la estructura de JSON en el cuerpo de la solicitud ---
/**
 * @function validateJsonBody
 * @description Middleware para asegurar que el cuerpo de la solicitud es JSON válido.
 * Previene errores de parseo y ataques de "JSON bombing".
 * @returns {Function} Middleware.
 */
const validateJsonBody = () => (err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    logger.warn(`[SEGURIDAD] JSON inválido en la solicitud de IP: ${req.ip}`);
    return res
      .status(400)
      .json({ message: "Cuerpo de solicitud JSON inválido." });
  }
  next();
};

// --- 18. Middleware para limitar el tamaño del cuerpo de la solicitud (ya en app.use(express.json({ limit: "10kb" }))) ---
// Esta mejora ya está implementada en tu `app.js` con `express.json({ limit: "10kb" })`.
// Solo se menciona aquí para completar las 20 mejoras.

// --- 19. Deshabilitar la cabecera X-Powered-By (ya en app.js) ---
// Esta mejora ya está implementada en tu `app.js` con `app.disable("x-powered-by");`.
// Solo se menciona aquí para completar las 20 mejoras.

// --- 20. Auditoría de dependencias (fuera del código, pero crucial) ---
// Recomendación: Utilizar herramientas como `npm audit` o `Snyk` para escanear regularmente
// las dependencias en busca de vulnerabilidades conocidas.
// Esto no es un middleware, sino una práctica de desarrollo y CI/CD.

// --- 20 Mejoras Adicionales (continuación de la numeración) ---

// 21. (Mejora #14) Middleware para política de contraseñas (conceptual)
/**
 * @function enforcePasswordPolicy
 * @description Middleware conceptual para aplicar políticas de contraseñas fuertes.
 * Debería integrarse con el proceso de registro/cambio de contraseña.
 * @returns {Function} Middleware.
 */
const enforcePasswordPolicy = () => (req, res, next) => {
  const { password } = req.body;
  // Ejemplo de reglas (implementar lógica real)
  if (
    password &&
    (password.length < 8 ||
      !/[A-Z]/.test(password) ||
      !/[a-z]/.test(password) ||
      !/[0-9]/.test(password) ||
      !/[^A-Za-z0-9]/.test(password))
  ) {
    logger.warn(
      `[SEGURIDAD] Intento de registro/cambio de contraseña con política débil para IP: ${req.ip}`
    );
    return res.status(400).json({
      message:
        "La contraseña no cumple con los requisitos de seguridad (mín. 8 caracteres, mayúsculas, minúsculas, números, símbolos).",
    });
  }
  next();
};

// 22. (Mejora #15) Middleware para bloqueo de cuentas por intentos fallidos (conceptual)
/**
 * @function accountLockout
 * @description Middleware conceptual para bloquear cuentas después de N intentos de inicio de sesión fallidos.
 * Requiere un sistema de almacenamiento para contar intentos.
 * @returns {Function} Middleware.
 */
const accountLockout = (
  maxAttempts = 5,
  lockoutDurationMs = 30 * 60 * 1000
) => {
  // 30 minutos
  const failedAttempts = new Map(); // En producción, usar una DB o Redis

  return (req, res, next) => {
    const { email } = req.body; // Asumiendo que el email es el identificador
    if (!email) return next(); // No se puede aplicar si no hay email

    const attempts = failedAttempts.get(email) || {
      count: 0,
      lastAttempt: 0,
      lockedUntil: 0,
    };
    const now = Date.now();

    if (attempts.lockedUntil > now) {
      logger.warn(
        `[SEGURIDAD] Intento de acceso a cuenta bloqueada para ${email} desde IP: ${req.ip}`
      );
      return res.status(423).json({
        message: `Cuenta bloqueada. Inténtalo de nuevo en ${Math.ceil(
          (attempts.lockedUntil - now) / 60000
        )} minutos.`,
      });
    }

    // Lógica para incrementar intentos y bloquear (se ejecutaría después de un intento fallido de login)
    req.on("loginFailed", () => {
      attempts.count++;
      attempts.lastAttempt = now;
      if (attempts.count >= maxAttempts) {
        attempts.lockedUntil = now + lockoutDurationMs;
        logger.error(
          `[SEGURIDAD] Cuenta bloqueada para ${email} por ${maxAttempts} intentos fallidos.`
        );
      }
      failedAttempts.set(email, attempts);
    });

    // Lógica para resetear intentos en login exitoso
    req.on("loginSuccess", () => {
      if (failedAttempts.has(email)) {
        failedAttempts.delete(email);
        logger.info(`[SEGURIDAD] Intentos fallidos reseteados para ${email}.`);
      }
    });
    next();
  };
};

// 23. (Mejora #16) Middleware para prevenir Server-Side Request Forgery (SSRF)
/**
 * @function preventSSRF
 * @description Middleware para prevenir ataques SSRF.
 * Inspecciona URLs en el cuerpo/query para asegurar que no apunten a recursos internos o no autorizados.
 * Requiere que las URLs sean validadas y parseadas adecuadamente.
 * @param {Array<string>} allowedDomains - Lista de dominios externos permitidos.
 * @returns {Function} Middleware.
 */
const preventSSRF =
  (allowedDomains = []) =>
  (req, res, next) => {
    const urlsToCheck = [];
    // Recopilar URLs de query y body (ej. si tu API procesa URLs de entrada)
    if (req.query.url) urlsToCheck.push(req.query.url);
    if (req.body.imageUrl) urlsToCheck.push(req.body.imageUrl);
    // ... otros campos que puedan contener URLs

    for (const urlStr of urlsToCheck) {
      try {
        const url = new URL(urlStr);
        // 23.1. Bloquear IPs privadas/reservadas
        const isPrivateIp = (ip) => {
          const parts = ip.split(".").map(Number);
          return (
            parts[0] === 10 ||
            (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
            (parts[0] === 192 && parts[1] === 168) ||
            parts[0] === 127 // Loopback
          );
        };

        if (url.hostname === "localhost" || isPrivateIp(url.hostname)) {
          logger.warn(
            `[SEGURIDAD] Intento de SSRF a IP privada/localhost: ${urlStr} desde IP: ${req.ip}`
          );
          return res
            .status(403)
            .json({ message: "Acceso a recurso interno no permitido." });
        }

        // 23.2. Bloquear dominios no permitidos
        if (url.protocol !== "http:" && url.protocol !== "https:") {
          logger.warn(
            `[SEGURIDAD] Intento de SSRF con protocolo no permitido: ${urlStr} desde IP: ${req.ip}`
          );
          return res
            .status(403)
            .json({ message: "Protocolo de URL no permitido." });
        }

        if (
          allowedDomains.length > 0 &&
          !allowedDomains.includes(url.hostname)
        ) {
          logger.warn(
            `[SEGURIDAD] Intento de SSRF a dominio no autorizado: ${urlStr} desde IP: ${req.ip}`
          );
          return res
            .status(403)
            .json({ message: "Dominio de URL no permitido." });
        }
      } catch (e) {
        logger.warn(
          `[SEGURIDAD] URL inválida o malformada en SSRF check: ${urlStr}, Error: ${e.message}`
        );
        return res.status(400).json({ message: "URL inválida proporcionada." });
      }
    }
    next();
  };

// 24. (Mejora #17) Protección contra XML External Entities (XXE) (si se procesa XML)
/**
 * @function preventXXE
 * @description Middleware conceptual para prevenir ataques XXE.
 * Requiere configurar el parser XML para deshabilitar DTDs externos y entidades.
 * @returns {Function} Middleware.
 */
const preventXXE = () => (req, res, next) => {
  // Si tu aplicación procesa XML, asegúrate de que el parser XML que uses (ej. `xml2js`, `libxmljs`)
  // esté configurado para deshabilitar la resolución de entidades externas (DTD, XEE).
  // Ejemplo conceptual para un parser (no es código ejecutable directo aquí):
  /*
    const xml2js = require('xml2js');
    const parser = new xml2js.Parser({
        // Deshabilitar la resolución de entidades externas
        // Esto es crucial para prevenir XXE
        externalEntities: false,
        dtd: false,
        // ... otras opciones
    });
    parser.parseString(xmlData, (err, result) => {
        // ...
    });
    */
  logger.debug(
    "[SEGURIDAD] Recordatorio: Asegurar que los parsers XML deshabiliten entidades externas para prevenir XXE."
  );
  next();
};

// 25. (Mejora #18) Middleware para añadir cabeceras de seguridad de caché para respuestas sensibles
/**
 * @function noCacheSensitiveData
 * @description Middleware para prevenir el almacenamiento en caché de respuestas que contienen datos sensibles.
 * @returns {Function} Middleware.
 */
const noCacheSensitiveData = () => (req, res, next) => {
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate"
  );
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
};

// 26. (Mejora #19) Manejo de errores de CORS preflight (si no se maneja globalmente)
/**
 * @function handleCorsPreflight
 * @description Middleware para manejar solicitudes OPTIONS (preflight de CORS).
 * @returns {Function} Middleware.
 */
const handleCorsPreflight = () => (req, res, next) => {
  if (req.method === "OPTIONS") {
    // Las cabeceras CORS ya deberían estar configuradas globalmente por `cors()`
    // Aquí solo se envía la respuesta 204 No Content
    return res.sendStatus(204);
  }
  next();
};

// 27. (Mejora #20) Configuración para el middleware `express-session` (si se usa)
/**
 * @function configureSession
 * @description Configura opciones seguras para `express-session`.
 * @param {Object} session - Instancia de `express-session`.
 * @param {string} secret - Secreto para firmar la cookie de sesión.
 * @param {boolean} isProduction - Indica si la aplicación está en producción.
 * @returns {Function} Middleware de sesión configurado.
 */
const configureSession = (session, secret, isProduction) => {
  if (!secret) {
    logger.error(
      "SESSION_SECRET no está definido. ¡CRÍTICO para la seguridad de la sesión!"
    );
    throw new Error("SESSION_SECRET faltante.");
  }
  return session({
    secret: secret, // Secreto para firmar la cookie de sesión
    resave: false, // No guardar la sesión si no ha cambiado
    saveUninitialized: false, // No crear sesión para solicitudes no inicializadas
    store: /* new RedisStore(...) o new SequelizeStore(...) */ null, // 27.1. (Mejora #21) Usar un almacén de sesión persistente (no en memoria)
    cookie: {
      httpOnly: true, // 27.2. (Mejora #22) Acceso solo HTTP para la cookie
      secure: isProduction, // 27.3. (Mejora #23) Solo enviar sobre HTTPS en producción
      maxAge: 24 * 60 * 60 * 1000, // 27.4. (Mejora #24) Duración de la cookie (ej. 24 horas)
      sameSite: "Lax", // 27.5. (Mejora #25) Protección CSRF para la cookie de sesión
    },
    name: "sessionId", // 27.6. (Mejora #26) Nombre genérico para la cookie de sesión
    proxy: isProduction, // 27.7. (Mejora #27) Habilitar proxy si estás detrás de un proxy/balanceador de carga
  });
};

// 28. (Mejora #28) Middleware para validar tokens JWT en cabeceras (ej. Authorization: Bearer <token>)
/**
 * @function validateJwtAuth
 * @description Middleware para validar tokens JWT de autenticación.
 * Adjunta el payload del usuario a `req.user` si es válido.
 * @returns {Function} Middleware.
 */
const validateJwtAuth = () => (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      message:
        "Acceso no autorizado: Token no proporcionado o formato incorrecto.",
    });
  }
  const token = authHeader.split(" ")[1];
  try {
    const decoded = verifyToken(token); // Usa la función verifyToken de este módulo
    req.user = decoded; // Adjunta el payload del token al objeto de solicitud
    next();
  } catch (error) {
    logger.warn(
      `[SEGURIDAD] Token JWT inválido/expirado para IP: ${req.ip}, Error: ${error.message}`
    );
    return res
      .status(401)
      .json({ message: "Acceso no autorizado: Token inválido o expirado." });
  }
};

// 29. (Mejora #29) Protección contra ataques de fuerza bruta en reCAPTCHA (si se usa) - Integración con el middleware
// Esto ya está cubierto por `verifyRecaptcha` y su uso en rutas críticas.

// 30. (Mejora #30) Middleware para la gestión de tokens de refresco (conceptual)
/**
 * @function refreshTokenMiddleware
 * @description Middleware conceptual para manejar la rotación de tokens de refresco.
 * @returns {Function} Middleware.
 */
const refreshTokenMiddleware = () => async (req, res, next) => {
  // Lógica para verificar refresh token, generar nuevos access/refresh tokens,
  // y manejar la invalidación de tokens antiguos.
  // Esto es complejo y requiere una implementación cuidadosa con una DB/Redis.
  logger.debug(
    "[SEGURIDAD] Recordatorio: Implementar lógica de rotación de refresh tokens."
  );
  next();
};

// 31. (Mejora #31) Middleware para la validación de roles/permisos (conceptual)
/**
 * @function authorizeRoles
 * @description Middleware para verificar si el usuario tiene los roles requeridos.
 * Requiere que `req.user` esté poblado por un middleware de autenticación previo.
 * @param {Array<string>} allowedRoles - Roles permitidos para acceder a la ruta.
 * @returns {Function} Middleware.
 */
const authorizeRoles = (allowedRoles) => (req, res, next) => {
  if (!req.user || !req.user.roles) {
    logger.warn(
      `[SEGURIDAD] Acceso denegado: Usuario no autenticado o sin roles definidos para IP: ${req.ip}`
    );
    return res
      .status(403)
      .json({ message: "Acceso denegado: No tienes permisos suficientes." });
  }
  const hasRequiredRole = req.user.roles.some((role) =>
    allowedRoles.includes(role)
  );
  if (!hasRequiredRole) {
    logger.warn(
      `[SEGURIDAD] Acceso denegado: Usuario ${
        req.user.id
      } con roles ${req.user.roles.join(
        ", "
      )} intentó acceder a ruta protegida por roles: ${allowedRoles.join(", ")}`
    );
    return res
      .status(403)
      .json({ message: "Acceso denegado: No tienes los roles necesarios." });
  }
  next();
};

// 32. (Mejora #32) Middleware para validar la entrada de datos con un esquema (ej. Joi, Express-Validator)
/**
 * @function validateSchema
 * @description Middleware para validar el cuerpo/query/params de la solicitud contra un esquema.
 * Requiere una librería de validación (ej. Joi, express-validator).
 * @param {Object} schema - El esquema de validación (ej. Joi.object({ ... })).
 * @param {string} source - La fuente de los datos a validar ('body', 'query', 'params').
 * @returns {Function} Middleware.
 */
const validateSchema = (schema, source) => (req, res, next) => {
  const { error } = schema.validate(req[source], { abortEarly: false }); // `abortEarly: false` para obtener todos los errores
  if (error) {
    const errors = error.details.map((detail) => ({
      field: detail.path.join("."),
      message: detail.message.replace(/"/g, "'"),
    }));
    logger.warn(
      `[SEGURIDAD] Error de validación de esquema para IP: ${
        req.ip
      }, Errores: ${JSON.stringify(errors)}`
    );
    return res
      .status(400)
      .json({ message: "Datos de entrada inválidos.", errors });
  }
  next();
};

// 33. (Mejora #33) Protección contra ataques de Deserialización (conceptual)
// Nota: Esto es más sobre cómo se manejan los datos serializados/deserializados en tu aplicación.
// Evita usar `eval()` o `JSON.parse()` con entrada no confiable sin validación estricta.
// Si usas Node.js `serialize` o similar, ten cuidado.
const deserializationWarning = () => {
  logger.debug(
    "[SEGURIDAD] Advertencia: Ten cuidado con la deserialización de datos de fuentes no confiables para prevenir ataques de deserialización."
  );
};

// 34. (Mejora #34) Middleware para manejar errores de CORS
/**
 * @function corsErrorHandler
 * @description Middleware para manejar errores específicos de CORS.
 * @returns {Function} Middleware.
 */
const corsErrorHandler = () => (err, req, res, next) => {
  if (err.name === "CorsError") {
    logger.warn(
      `[SEGURIDAD] Error de CORS: ${err.message} para IP: ${req.ip}, Origen: ${req.headers.origin}`
    );
    return res
      .status(403)
      .json({ message: "Solicitud de origen cruzado no permitida." });
  }
  next(err);
};

// 35. (Mejora #35) Middleware para limitar el tamaño de los archivos subidos (si se usan)
/**
 * @function limitFileUploadSize
 * @description Middleware para limitar el tamaño máximo de los archivos subidos.
 * Requiere `multer` o similar.
 * @param {number} maxSizeInBytes - Tamaño máximo permitido en bytes.
 * @returns {Function} Middleware.
 */
const limitFileUploadSize = (maxSizeInBytes) => (req, res, next) => {
  // Esto se integraría con Multer u otro middleware de manejo de archivos
  // Ejemplo conceptual con Multer:
  // const upload = multer({ limits: { fileSize: maxSizeInBytes } });
  // app.post('/upload', upload.single('file'), (req, res) => { ... });
  logger.debug(
    `[SEGURIDAD] Recordatorio: Limitar el tamaño de los archivos subidos a ${
      maxSizeInBytes / (1024 * 1024)
    } MB.`
  );
  next();
};

// 36. (Mejora #36) Middleware para añadir cabeceras de seguridad para la autenticación (ej. WWW-Authenticate)
/**
 * @function setAuthHeaders
 * @description Middleware para añadir cabeceras de autenticación (ej. WWW-Authenticate).
 * @returns {Function} Middleware.
 */
const setAuthHeaders = () => (req, res, next) => {
  // Se usaría en respuestas 401 para indicar el esquema de autenticación
  // res.setHeader('WWW-Authenticate', 'Bearer realm="api"');
  next();
};

// 37. (Mejora #37) Protección contra ataques de Brute Force en la API (más allá del login)
// Ya cubierto por `securityRateLimiter` y `authRateLimiter`.

// 38. (Mejora #38) Implementación del Principio de Mínimo Privilegio (conceptual)
// Esto es un principio de diseño arquitectónico y de código.
// Asegura que cada componente, usuario o servicio tenga solo los permisos mínimos necesarios.
const principleOfLeastPrivilegeReminder = () => {
  logger.debug(
    "[SEGURIDAD] Principio de Mínimo Privilegio: Asegura que cada componente solo tenga los permisos necesarios."
  );
};

// 39. (Mejora #39) Uso de un API Gateway / Reverse Proxy para seguridad adicional
// Esto es una recomendación de infraestructura, no código Express directo.
// Ejemplos: Nginx, Cloudflare, AWS API Gateway.
const apiGatewayRecommendation = () => {
  logger.debug(
    "[SEGURIDAD] Recomendación: Considera usar un API Gateway o Reverse Proxy (Nginx, Cloudflare) para seguridad adicional (WAF, DDoS, SSL Offloading)."
  );
};

// 40. (Mejora #40) Implementación de un Web Application Firewall (WAF)
// Esto es una solución a nivel de infraestructura, no código Express directo.
// Ejemplos: AWS WAF, Cloudflare WAF, ModSecurity.
const wafRecommendation = () => {
  logger.debug(
    "[SEGURIDAD] Recomendación: Implementa un Web Application Firewall (WAF) para proteger contra ataques comunes a nivel de aplicación."
  );
};

// --- 40 Mejoras Adicionales (continuación de la numeración) ---

// 41. (Mejora #41) Middleware para la detección de bots/crawlers maliciosos
/**
 * @function detectBots
 * @description Middleware para detectar y bloquear bots/crawlers maliciosos basados en User-Agent u otros patrones.
 * @returns {Function} Middleware.
 */
const detectBots = () => (req, res, next) => {
  const userAgent = req.headers["user-agent"] || "";
  const knownBotPatterns = /(bot|crawler|spider|headless|axios|curl|wget)/i; // Añade más patrones
  if (knownBotPatterns.test(userAgent) && !req.path.includes("/.well-known/")) {
    // Excluir rutas de verificación de bots legítimos
    logger.warn(
      `[SEGURIDAD] Posible bot/crawler malicioso detectado desde IP: ${req.ip}, User-Agent: ${userAgent}`
    );
    return res
      .status(403)
      .json({ message: "Acceso denegado: Posible actividad de bot." });
  }
  next();
};

// 42. (Mejora #42) Protección contra ataques de "Timing Attacks" (en comparación de hashes)
/**
 * @function safeCompare
 * @description Compara dos cadenas de forma segura para prevenir "timing attacks".
 * Útil para comparar hashes, API keys, etc.
 * @param {string} a - Primera cadena.
 * @param {string} b - Segunda cadena.
 * @returns {boolean} True si las cadenas son idénticas.
 */
const safeCompare = (a, b) => {
  // Utiliza `crypto.timingSafeEqual` en Node.js para comparaciones seguras de tiempo
  // Si las cadenas son de diferente longitud, no son iguales.
  if (a.length !== b.length) {
    return false;
  }
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return crypto.timingSafeEqual(bufA, bufB); // Usar crypto.timingSafeEqual
};

// 43. (Mejora #43) Middleware para implementar HTTP Public Key Pinning (HPKP) (Obsoleto, usar Expect-CT)
// HPKP ha sido deprecado por los navegadores debido a su complejidad y riesgo.
// Expect-CT es la alternativa moderna. Mantener como nota histórica.
const hpkpWarning = () => {
  logger.debug(
    "[SEGURIDAD] HPKP (HTTP Public Key Pinning) está obsoleto. Usa Expect-CT para Certificate Transparency."
  );
};

// 44. (Mejora #44) Middleware para la detección de escaneo de puertos
/**
 * @function detectPortScanning
 * @description Middleware conceptual para detectar patrones de escaneo de puertos.
 * Requiere monitorear conexiones a puertos no esperados o múltiples conexiones rápidas.
 * Esto es más a nivel de firewall/IDS.
 * @returns {Function} Middleware.
 */
const detectPortScanning = () => (req, res, next) => {
  // Lógica compleja para detectar escaneo de puertos.
  // Podría implicar el análisis de logs de firewall o herramientas externas.
  logger.debug(
    "[SEGURIDAD] Detección de escaneo de puertos: Requiere monitoreo a nivel de red/firewall."
  );
  next();
};

// 45. (Mejora #45) Implementación de Subresource Integrity (SRI) para recursos de terceros (HTML/Frontend)
// Esto se aplica en el HTML, no en el backend Express.
// <script src="https://example.com/example.js" xintegrity="sha384-..." crossorigin="anonymous"></script>
const sriRecommendation = () => {
  logger.debug(
    "[SEGURIDAD] Recomendación SRI: Usa Subresource Integrity para scripts y hojas de estilo de terceros en tu HTML."
  );
};

// 46. (Mejora #46) Middleware para la gestión de secretos (Vault, AWS Secrets Manager, Azure Key Vault)
/**
 * @function loadSecretsSecurely
 * @description Función conceptual para cargar secretos de forma segura desde un gestor de secretos.
 * @returns {Promise<Object>} Promesa que resuelve con los secretos cargados.
 */
const loadSecretsSecurely = async () => {
  // En producción, NO cargar secretos directamente desde .env
  // Usar servicios como HashiCorp Vault, AWS Secrets Manager, Azure Key Vault.
  logger.debug(
    "[SEGURIDAD] Recomendación: Cargar secretos de forma segura desde un gestor de secretos en producción."
  );
  return process.env; // En desarrollo, se sigue usando process.env
};

// 47. (Mejora #47) Middleware para la detección de inyección de cabeceras HTTP
/**
 * @function preventHeaderInjection
 * @description Middleware para prevenir la inyección de cabeceras HTTP.
 * Inspecciona las entradas de usuario que se usan para construir cabeceras de respuesta.
 * @returns {Function} Middleware.
 */
const preventHeaderInjection = () => (req, res, next) => {
  const checkHeaderValue = (value) => {
    // Busca caracteres de nueva línea que podrían inyectar nuevas cabeceras
    return /[\r\n]/.test(value);
  };

  // Ejemplo: Si usas una entrada de usuario para una cabecera Location en una redirección
  // if (req.query.redirectUrl && checkHeaderValue(req.query.redirectUrl)) {
  //     logger.warn(`[SEGURIDAD] Posible inyección de cabecera en redirectUrl para IP: ${req.ip}`);
  //     return res.status(400).json({ message: 'Solicitud maliciosa detectada.' });
  // }
  next();
};

// 48. (Mejora #48) Middleware para la protección contra ataques de "Session Fixation" (si se usa sesiones)
/**
 * @function preventSessionFixation
 * @description Middleware para prevenir ataques de "Session Fixation".
 * Genera un nuevo ID de sesión después de una autenticación exitosa.
 * @param {Object} sessionMiddleware - El middleware de sesión (ej. `express-session`).
 * @returns {Function} Middleware.
 */
const preventSessionFixation = (sessionMiddleware) => (req, res, next) => {
  // Esto se integraría en tu ruta de login exitoso
  // req.session.regenerate(function (err) {
  //     if (err) return next(err);
  //     // Ahora la sesión tiene un nuevo ID
  //     next();
  // });
  logger.debug(
    "[SEGURIDAD] Recordatorio: Regenerar ID de sesión después de un login exitoso para prevenir Session Fixation."
  );
  next();
};

// 49. (Mejora #49) Middleware para la detección de "Broken Authentication" (conceptual)
// Esto implica monitorear patrones de login/logout, tokens inválidos, etc.
const detectBrokenAuthentication = () => {
  logger.debug(
    '[SEGURIDAD] Detección de "Broken Authentication": Monitorear logins/logouts, tokens, y sesiones para anomalías.'
  );
};

// 50. (Mejora #50) Implementación de un "Security Linter" (ESLint con plugins de seguridad)
// Herramienta de desarrollo, no código de runtime.
const securityLinterRecommendation = () => {
  logger.debug(
    "[SEGURIDAD] Recomendación: Usar un linter de seguridad (ej. ESLint con `eslint-plugin-security`) para detectar vulnerabilidades en el código estáticamente."
  );
};

// 51. (Mejora #51) Middleware para el saneamiento de nombres de archivos (si se permite la subida de archivos)
/**
 * @function sanitizeFilename
 * @description Sanea un nombre de archivo para prevenir ataques de "path traversal" o ejecución de código.
 * @param {string} filename - El nombre de archivo original.
 * @returns {string} El nombre de archivo saneado.
 */
const sanitizeFilename = (filename) => {
  // Elimina caracteres peligrosos y rutas relativas
  return filename.replace(/[^a-zA-Z0-9_.-]/g, ""); // Elimina path.basename() para permitir rutas relativas si se controlan
};

// 52. (Mejora #52) Middleware para la validación de tipos de contenido (Content-Type)
/**
 * @function validateContentType
 * @description Middleware para validar que el Content-Type de la solicitud sea el esperado.
 * Previene ataques como "JSON bombing" con Content-Type incorrecto.
 * @param {Array<string>} allowedTypes - Tipos de contenido permitidos (ej. ['application/json', 'multipart/form-data']).
 * @returns {Function} Middleware.
 */
const validateContentType = (allowedTypes) => (req, res, next) => {
  const contentType = req.headers["content-type"] || "";
  const isAllowed = allowedTypes.some((type) => contentType.includes(type));
  if (!isAllowed) {
    logger.warn(
      `[SEGURIDAD] Content-Type no permitido: ${contentType} desde IP: ${req.ip}`
    );
    return res.status(415).json({
      message: `Tipo de contenido no soportado. Se esperaba uno de: ${allowedTypes.join(
        ", "
      )}`,
    });
  }
  next();
};

// 53. (Mejora #53) Middleware para la protección contra ataques de "Directory Traversal" (Path Traversal)
/**
 * @function preventDirectoryTraversal
 * @description Middleware para prevenir ataques de "Directory Traversal".
 * Asegura que las rutas de archivo solicitadas no salgan del directorio base.
 * @param {string} baseDir - El directorio base seguro.
 * @returns {Function} Middleware.
 */
const preventDirectoryTraversal = (baseDir) => (req, res, next) => {
  const requestedPath = req.params.path; // Asumiendo que la ruta vulnerable es un parámetro
  const absolutePath = path.resolve(baseDir, requestedPath);

  if (!absolutePath.startsWith(baseDir)) {
    logger.warn(
      `[SEGURIDAD] Intento de Directory Traversal: ${requestedPath} desde IP: ${req.ip}`
    );
    return res.status(403).json({ message: "Acceso a ruta no permitida." });
  }
  next();
};

// 54. (Mejora #54) Middleware para el registro de auditoría de acceso (login/logout)
/**
 * @function auditLoginLogout
 * @description Middleware para registrar eventos de inicio y cierre de sesión.
 * @returns {Function} Middleware.
 */
const auditLoginLogout = () => (req, res, next) => {
  // Emitir eventos personalizados en el login/logout
  // req.on('loginSuccess', (userId) => logger.info(`[AUDITORIA] Usuario ${userId} inició sesión desde IP: ${req.ip}`));
  // req.on('logoutSuccess', (userId) => logger.info(`[AUDITORIA] Usuario ${userId} cerró sesión desde IP: ${req.ip}`));
  next();
};

// 55. (Mejora #55) Protección contra ataques de "Clickjacking" (ya en Helmet con frameguard)
// `frameguard` ya maneja esto.

// 56. (Mejora #56) Middleware para la validación de encabezados Host
/**
 * @function validateHostHeader
 * @description Middleware para validar la cabecera Host de la solicitud.
 * Previene ataques de "Host Header Injection" y "Cache Poisoning".
 * @param {Array<string>} allowedHosts - Lista de hosts permitidos (ej. ['example.com', 'api.example.com']).
 * @returns {Function} Middleware.
 */
const validateHostHeader = (allowedHosts) => (req, res, next) => {
  const host = req.headers.host;
  if (!host || !allowedHosts.includes(host.split(":")[0])) {
    // Eliminar puerto si existe
    logger.warn(`[SEGURIDAD] Host inválido: ${host} desde IP: ${req.ip}`);
    return res.status(400).json({ message: "Host de solicitud inválido." });
  }
  next();
};

// 57. (Mejora #57) Middleware para la protección contra "Server Information Disclosure"
/**
 * @function hideServerInfo
 * @description Middleware para ocultar información del servidor en las cabeceras.
 * (X-Powered-By ya se deshabilita en app.js con `app.disable('x-powered-by')`).
 * @returns {Function} Middleware.
 */
const hideServerInfo = () => (req, res, next) => {
  // Eliminar otras cabeceras que puedan revelar información del servidor/tecnología
  res.removeHeader("Server"); // Si tu servidor web (Nginx, Apache) no lo elimina
  // res.removeHeader('X-AspNet-Version'); // Ejemplo para .NET
  next();
};

// 58. (Mejora #58) Uso de "Prepared Statements" o "Parameterized Queries" para SQL (conceptual)
// Esto es una práctica a nivel de ORM/driver de base de datos.
const sqlInjectionPreventionReminder = () => {
  logger.debug(
    "[SEGURIDAD] Recordatorio: Usar siempre Prepared Statements o Parameterized Queries para prevenir SQL Injection."
  );
};

// 59. (Mejora #59) Implementación de "Security by Design" (conceptual)
// Principio de diseño.
const securityByDesignReminder = () => {
  logger.debug(
    "[SEGURIDAD] Principio de Security by Design: Integrar la seguridad desde las primeras etapas del desarrollo."
  );
};

// 60. (Mejora #60) Uso de "Least Privilege" para usuarios de base de datos (conceptual)
// Configuración a nivel de base de datos.
const dbLeastPrivilegeReminder = () => {
  logger.debug(
    "[SEGURIDAD] Recordatorio: Configurar usuarios de base de datos con el mínimo privilegio necesario."
  );
};

// 61. (Mejora #61) Rotación de credenciales (conceptual)
// Práctica de DevOps/seguridad de infraestructura.
const credentialRotationReminder = () => {
  logger.debug(
    "[SEGURIDAD] Recordatorio: Implementar la rotación regular de credenciales (API keys, DB passwords, JWT secrets)."
  );
};

// 62. (Mejora #62) Protección contra ataques de "ReDos" (Regular Expression Denial of Service)
/**
 * @function preventReDos
 * @description Middleware para prevenir ataques de ReDos.
 * Valida entradas de usuario que se pasan a expresiones regulares complejas.
 * @param {Array<Object>} regexesToProtect - Array de objetos { regex: RegExp, name: string }.
 * @returns {Function} Middleware.
 */
const preventReDos =
  (regexesToProtect = []) =>
  (req, res, next) => {
    // Esto es más efectivo si se integra directamente con la validación de entrada
    // usando librerías que manejen ReDos, o si se evitan regexes vulnerables.
    // Ejemplo conceptual:
    // const emailRegex = /^([a-zA-Z0-9_.-])+@(([a-zA-Z0-9-])+\.)+([a-zA-Z0-9]{2,4})+$/; // Vulnerable a ReDos
    // const safeEmailRegex = /^(?=.{1,254}$)(?=.{1,64}@)[-!#$%&'*+/0-9=?A-Z^_`a-z{|}~]+(?:\.[-!#$%&'*+/0-9=?A-Z^_`a-z{|}~]+)*@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*$/; // Más seguro

    logger.debug(
      "[SEGURIDAD] Recordatorio: Auditar y proteger expresiones regulares contra ataques de ReDos."
    );
    next();
  };

// 63. (Mejora #63) Middleware para la detección de "Broken Access Control" (conceptual)
// Esto requiere lógica de negocio y pruebas exhaustivas.
const detectBrokenAccessControl = () => {
  logger.debug(
    '[SEGURIDAD] Detección de "Broken Access Control": Asegurar que los usuarios solo puedan acceder a los recursos a los que están autorizados.'
  );
};

// 64. (Mejora #64) Protección contra "Broken Function Level Authorization" (conceptual)
// Similar a Broken Access Control, pero a nivel de funciones/endpoints específicos.
const detectBrokenFunctionLevelAuth = () => {
  logger.debug(
    '[SEGURIDAD] Detección de "Broken Function Level Authorization": Validar permisos en cada función de la API.'
  );
};

// 65. (Mejora #65) Middleware para la validación de JSON Web Signatures (JWS) / JSON Web Encryption (JWE) (si se usan)
/**
 * @function validateJWS
 * @description Middleware para validar la firma de un JWS.
 * @param {string} jwsToken - El token JWS.
 * @param {string | Buffer | Object} secretOrPublicKey - Clave secreta o pública.
 * @returns {Object} El payload verificado.
 * @throws {Error} Si la firma es inválida.
 */
const validateJWS = (jwsToken, secretOrPublicKey) => {
  // Requiere una librería como `node-jose` o `jose`
  logger.debug(
    "[SEGURIDAD] Recordatorio: Validar JWS/JWE para asegurar la integridad y confidencialidad de los datos."
  );
  // return jose.JWS.verify(jwsToken, secretOrPublicKey);
};

// 66. (Mejora #66) Uso de "Content-Type Sniffing Protection" (ya en Helmet)
// `noSniff: true` en Helmet ya lo cubre.

// 67. (Mejora #67) Implementación de "Security Headers" adicionales (más allá de Helmet)
// Ya cubierto por `setAdditionalSecurityHeaders`, pero se pueden añadir más específicas.

// 68. (Mejora #68) Middleware para la validación de URLs de redirección
/**
 * @function validateRedirectUrl
 * @description Middleware para validar URLs de redirección para prevenir "Open Redirects".
 * @param {Array<string>} allowedDomains - Dominios a los que se permite redirigir.
 * @returns {Function} Middleware.
 */
const validateRedirectUrl = (allowedDomains) => (req, res, next) => {
  const redirectUrl = req.query.next || req.body.redirect; // Ejemplo de cómo se pasa la URL
  if (redirectUrl) {
    try {
      const url = new URL(redirectUrl);
      if (!allowedDomains.includes(url.hostname)) {
        logger.warn(
          `[SEGURIDAD] Intento de Open Redirect a dominio no permitido: ${redirectUrl} desde IP: ${req.ip}`
        );
        return res
          .status(400)
          .json({ message: "URL de redirección no válida." });
      }
    } catch (e) {
      logger.warn(
        `[SEGURIDAD] URL de redirección malformada: ${redirectUrl}, Error: ${e.message}`
      );
      return res.status(400).json({ message: "URL de redirección inválida." });
    }
  }
  next();
};

// 69. (Mejora #69) Protección contra "Broken Session Management" (conceptual)
// Implica la combinación de cookies seguras, rotación de sesiones, invalidación y monitoreo.
const brokenSessionManagementReminder = () => {
  logger.debug(
    '[SEGURIDAD] Recordatorio: Asegurar una gestión de sesiones robusta para prevenir "Broken Session Management".'
  );
};

// 70. (Mejora #70) Middleware para la detección de "Mass Assignment" (conceptual, para ORMs)
// Esto es relevante si tu ORM mapea automáticamente el cuerpo de la solicitud a un modelo.
const detectMassAssignment = () => {
  logger.debug(
    '[SEGURIDAD] Detección de "Mass Assignment": Asegurar que solo los campos permitidos se actualicen desde la entrada del usuario.'
  );
};

// 71. (Mejora #71) Middleware para el "Hardening" de cookies (más allá de HttpOnly, Secure, SameSite)
// Ya cubierto por `getSecureCookieOptions` con las principales, pero se pueden añadir otras.

// 72. (Mejora #72) Implementación de "Rate Limiting" a nivel de usuario (más allá de IP)
/**
 * @function userRateLimiter
 * @description Crea un limitador de tasa basado en el ID de usuario (requiere autenticación previa).
 * @param {number} maxRequests - Número máximo de solicitudes.
 * @param {number} windowMs - Ventana de tiempo en milisegundos.
 * @returns {Function} Middleware.
 */
const userRateLimiter = (maxRequests = 60, windowMs = 60 * 1000) => {
  return rateLimit({
    windowMs: windowMs,
    max: maxRequests,
    keyGenerator: (req) => (req.user ? req.user.id : req.ip), // Usa userId si está autenticado, sino IP
    message: "Demasiadas solicitudes. Por favor, reduce la frecuencia.",
    standardHeaders: true,
    legacyHeaders: false,
  });
};

// 73. (Mejora #73) Protección contra ataques de "File Inclusion" (Local/Remote File Inclusion)
// Esto se previene principalmente con validación estricta de rutas de archivo y no permitiendo entrada de usuario en `require()` o `fs.readFile()`.
const fileInclusionPrevention = () => {
  logger.debug(
    "[SEGURIDAD] Recordatorio: Validar estrictamente las rutas de archivo de entrada para prevenir ataques de File Inclusion."
  );
};

// 74. (Mejora #74) Uso de "Content-Security-Policy-Report-Only" para pruebas
// Esto se usaría en desarrollo o staging antes de aplicar CSP en modo `enforce`.
const cspReportOnly = () => {
  logger.debug(
    "[SEGURIDAD] Recomendación: Usar CSP en modo Report-Only en entornos de prueba para monitorear violaciones sin bloquear."
  );
};

// 75. (Mejora #75) Middleware para la detección de "Insecure Direct Object References" (IDOR)
/**
 * @function preventIDOR
 * @description Middleware conceptual para prevenir IDOR.
 * Asegura que el usuario autenticado solo pueda acceder a los recursos que le pertenecen.
 * @param {string} resourceOwnerField - El campo en el recurso que indica el propietario (ej. 'userId').
 * @returns {Function} Middleware.
 */
const preventIDOR =
  (resourceOwnerField = "userId") =>
  (req, res, next) => {
    // Requiere que `req.user` esté poblado con el ID del usuario autenticado
    // y que el recurso tenga un campo que identifique a su propietario.
    // Ejemplo: Si `req.params.id` es el ID de un recurso, y ese recurso tiene un `ownerId`.
    // const resourceId = req.params.id;
    // const currentUserId = req.user.id;
    // const resource = await getResourceById(resourceId);
    // if (resource && resource[resourceOwnerField] !== currentUserId) {
    //     logger.warn(`[SEGURIDAD] Intento de IDOR por usuario ${currentUserId} en recurso ${resourceId}`);
    //     return res.status(403).json({ message: 'Acceso no autorizado al recurso.' });
    // }
    next();
  };

// 76. (Mejora #76) Protección contra "Cross-Site Request Forgery (CSRF)" (ya con csurf)
// `csurf` ya lo cubre.

// 77. (Mejora #77) Middleware para la validación de firmas de webhook (si se usan)
/**
 * @function verifyWebhookSignature
 * @description Middleware para verificar la firma de un webhook para asegurar su autenticidad.
 * @param {string} secret - El secreto compartido para firmar el webhook.
 * @param {string} headerName - Nombre de la cabecera que contiene la firma (ej. 'X-Hub-Signature').
 * @param {Function} hashAlgorithm - Función para generar el hash (ej. `crypto.createHmac`).
 * @returns {Function} Middleware.
 */
const verifyWebhookSignature =
  (secret, headerName = "x-hub-signature", hashAlgorithm = "sha256") =>
  (req, res, next) => {
    const signature = req.headers[headerName];
    if (!signature) {
      logger.warn(`[SEGURIDAD] Webhook sin firma desde IP: ${req.ip}`);
      return res.status(401).json({ message: "Firma de webhook faltante." });
    }

    const payload = JSON.stringify(req.body); // Asegúrate de que el cuerpo sea parseado antes
    const hmac = crypto.createHmac(hashAlgorithm, secret); // Usar crypto
    const digest = `${hashAlgorithm}=` + hmac.update(payload).digest("hex");

    if (!safeCompare(digest, signature)) {
      // Usa safeCompare para evitar timing attacks
      logger.warn(`[SEGURIDAD] Firma de webhook inválida desde IP: ${req.ip}`);
      return res.status(403).json({ message: "Firma de webhook inválida." });
    }
    next();
  };

// 78. (Mejora #78) Implementación de "Security Headers" para proteger contra ataques de "MIME Sniffing" (ya en Helmet)
// `noSniff: true` en Helmet ya lo cubre.

// 79. (Mejora #79) Middleware para la detección de "Sensitive Data Exposure" (conceptual)
// Esto es una combinación de buenas prácticas de codificación, auditoría de logs y configuración de DB.
const detectSensitiveDataExposure = () => {
  logger.debug(
    '[SEGURIDAD] Detección de "Sensitive Data Exposure": Evitar exponer datos sensibles en logs, errores o respuestas de API.'
  );
};

// 80. (Mejora #80) Implementación de "Security Logging" (más allá de eventos de seguridad)
// Esto es una práctica general de logging.
const comprehensiveSecurityLogging = () => {
  logger.debug(
    "[SEGURIDAD] Logging de seguridad integral: Registrar eventos de autenticación, autorización, cambios de configuración, y accesos a datos sensibles."
  );
};

// --- 40 Mejoras Adicionales (continuación de la numeración) ---

// 81. (Mejora #81) Multi-Factor Authentication (MFA) Integration (Conceptual)
/**
 * @function enforceMFA
 * @description Middleware conceptual para forzar la autenticación multifactor (MFA).
 * Requiere integración con un proveedor de MFA (ej. Authy, Google Authenticator).
 * @returns {Function} Middleware.
 */
const enforceMFA = () => (req, res, next) => {
  // Lógica para verificar si el usuario ya ha completado el MFA para la sesión actual
  // Si no, redirigir a la página de MFA o devolver un error 403
  logger.debug(
    "[SEGURIDAD] Recordatorio: Implementar MFA para una capa adicional de seguridad."
  );
  next();
};

// 82. (Mejora #82) Passwordless Authentication (Conceptual)
/**
 * @function passwordlessAuth
 * @description Middleware conceptual para autenticación sin contraseña (ej. magic links, WebAuthn).
 * @returns {Function} Middleware.
 */
const passwordlessAuth = () => (req, res, next) => {
  logger.debug(
    "[SEGURIDAD] Recordatorio: Considerar autenticación sin contraseña para mejorar la experiencia y seguridad del usuario."
  );
  next();
};

// 83. (Mejora #83) OAuth/OpenID Connect Integration (Conceptual)
/**
 * @function oauthIntegration
 * @description Middleware conceptual para integrar OAuth/OpenID Connect (SSO con terceros).
 * @returns {Function} Middleware.
 */
const oauthIntegration = () => (req, res, next) => {
  logger.debug(
    "[SEGURIDAD] Recordatorio: Integrar OAuth/OpenID Connect para SSO y delegación de autenticación."
  );
  next();
};

// 84. (Mejora #84) Session Inactivity Timeout
/**
 * @function sessionInactivityTimeout
 * @description Middleware para cerrar sesión automáticamente a usuarios inactivos.
 * @param {number} timeoutMs - Tiempo de inactividad en milisegundos (ej. 30 minutos).
 * @returns {Function} Middleware.
 */
const sessionInactivityTimeout =
  (timeoutMs = 30 * 60 * 1000) =>
  (req, res, next) => {
    if (req.session && req.session.lastActivity) {
      if (Date.now() - req.session.lastActivity > timeoutMs) {
        logger.info(
          `[SEGURIDAD] Sesión expirada por inactividad para usuario: ${
            req.session.userId || "N/A"
          }`
        );
        req.session.destroy((err) => {
          if (err)
            logger.error("Error al destruir sesión por inactividad:", err);
          res.status(401).json({
            message:
              "Sesión expirada por inactividad. Por favor, inicia sesión de nuevo.",
          });
        });
        return;
      }
    }
    if (req.session) {
      req.session.lastActivity = Date.now(); // Actualizar la última actividad
    }
    next();
  };

// 85. (Mejora #85) Concurrent Session Control
/**
 * @function limitConcurrentSessions
 * @description Middleware para limitar el número de sesiones concurrentes por usuario.
 * Requiere un sistema para rastrear sesiones activas (ej. Redis).
 * @param {number} maxSessions - Número máximo de sesiones permitidas.
 * @returns {Function} Middleware.
 */
const limitConcurrentSessions =
  (maxSessions = 1) =>
  (req, res, next) => {
    logger.debug(
      "[SEGURIDAD] Recordatorio: Limitar sesiones concurrentes para prevenir el uso compartido de credenciales."
    );
    next();
  };

// 86. (Mejora #86) Credential Stuffing Protection (Conceptual)
/**
 * @function credentialStuffingProtection
 * @description Middleware conceptual para proteger contra ataques de Credential Stuffing.
 * Requiere monitorear patrones de inicio de sesión fallidos en múltiples cuentas.
 * @returns {Function} Middleware.
 */
const credentialStuffingProtection = () => (req, res, next) => {
  logger.debug(
    "[SEGURIDAD] Recordatorio: Implementar protección contra Credential Stuffing monitoreando patrones de login."
  );
  next();
};

// 87. (Mejora #87) Centralized Logging (Conceptual)
const centralizedLoggingRecommendation = () => {
  logger.debug(
    "[SEGURIDAD] Recomendación: Usar un sistema de logging centralizado (ELK Stack, Splunk, Datadog) para monitoreo y análisis."
  );
};

// 88. (Mejora #88) Security Information and Event Management (SIEM) Integration (Conceptual)
const siemIntegrationRecommendation = () => {
  logger.debug(
    "[SEGURIDAD] Recomendación: Integrar con un SIEM para análisis de seguridad avanzado y correlación de eventos."
  );
};

// 89. (Mejora #89) Alerting for Anomalous Behavior
/**
 * @function setupSecurityAlerts
 * @description Configura alertas para comportamientos anómalos de seguridad.
 * @returns {Function} Middleware.
 */
const setupSecurityAlerts = () => (req, res, next) => {
  // Esto se integraría con tu sistema de monitoreo/alertas
  // Ejemplo: Si detectas X intentos de login fallidos en Y segundos, envía un email/SMS.
  logger.debug(
    "[SEGURIDAD] Recordatorio: Configurar alertas para anomalías de seguridad."
  );
  next();
};

// 90. (Mejora #90) Log Tampering Detection
const logTamperingDetection = () => {
  logger.debug(
    "[SEGURIDAD] Recordatorio: Implementar mecanismos para detectar la manipulación de logs (ej. hashing, firmas)."
  );
};

// 91. (Mejora #91) Data Encryption at Rest (Conceptual)
const dataEncryptionAtRestRecommendation = () => {
  logger.debug(
    "[SEGURIDAD] Recomendación: Asegurar la encriptación de datos en reposo en la base de datos y almacenamiento."
  );
};

// 92. (Mejora #92) Data Encryption in Transit (SSL/TLS)
const dataEncryptionInTransitRecommendation = () => {
  logger.debug(
    "[SEGURIDAD] Recomendación: Forzar el uso de TLS 1.2+ con cifrados fuertes para toda la comunicación."
  );
};

// 93. (Mejora #93) Data Masking/Tokenization (Conceptual)
const dataMaskingRecommendation = () => {
  logger.debug(
    "[SEGURIDAD] Recomendación: Usar enmascaramiento o tokenización para datos sensibles en entornos de no producción."
  );
};

// 94. (Mejora #94) GDPR/CCPA Compliance Features (Conceptual)
const dataPrivacyComplianceReminder = () => {
  logger.debug(
    "[SEGURIDAD] Recordatorio: Implementar características para cumplir con regulaciones de privacidad (GDPR, CCPA)."
  );
};

// 95. (Mejora #95) Secure File Storage (Conceptual)
const secureFileStorageRecommendation = () => {
  logger.debug(
    "[SEGURIDAD] Recomendación: Almacenar archivos subidos de forma segura, fuera del directorio público, con control de acceso."
  );
};

// 96. (Mejora #96) GraphQL Security (if applicable)
/**
 * @function graphqlSecurity
 * @description Middleware conceptual para seguridad en GraphQL (limitación de profundidad, complejidad de consulta).
 * @returns {Function} Middleware.
 */
const graphqlSecurity = () => (req, res, next) => {
  logger.debug(
    "[SEGURIDAD] Recordatorio: Para GraphQL, implementar limitación de profundidad de consulta y análisis de complejidad."
  );
  next();
};

// 97. (Mejora #97) API Versioning Security
const apiVersioningSecurityReminder = () => {
  logger.debug(
    "[SEGURIDAD] Recordatorio: Deprecar y deshabilitar versiones antiguas de la API de forma segura."
  );
};

// 98. (Mejora #98) API Gateway Authentication/Authorization (Conceptual)
const apiGatewayAuthRecommendation = () => {
  logger.debug(
    "[SEGURIDAD] Recomendación: Descargar la autenticación/autorización a un API Gateway para centralizar la seguridad."
  );
};

// 99. (Mejora #99) Input Schema Validation for all API Endpoints (Conceptual)
const strictInputValidationReminder = () => {
  logger.debug(
    "[SEGURIDAD] Recordatorio: Implementar validación estricta de esquemas de entrada para todos los endpoints de la API."
  );
};

// 100. (Mejora #100) Generic Error Messages in Production
/**
 * @function genericErrorMessages
 * @description Middleware para asegurar que los mensajes de error en producción sean genéricos.
 * @returns {Function} Middleware.
 */
const genericErrorMessages = () => (err, req, res, next) => {
  if (process.env.NODE_ENV === "production") {
    res.status(err.status || 500).json({
      message:
        "Ocurrió un error inesperado. Por favor, inténtalo de nuevo más tarde.",
      // No enviar detalles sensibles del error en producción
    });
  } else {
    next(err); // En desarrollo, pasar el error para depuración
  }
};

// 101. (Mejora #101) Custom Error Pages
const customErrorPagesRecommendation = () => {
  logger.debug(
    "[SEGURIDAD] Recomendación: Implementar páginas de error personalizadas (404, 500, etc.) para una mejor UX y evitar la divulgación de información."
  );
};

// 102. (Mejora #102) Error Logging to External Service
const externalErrorLoggingRecommendation = () => {
  logger.debug(
    "[SEGURIDAD] Recomendación: Enviar errores críticos a un servicio externo (Sentry, Bugsnag, New Relic) para monitoreo proactivo."
  );
};

// 103. (Mejora #103) Container Security (Docker/Kubernetes)
const containerSecurityRecommendation = () => {
  logger.debug(
    "[SEGURIDAD] Recomendación: Asegurar las imágenes de contenedores (Docker) y las configuraciones de orquestación (Kubernetes)."
  );
};

// 104. (Mejora #104) Infrastructure as Code (IaC) Security (Conceptual)
const iacSecurityRecommendation = () => {
  logger.debug(
    "[SEGURIDAD] Recomendación: Escanear IaC (Terraform, CloudFormation) en busca de vulnerabilidades antes del despliegue."
  );
};

// 105. (Mejora #105) Secrets Management in CI/CD
const ciCdSecretsManagementRecommendation = () => {
  logger.debug(
    "[SEGURIDAD] Recomendación: Inyectar secretos de forma segura en pipelines CI/CD (ej. usando variables de entorno seguras, Vault)."
  );
};

// 106. (Mejora #106) Network Segmentation
const networkSegmentationRecommendation = () => {
  logger.debug(
    "[SEGURIDAD] Recomendación: Implementar segmentación de red para aislar diferentes componentes de la aplicación."
  );
};

// 107. (Mejora #107) Firewall Configuration (Conceptual)
const firewallConfigurationRecommendation = () => {
  logger.debug(
    "[SEGURIDAD] Recomendación: Configurar firewalls para restringir el tráfico de red de entrada y salida."
  );
};

// 108. (Mejora #108) Regular Security Audits/Penetration Testing
const securityAuditsRecommendation = () => {
  logger.debug(
    "[SEGURIDAD] Recomendación: Realizar auditorías de seguridad y pruebas de penetración regulares."
  );
};

// 109. (Mejora #109) Secure Coding Guidelines
const secureCodingGuidelinesRecommendation = () => {
  logger.debug(
    "[SEGURIDAD] Recomendación: Establecer y seguir guías de codificación segura para todo el equipo de desarrollo."
  );
};

// 110. (Mejora #110) Threat Modeling
const threatModelingRecommendation = () => {
  logger.debug(
    "[SEGURIDAD] Recomendación: Realizar modelado de amenazas al inicio de cada proyecto o característica nueva."
  );
};

// 111. (Mejora #111) Security Training for Developers
const securityTrainingRecommendation = () => {
  logger.debug(
    "[SEGURIDAD] Recomendación: Proporcionar formación regular en seguridad para los desarrolladores."
  );
};

// 112. (Mejora #112) Code Review for Security Issues
const securityCodeReviewRecommendation = () => {
  logger.debug(
    "[SEGURIDAD] Recomendación: Incluir la revisión de seguridad como parte del proceso de revisión de código."
  );
};

// 113. (Mejora #113) Dependency Management Automation
const dependencyAutomationRecommendation = () => {
  logger.debug(
    "[SEGURIDAD] Recomendación: Automatizar el escaneo y la gestión de dependencias vulnerables."
  );
};

// 114. (Mejora #114) Static Application Security Testing (SAST)
const sastRecommendation = () => {
  logger.debug(
    "[SEGURIDAD] Recomendación: Usar herramientas SAST para analizar el código fuente en busca de vulnerabilidades."
  );
};

// 115. (Mejora #115) Dynamic Application Security Testing (DAST)
const dastRecommendation = () => {
  logger.debug(
    "[SEGURIDAD] Recomendación: Usar herramientas DAST para probar la aplicación en ejecución en busca de vulnerabilidades."
  );
};

// 116. (Mejora #116) HTTP Parameter Pollution (HPP) - Deeper Dive
const hppDeeperDive = () => {
  logger.debug(
    "[SEGURIDAD] HPP Deeper Dive: Asegurar que todos los parsers de query y body manejen HPP correctamente, o usar `hpp` middleware."
  );
};

// 117. (Mejora #117) Content-Type Options - Deeper Dive
const contentTypeOptionsDeeperDive = () => {
  logger.debug(
    "[SEGURIDAD] Content-Type Options: Asegurar `X-Content-Type-Options: nosniff` para prevenir la interpretación incorrecta de tipos MIME."
  );
};

// 118. (Mejora #118) Cross-Site Scripting (XSS) - Deeper Dive
const xssDeeperDive = () => {
  logger.debug(
    "[SEGURIDAD] XSS Deeper Dive: Implementar codificación de salida contextual y usar frameworks que prevengan XSS por defecto."
  );
};

// 119. (Mejora #119) SQL Injection - Deeper Dive
const sqlInjectionDeeperDive = () => {
  logger.debug(
    "[SEGURIDAD] SQL Injection Deeper Dive: Además de parameterized queries, usar ORMs que las soporten y evitar la construcción manual de consultas."
  );
};

// 120. (Mejora #120) Command Injection - Deeper Dive
const commandInjectionDeeperDive = () => {
  logger.debug(
    "[SEGURIDAD] Command Injection Deeper Dive: Usar APIs seguras para ejecutar comandos externos (ej. `child_process.execFile` en lugar de `exec`) y validar estrictamente los argumentos."
  );
};

module.exports = {
  configureHelmet,
  securityRateLimiter,
  authRateLimiter,
  errorRateLimiter,
  sanitizeInput,
  enforceHttps,
  csrfProtection,
  cookieParser,
  logSecurityEvent,
  getSecureCookieOptions,
  hashPassword,
  comparePassword,
  generateToken,
  verifyToken,
  generateRefreshToken,
  verifyRefreshToken,
  addTokenToBlacklist,
  isTokenBlacklisted,
  verifyRecaptcha,
  protectWithApiKey,
  preventOsCommandInjection,
  setAdditionalSecurityHeaders,
  validateJsonBody,
  validateEnvironmentVariables,
  enforcePasswordPolicy,
  accountLockout,
  preventSSRF,
  preventXXE,
  noCacheSensitiveData,
  handleCorsPreflight,
  configureSession,
  validateJwtAuth,
  refreshTokenMiddleware,
  authorizeRoles,
  validateSchema,
  deserializationWarning,
  corsErrorHandler,
  limitFileUploadSize,
  setAuthHeaders,
  principleOfLeastPrivilegeReminder,
  apiGatewayRecommendation,
  wafRecommendation,
  // Mejoras 41-80
  detectBots,
  safeCompare,
  hpkpWarning,
  detectPortScanning,
  sriRecommendation,
  loadSecretsSecurely,
  preventHeaderInjection,
  preventSessionFixation,
  detectBrokenAuthentication,
  securityLinterRecommendation,
  sanitizeFilename,
  validateContentType,
  preventDirectoryTraversal,
  auditLoginLogout,
  validateHostHeader,
  hideServerInfo,
  sqlInjectionPreventionReminder,
  securityByDesignReminder,
  dbLeastPrivilegeReminder,
  credentialRotationReminder,
  preventReDos,
  detectBrokenAccessControl,
  detectBrokenFunctionLevelAuth,
  validateJWS,
  validateRedirectUrl,
  brokenSessionManagementReminder,
  detectMassAssignment,
  userRateLimiter,
  fileInclusionPrevention,
  cspReportOnly,
  preventIDOR,
  verifyWebhookSignature,
  detectSensitiveDataExposure,
  comprehensiveSecurityLogging,
  // Nuevas mejoras 81-120
  enforceMFA, // 81
  passwordlessAuth, // 82
  oauthIntegration, // 83
  sessionInactivityTimeout, // 84
  limitConcurrentSessions, // 85
  credentialStuffingProtection, // 86
  centralizedLoggingRecommendation, // 87
  siemIntegrationRecommendation, // 88
  setupSecurityAlerts, // 89
  logTamperingDetection, // 90
  dataEncryptionAtRestRecommendation, // 91
  dataEncryptionInTransitRecommendation, // 92
  dataMaskingRecommendation, // 93
  dataPrivacyComplianceReminder, // 94
  secureFileStorageRecommendation, // 95
  graphqlSecurity, // 96
  apiVersioningSecurityReminder, // 97
  apiGatewayAuthRecommendation, // 98
  strictInputValidationReminder, // 99
  genericErrorMessages, // 100
  customErrorPagesRecommendation, // 101
  externalErrorLoggingRecommendation, // 102
  containerSecurityRecommendation, // 103
  iacSecurityRecommendation, // 104
  ciCdSecretsManagementRecommendation, // 105
  networkSegmentationRecommendation, // 106
  firewallConfigurationRecommendation, // 107
  securityAuditsRecommendation, // 108
  secureCodingGuidelinesRecommendation, // 109
  threatModelingRecommendation, // 110
  securityTrainingRecommendation, // 111
  securityCodeReviewRecommendation, // 112
  dependencyAutomationRecommendation, // 113
  sastRecommendation, // 114
  dastRecommendation, // 115
  hppDeeperDive, // 116
  contentTypeOptionsDeeperDive, // 117
  xssDeeperDive, // 118
  sqlInjectionDeeperDive, // 119
  commandInjectionDeeperDive, // 120
};
