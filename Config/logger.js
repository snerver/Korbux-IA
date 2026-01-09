/**
 * @file Configuración de entornos y utilidades para la aplicación.
 * Proporciona variables de entorno específicas para desarrollo y producción,
 * así como funciones para acceder y validar la configuración del entorno actual.
 * @module config/environments
 */

// 🛠️ Configuración de entornos mejorada
const environments = Object.freeze({
  development: Object.freeze({
    environmentVariables: Object.freeze({
      NODE_ENV: "development",
      // 1. NEXT_PUBLIC_URL: URL pública de la aplicación frontend
      NEXT_PUBLIC_URL:
        typeof window !== "undefined"
          ? window.location.origin
          : "http://localhost:3000",
      // 2. REACT_APP_API_URL: URL base de la API backend
      REACT_APP_API_URL:
        process.env.REACT_APP_API_URL || "http://localhost:8080/api/v1",
      // 3. REACT_APP_PRODUCTION_URL: URL de producción (para referencias absolutas)
      REACT_APP_PRODUCTION_URL: null, // No aplica en desarrollo
      // 4. REACT_APP_SECRET_KEY: Clave secreta para operaciones de desarrollo (NO USAR EN PRODUCCIÓN)
      REACT_APP_SECRET_KEY:
        process.env.REACT_APP_SECRET_KEY || "dev-secret-key-123-please-change",
      // 5. REACT_APP_PUBLIC_KEY: Clave pública para operaciones de desarrollo
      REACT_APP_PUBLIC_KEY:
        process.env.REACT_APP_PUBLIC_KEY || "dev-public-key-456-please-change",
      // 6. REACT_APP_DEBUG_MODE: Habilitar/deshabilitar modo debug
      REACT_APP_DEBUG_MODE: true, // 🔍 Habilitar modo debug en desarrollo
      // 7. REACT_APP_LOG_LEVEL: Nivel de logs para la aplicación
      REACT_APP_LOG_LEVEL: "verbose", // 📝 Nivel detallado de logs
      // 8. REACT_APP_SENTRY_DSN: DSN para Sentry (monitoreo de errores)
      REACT_APP_SENTRY_DSN: "", // Vacío en desarrollo
      // 9. REACT_APP_ANALYTICS_ID: ID para servicios de analíticas (ej. Google Analytics)
      REACT_APP_ANALYTICS_ID: "UA-XXXXX-Y",
      // 10. DB_DIALECT: Dialecto de la base de datos (ej. 'postgres', 'mysql', 'sqlite')
      DB_DIALECT: process.env.DB_DIALECT || "sqlite",
      // 11. DB_HOST: Host de la base de datos
      DB_HOST: process.env.DB_HOST || "localhost",
      // 12. DB_PORT: Puerto de la base de datos
      DB_PORT: process.env.DB_PORT || "5432",
      // 13. DB_USER: Usuario de la base de datos
      DB_USER: process.env.DB_USER || "dev_user",
      // 14. DB_PASSWORD: Contraseña de la base de datos
      DB_PASSWORD: process.env.DB_PASSWORD || "dev_password",
      // 15. DB_NAME: Nombre de la base de datos
      DB_NAME: process.env.DB_NAME || "dev_database",
      // 16. EMAIL_HOST: Host del servidor de correo
      EMAIL_HOST: process.env.EMAIL_HOST || "smtp.mailtrap.io",
      // 17. EMAIL_PORT: Puerto del servidor de correo
      EMAIL_PORT: process.env.EMAIL_PORT || "2525",
      // 18. EMAIL_USER: Usuario del servidor de correo
      EMAIL_USER: process.env.EMAIL_USER || "dev_email_user",
      // 19. EMAIL_PASS: Contraseña del servidor de correo
      EMAIL_PASS: process.env.EMAIL_PASS || "dev_email_pass",
      // 20. CLOUD_STORAGE_BUCKET: Nombre del bucket de almacenamiento en la nube
      CLOUD_STORAGE_BUCKET: process.env.CLOUD_STORAGE_BUCKET || "dev-bucket",
      // 21. CLOUD_STORAGE_REGION: Región del bucket de almacenamiento en la nube
      CLOUD_STORAGE_REGION: process.env.CLOUD_STORAGE_REGION || "us-east-1",
      // 22. CLOUD_STORAGE_ACCESS_KEY_ID: ID de clave de acceso para almacenamiento en la nube
      CLOUD_STORAGE_ACCESS_KEY_ID:
        process.env.CLOUD_STORAGE_ACCESS_KEY_ID || "dev_access_key",
      // 23. CLOUD_STORAGE_SECRET_ACCESS_KEY: Clave secreta de acceso para almacenamiento en la nube
      CLOUD_STORAGE_SECRET_ACCESS_KEY:
        process.env.CLOUD_STORAGE_SECRET_ACCESS_KEY || "dev_secret_access_key",
      // 24. PAYMENT_GATEWAY_API_KEY: Clave de API del proveedor de pagos
      PAYMENT_GATEWAY_API_KEY:
        process.env.PAYMENT_GATEWAY_API_KEY || "dev_payment_api_key",
      // 25. JWT_SECRET: Secreto para firmar JWTs de acceso
      JWT_SECRET: process.env.JWT_SECRET || "dev-jwt-secret",
      // 26. JWT_REFRESH_SECRET: Secreto para firmar JWTs de refresco
      JWT_REFRESH_SECRET:
        process.env.JWT_REFRESH_SECRET || "dev-jwt-refresh-secret",
      // 27. RECAPTCHA_SECRET_KEY: Clave secreta de reCAPTCHA
      RECAPTCHA_SECRET_KEY:
        process.env.RECAPTCHA_SECRET_KEY || "dev-recaptcha-secret",
      // 28. CORS_ORIGIN: Orígenes permitidos para CORS (separados por coma)
      CORS_ORIGIN:
        process.env.CORS_ORIGIN ||
        "http://localhost:3000,http://127.0.0.1:5500",
      // 29. SESSION_SECRET: Secreto para las sesiones de Express (si se usan)
      SESSION_SECRET: process.env.SESSION_SECRET || "dev-session-secret",
      // 30. HTTPS_ENABLED: Habilitar HTTPS (solo en producción con proxy)
      HTTPS_ENABLED: false,
      // 31. TRUST_PROXY: Habilitar confianza en encabezados de proxy
      TRUST_PROXY: false,
      // 32. WEB_SOCKET_URL: URL para WebSockets
      WEB_SOCKET_URL: process.env.WEB_SOCKET_URL || "ws://localhost:8080",
      // 33. CACHE_ENABLED: Habilitar/deshabilitar caché
      CACHE_ENABLED: true,
      // 34. REDIS_URL: URL para Redis (si se usa para caché/sesiones)
      REDIS_URL: process.env.REDIS_URL || "redis://localhost:6379",
      // 35. MONGODB_URI: URI para MongoDB (si se usa)
      MONGODB_URI:
        process.env.MONGODB_URI || "mongodb://localhost:27017/dev_db",
      // 36. DEBUG_NAMESPACE: Namespace para logs de debug (ej. 'app:*')
      DEBUG_NAMESPACE: process.env.DEBUG_NAMESPACE || "app:*",
      // 37. ERROR_REPORTING_ENABLED: Habilitar/deshabilitar reporte de errores
      ERROR_REPORTING_ENABLED: true,
      // 38. ANALYTICS_ENABLED: Habilitar/deshabilitar analíticas
      ANALYTICS_ENABLED: true,
      // 39. TEST_MODE: Indica si la aplicación está en modo de prueba
      TEST_MODE: false,
      // 40. MOCK_API_RESPONSES: Habilitar/deshabilitar respuestas mock de API
      MOCK_API_RESPONSES: true,
    }),
    exclusions: Object.freeze([
      "/node_modules",
      "/dist", // 41. Excluir directorio de compilación
      "/build", // 42. Excluir directorio de compilación
      "/coverage", // 43. Excluir directorio de cobertura de pruebas
      "/.git",
      "/.vscode",
      "/.idea",
      "/var/lib/josephjs/.bin/*", // Específico de un entorno
      "/proc",
      "/.env*", // 🔒 Excluir todos los .env
      "/docker*",
      "/logs/", // 44. Excluir directorio de logs
      "/temp/", // 45. Excluir directorio de archivos temporales
      "*.log", // 46. Excluir archivos de log
      "*.tmp", // 47. Excluir archivos temporales
      "*.bak", // 48. Excluir archivos de respaldo
      "*.swp", // 49. Excluir archivos swap de Vim
      "package-lock.json", // 50. Excluir bloqueos de paquetes (generalmente no sensibles, pero grandes)
      "yarn.lock", // 51. Excluir bloqueos de yarn
    ]),
  }),

  production: Object.freeze({
    environmentVariables: Object.freeze({
      NODE_ENV: "production",
      NEXT_PUBLIC_URL:
        typeof window !== "undefined"
          ? window.location.origin
          : "https://tudominio.com",
      REACT_APP_API_URL:
        process.env.REACT_APP_API_URL || "https://api.tudominio.com/v1",
      REACT_APP_PRODUCTION_URL:
        process.env.REACT_APP_PRODUCTION_URL || "https://tudominio.com",
      // 52. REACT_APP_SECRET_KEY: Clave secreta (DEBE VENIR DE VAR. DE ENTORNO/SECRETS MANAGER)
      REACT_APP_SECRET_KEY: process.env.REACT_APP_SECRET_KEY,
      // 53. REACT_APP_PUBLIC_KEY: Clave pública (DEBE VENIR DE VAR. DE ENTORNO/SECRETS MANAGER)
      REACT_APP_PUBLIC_KEY: process.env.REACT_APP_PUBLIC_KEY,
      REACT_APP_DEBUG_MODE: false, // 🚫 Deshabilitar debug en producción
      REACT_APP_LOG_LEVEL: "warn", // 📉 Nivel de logs más restrictivo
      REACT_APP_SENTRY_DSN: process.env.REACT_APP_SENTRY_DSN || "", // 🔍 Monitoreo de errores
      REACT_APP_ANALYTICS_ID:
        process.env.REACT_APP_ANALYTICS_ID || "UA-XXXXX-Y",
      DB_DIALECT: process.env.DB_DIALECT || "postgres",
      DB_HOST: process.env.DB_HOST, // 54. DEBE VENIR DE VAR. DE ENTORNO
      DB_PORT: process.env.DB_PORT || "5432",
      DB_USER: process.env.DB_USER, // 55. DEBE VENIR DE VAR. DE ENTORNO
      DB_PASSWORD: process.env.DB_PASSWORD, // 56. DEBE VENIR DE VAR. DE ENTORNO
      DB_NAME: process.env.DB_NAME, // 57. DEBE VENIR DE VAR. DE ENTORNO
      EMAIL_HOST: process.env.EMAIL_HOST, // 58. DEBE VENIR DE VAR. DE ENTORNO
      EMAIL_PORT: process.env.EMAIL_PORT || "587",
      EMAIL_USER: process.env.EMAIL_USER, // 59. DEBE VENIR DE VAR. DE ENTORNO
      EMAIL_PASS: process.env.EMAIL_PASS, // 60. DEBE VENIR DE VAR. DE ENTORNO
      CLOUD_STORAGE_BUCKET: process.env.CLOUD_STORAGE_BUCKET, // 61. DEBE VENIR DE VAR. DE ENTORNO
      CLOUD_STORAGE_REGION: process.env.CLOUD_STORAGE_REGION || "us-east-1",
      CLOUD_STORAGE_ACCESS_KEY_ID: process.env.CLOUD_STORAGE_ACCESS_KEY_ID, // 62. DEBE VENIR DE VAR. DE ENTORNO
      CLOUD_STORAGE_SECRET_ACCESS_KEY:
        process.env.CLOUD_STORAGE_SECRET_ACCESS_KEY, // 63. DEBE VENIR DE VAR. DE ENTORNO
      PAYMENT_GATEWAY_API_KEY: process.env.PAYMENT_GATEWAY_API_KEY, // 64. DEBE VENIR DE VAR. DE ENTORNO
      JWT_SECRET: process.env.JWT_SECRET, // 65. DEBE VENIR DE VAR. DE ENTORNO
      JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET, // 66. DEBE VENIR DE VAR. DE ENTORNO
      RECAPTCHA_SECRET_KEY: process.env.RECAPTCHA_SECRET_KEY, // 67. DEBE VENIR DE VAR. DE ENTORNO
      CORS_ORIGIN: process.env.CORS_ORIGIN || "https://tudominio.com",
      SESSION_SECRET: process.env.SESSION_SECRET, // 68. DEBE VENIR DE VAR. DE ENTORNO
      HTTPS_ENABLED: true, // 69. Habilitar HTTPS en producción
      TRUST_PROXY: true, // 70. Habilitar confianza en proxy en producción
      WEB_SOCKET_URL: process.env.WEB_SOCKET_URL || "wss://tudominio.com",
      CACHE_ENABLED: true,
      REDIS_URL: process.env.REDIS_URL, // 71. DEBE VENIR DE VAR. DE ENTORNO
      MONGODB_URI: process.env.MONGODB_URI, // 72. DEBE VENIR DE VAR. DE ENTORNO
      DEBUG_NAMESPACE: "", // 73. Deshabilitar debug detallado en producción
      ERROR_REPORTING_ENABLED: true, // 74. Habilitar reporte de errores
      ANALYTICS_ENABLED: true, // 75. Habilitar analíticas
      TEST_MODE: false,
      MOCK_API_RESPONSES: false, // 76. Deshabilitar mocks en producción
      // 77. VERSION: Versión de la aplicación
      VERSION: process.env.npm_package_version || "1.0.0",
      // 78. BUILD_ID: ID de la compilación
      BUILD_ID: process.env.CI_COMMIT_SHA || "local-build",
      // 79. APP_NAME: Nombre de la aplicación
      APP_NAME: process.env.APP_NAME || "MiAplicacion",
      // 80. MAX_UPLOAD_SIZE_MB: Tamaño máximo de archivo para subidas en MB
      MAX_UPLOAD_SIZE_MB: process.env.MAX_UPLOAD_SIZE_MB || "10",
      // 81. ALLOWED_FILE_TYPES: Tipos de archivo permitidos para subidas (separados por coma)
      ALLOWED_FILE_TYPES:
        process.env.ALLOWED_FILE_TYPES ||
        "image/jpeg,image/png,application/pdf",
      // 82. PASSWORD_SALT_ROUNDS: Rondas de sal para bcrypt
      PASSWORD_SALT_ROUNDS: process.env.PASSWORD_SALT_ROUNDS || "12",
      // 83. JWT_EXPIRATION_TIME: Tiempo de expiración de JWT de acceso (ej. '1h')
      JWT_EXPIRATION_TIME: process.env.JWT_EXPIRATION_TIME || "1h",
      // 84. REFRESH_TOKEN_EXPIRATION_TIME: Tiempo de expiración de JWT de refresco (ej. '7d')
      REFRESH_TOKEN_EXPIRATION_TIME:
        process.env.REFRESH_TOKEN_EXPIRATION_TIME || "7d",
      // 85. SESSION_TIMEOUT_MINUTES: Tiempo de inactividad de sesión en minutos
      SESSION_TIMEOUT_MINUTES: process.env.SESSION_TIMEOUT_MINUTES || "30",
      // 86. LOGIN_ATTEMPTS_LIMIT: Límite de intentos de login fallidos antes del bloqueo
      LOGIN_ATTEMPTS_LIMIT: process.env.LOGIN_ATTEMPTS_LIMIT || "5",
      // 87. LOCKOUT_DURATION_MINUTES: Duración del bloqueo de cuenta en minutos
      LOCKOUT_DURATION_MINUTES: process.env.LOCKOUT_DURATION_MINUTES || "30",
      // 88. CSP_REPORT_URI: URI para reportes de violaciones de CSP
      CSP_REPORT_URI:
        process.env.CSP_REPORT_URI || "https://report-uri.tudominio.com/csp",
      // 89. ALLOWED_REDIRECT_URLS: URLs de redirección permitidas (separadas por coma)
      ALLOWED_REDIRECT_URLS:
        process.env.ALLOWED_REDIRECT_URLS ||
        "https://tudominio.com/auth/callback",
      // 90. WEBHOOK_SECRET: Secreto para verificar firmas de webhooks
      WEBHOOK_SECRET: process.env.WEBHOOK_SECRET, // DEBE VENIR DE VAR. DE ENTORNO
      // 91. ENCRYPTION_KEY: Clave para cifrado simétrico de datos
      ENCRYPTION_KEY: process.env.ENCRYPTION_KEY, // DEBE VENIR DE VAR. DE ENTORNO
      // 92. HASH_SECRET: Secreto para hashing de datos no sensibles
      HASH_SECRET: process.env.HASH_SECRET, // DEBE VENIR DE VAR. DE ENTORNO
      // 93. THROTTLING_RATE_LIMIT: Límite de solicitudes para throttling general
      THROTTLING_RATE_LIMIT: process.env.THROTTLING_RATE_LIMIT || "100",
      // 94. THROTTLING_WINDOW_MS: Ventana de tiempo para throttling general en ms
      THROTTLING_WINDOW_MS: process.env.THROTTLING_WINDOW_MS || "60000",
      // 95. CI_CD_ENV: Indica si se está ejecutando en un entorno CI/CD
      CI_CD_ENV: process.env.CI_CD_ENV || "false",
      // 96. GIT_COMMIT_SHA: SHA del commit de Git
      GIT_COMMIT_SHA: process.env.GIT_COMMIT_SHA || "unknown",
      // 97. GIT_BRANCH: Rama de Git
      GIT_BRANCH: process.env.GIT_BRANCH || "unknown",
      // 98. DEPLOYMENT_DATE: Fecha de despliegue
      DEPLOYMENT_DATE: process.env.DEPLOYMENT_DATE || new Date().toISOString(),
      // 99. FEATURE_FLAG_NEW_DASHBOARD: Ejemplo de feature flag
      FEATURE_FLAG_NEW_DASHBOARD:
        process.env.FEATURE_FLAG_NEW_DASHBOARD || "false",
      // 100. LOG_FORMAT: Formato de los logs (ej. 'json', 'text')
      LOG_FORMAT: process.env.LOG_FORMAT || "json",
    }),
    exclusions: Object.freeze([
      "/.env*", // 🔒 Excluir todos los .env
      "/.git",
      "/.vscode",
      "/.idea",
      "/var/lib/josephjs/.bin/*", // Específico de un entorno
      "/proc",
      "/node_modules",
      "/test*",
      "/mock*",
      "*.spec.js",
      "*.test.js",
      "/coverage", // 101. Excluir directorio de cobertura de pruebas
      "/logs/", // 102. Excluir directorio de logs
      "/temp/", // 103. Excluir directorio de archivos temporales
      "*.log", // 104. Excluir archivos de log
      "*.tmp", // 105. Excluir archivos temporales
      "*.bak", // 106. Excluir archivos de respaldo
      "*.swp", // 107. Excluir archivos swap de Vim
      "package-lock.json", // 108. Excluir bloqueos de paquetes
      "yarn.lock", // 109. Excluir bloqueos de yarn
      "webpack.config.js", // 110. Excluir archivos de configuración de webpack
      "babel.config.js", // 111. Excluir archivos de configuración de babel
      "tsconfig.json", // 112. Excluir archivos de configuración de TypeScript
      "jest.config.js", // 113. Excluir archivos de configuración de Jest
      "README.md", // 114. Excluir archivos de documentación (si no se sirven públicamente)
      "LICENSE", // 115. Excluir archivos de licencia
      "CONTRIBUTING.md", // 116. Excluir guías de contribución
      "Dockerfile", // 117. Excluir Dockerfile
      "docker-compose.yml", // 118. Excluir docker-compose
      "nginx.conf", // 119. Excluir configuración de Nginx
      "server.key", // 120. Excluir claves privadas SSL/TLS
      "server.crt", // 121. Excluir certificados SSL/TLS
    ]),
  }),
});

// 🛠️ Utilidades para el entorno
const envUtils = Object.freeze({
  /**
   * Obtiene el nombre del entorno actual (development o production).
   * @returns {string} El nombre del entorno.
   */
  getCurrentEnv: () => process.env.NODE_ENV?.trim() ?? "development",

  /**
   * Verifica si el entorno actual es de producción.
   * @returns {boolean} True si es producción, false en caso contrario.
   */
  isProduction: () => envUtils.getCurrentEnv() === "production",

  /**
   * Verifica si el entorno actual es de desarrollo.
   * @returns {boolean} True si es desarrollo, false en caso contrario.
   */
  isDevelopment: () => envUtils.getCurrentEnv() === "development",

  /**
   * Verifica si la aplicación está en modo de prueba.
   * @returns {boolean} True si está en modo de prueba, false en caso contrario.
   */
  isTesting: () =>
    envUtils.get("TEST_MODE", false) === "true" ||
    envUtils.getCurrentEnv() === "test",

  /**
   * Verifica si la aplicación se está ejecutando en un entorno CI/CD.
   * @returns {boolean} True si es un entorno CI/CD, false en caso contrario.
   */
  isCI: () => envUtils.get("CI_CD_ENV", "false") === "true",

  /**
   * Verifica si la aplicación se está ejecutando en localhost.
   * @returns {boolean} True si es localhost, false en caso contrario.
   */
  isLocalhost: () =>
    envUtils.get("NEXT_PUBLIC_URL", "").includes("localhost") ||
    envUtils.get("REACT_APP_API_URL", "").includes("localhost"),

  /**
   * Niveles de log permitidos.
   * @type {ReadonlyArray<string>}
   */
  allowedLogLevels: Object.freeze([
    "error",
    "warn",
    "info",
    "debug",
    "verbose",
  ]),

  /**
   * Obtiene el nivel de log configurado para el entorno actual.
   * @returns {string} El nivel de log.
   */
  getLogLevel: () => {
    const logLevel = envUtils.get("REACT_APP_LOG_LEVEL", "info");
    return envUtils.allowedLogLevels.includes(logLevel) ? logLevel : "info";
  },

  /**
   * Obtiene el objeto de configuración de variables de entorno para el entorno actual.
   * @returns {Readonly<Object>} El objeto de variables de entorno.
   */
  getEnvConfig: () => {
    const currentEnv = envUtils.getCurrentEnv();
    return environments[currentEnv]
      ? environments[currentEnv].environmentVariables
      : environments.development.environmentVariables;
  },

  /**
   * Obtiene el valor de una variable de entorno.
   * Prioriza `process.env` sobre los valores definidos en `environments` para permitir overrides.
   * @param {string} key - La clave de la variable de entorno.
   * @param {*} [defaultValue] - Valor por defecto si la variable no está definida.
   * @returns {*} El valor de la variable de entorno o el valor por defecto.
   */
  get: (key, defaultValue) => {
    // Intenta obtener de process.env primero
    if (process.env[key] !== undefined) {
      return process.env[key];
    }
    // Si no está en process.env, busca en la configuración del entorno actual
    const currentEnvConfig = envUtils.getEnvConfig();
    if (currentEnvConfig[key] !== undefined) {
      return currentEnvConfig[key];
    }
    return defaultValue;
  },

  /**
   * Valida que las variables de entorno requeridas estén definidas.
   * @param {Array<string>} requiredVars - Array de nombres de variables de entorno requeridas.
   * @throws {Error} Si alguna variable requerida no está definida.
   */
  validateRequired: (requiredVars) => {
    const missingVars = requiredVars.filter(
      (key) =>
        envUtils.get(key) === undefined ||
        envUtils.get(key) === null ||
        envUtils.get(key) === ""
    );
    if (missingVars.length > 0) {
      const errorMessage = `Faltan las siguientes variables de entorno críticas: ${missingVars.join(
        ", "
      )}.`;
      console.error(`❌ ${errorMessage}`);
      throw new Error(errorMessage);
    }
  },

  /**
   * Obtiene el tamaño máximo de subida de archivos en MB.
   * @returns {number} Tamaño máximo en MB.
   */
  getMaxUploadSize: () =>
    parseInt(envUtils.get("MAX_UPLOAD_SIZE_MB", "10"), 10),

  /**
   * Obtiene los tipos de archivo permitidos para subidas como un array.
   * @returns {Array<string>} Array de tipos MIME permitidos.
   */
  getAllowedFileTypes: () =>
    envUtils
      .get("ALLOWED_FILE_TYPES", "")
      .split(",")
      .map((type) => type.trim())
      .filter((type) => type),

  /**
   * Verifica si una feature flag específica está habilitada.
   * @param {string} flagName - Nombre de la feature flag (ej. 'NEW_DASHBOARD').
   * @returns {boolean} True si la feature flag está habilitada, false en caso contrario.
   */
  isFeatureEnabled: (flagName) =>
    envUtils.get(`FEATURE_FLAG_${flagName.toUpperCase()}`, "false") === "true",

  /**
   * Obtiene los orígenes CORS permitidos como un array.
   * @returns {Array<string>} Array de orígenes permitidos.
   */
  getAllowedCorsOrigins: () =>
    envUtils
      .get("CORS_ORIGIN", "")
      .split(",")
      .map((origin) => origin.trim())
      .filter((origin) => origin),

  /**
   * Obtiene las URLs de redirección permitidas como un array.
   * @returns {Array<string>} Array de URLs permitidas.
   */
  getAllowedRedirectUrls: () =>
    envUtils
      .get("ALLOWED_REDIRECT_URLS", "")
      .split(",")
      .map((url) => url.trim())
      .filter((url) => url),

  /**
   * Obtiene el número de rondas de sal para bcrypt.
   * @returns {number} Número de rondas de sal.
   */
  getPasswordSaltRounds: () =>
    parseInt(envUtils.get("PASSWORD_SALT_ROUNDS", "12"), 10),

  /**
   * Obtiene el tiempo de expiración de JWT de acceso.
   * @returns {string} Tiempo de expiración (ej. '1h').
   */
  getJwtExpirationTime: () => envUtils.get("JWT_EXPIRATION_TIME", "1h"),

  /**
   * Obtiene el tiempo de expiración de JWT de refresco.
   * @returns {string} Tiempo de expiración (ej. '7d').
   */
  getRefreshTokenExpirationTime: () =>
    envUtils.get("REFRESH_TOKEN_EXPIRATION_TIME", "7d"),

  /**
   * Obtiene el tiempo de inactividad de sesión en minutos.
   * @returns {number} Tiempo en minutos.
   */
  getSessionTimeoutMinutes: () =>
    parseInt(envUtils.get("SESSION_TIMEOUT_MINUTES", "30"), 10),

  /**
   * Obtiene el límite de intentos de login fallidos.
   * @returns {number} Límite de intentos.
   */
  getLoginAttemptsLimit: () =>
    parseInt(envUtils.get("LOGIN_ATTEMPTS_LIMIT", "5"), 10),

  /**
   * Obtiene la duración del bloqueo de cuenta en minutos.
   * @returns {number} Duración en minutos.
   */
  getLockoutDurationMinutes: () =>
    parseInt(envUtils.get("LOCKOUT_DURATION_MINUTES", "30"), 10),

  /**
   * Obtiene el límite de solicitudes para throttling general.
   * @returns {number} Límite de solicitudes.
   */
  getThrottlingRateLimit: () =>
    parseInt(envUtils.get("THROTTLING_RATE_LIMIT", "100"), 10),

  /**
   * Obtiene la ventana de tiempo para throttling general en milisegundos.
   * @returns {number} Ventana de tiempo en ms.
   */
  getThrottlingWindowMs: () =>
    parseInt(envUtils.get("THROTTLING_WINDOW_MS", "60000"), 10),

  /**
   * Obtiene la URL para reportes de violaciones de CSP.
   * @returns {string} URL del reporte CSP.
   */
  getCspReportUri: () => envUtils.get("CSP_REPORT_URI", ""),

  /**
   * Obtiene el formato de los logs.
   * @returns {string} Formato de log (ej. 'json', 'text').
   */
  getLogFormat: () => envUtils.get("LOG_FORMAT", "text"),

  /**
   * Obtiene el SHA del commit de Git.
   * @returns {string} SHA del commit.
   */
  getGitCommitSha: () => envUtils.get("GIT_COMMIT_SHA", "unknown"),

  /**
   * Obtiene la rama de Git.
   * @returns {string} Rama de Git.
   */
  getGitBranch: () => envUtils.get("GIT_BRANCH", "unknown"),

  /**
   * Obtiene la fecha de despliegue.
   * @returns {string} Fecha de despliegue en formato ISO.
   */
  getDeploymentDate: () =>
    envUtils.get("DEPLOYMENT_DATE", new Date().toISOString()),

  /**
   * Obtiene la versión de la aplicación.
   * @returns {string} Versión de la aplicación.
   */
  getAppVersion: () => envUtils.get("VERSION", "1.0.0"),

  /**
   * Obtiene el nombre de la aplicación.
   * @returns {string} Nombre de la aplicación.
   */
  getAppName: () => envUtils.get("APP_NAME", "MiAplicacion"),

  /**
   * Obtiene el ID de la compilación.
   * @returns {string} ID de la compilación.
   */
  getBuildId: () => envUtils.get("BUILD_ID", "local-build"),
});

export { environments, envUtils }; // 🌍 Exportación modular
