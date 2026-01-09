// services/analyticsService.js

/**
 * @file Servicio para la gestión de analíticas de la aplicación.
 * @description Centraliza la lógica para enviar eventos y datos de uso a plataformas de analíticas
 * como Google Analytics, permitiendo una fácil configuración y extensión.
 */

const path = require("path");
const logger = require(path.join(__dirname, "..", "config", "logger.js")); // Importa tu logger
const config = require(path.join(__dirname, "..", "config")); // Importa tu configuración centralizada

/**
 * @typedef {'granted'|'denied'} ConsentStatus
 * @typedef {'analytics_storage'|'ad_storage'|'ad_user_data'|'ad_personalization'} ConsentType
 */

/**
 * @class AnalyticsService
 * @description Clase que proporciona métodos para enviar datos de analíticas a diferentes plataformas.
 * Maneja la inicialización, el envío de eventos, vistas de página y propiedades de usuario,
 * e incorpora gestión de consentimiento y resiliencia.
 */
class AnalyticsService {
  constructor() {
    /**
     * ID de seguimiento de Google Analytics (ej. 'G-XXXXXXXXXX' para GA4 o 'UA-XXXXXXXXX-Y' para Universal Analytics).
     * @type {string|null}
     */
    this.googleAnalyticsId = config.get("googleAnalytics.id") || null;

    /**
     * Indica si el servicio de telemetría/analíticas está habilitado globalmente.
     * @type {boolean}
     */
    this.isEnabled = config.get("analytics.enableTelemetry") === true; // Asegura que sea booleano

    /**
     * El entorno actual de la aplicación (ej. 'development', 'production').
     * @type {string}
     */
    this.environment = config.get("app.env") || "development";

    /**
     * Nombre de la aplicación, para contexto en los eventos.
     * @type {string}
     */
    this.appName = config.get("app.name") || "KorbuxApp";

    /**
     * Versión de la aplicación, para contexto en los eventos.
     * @type {string}
     */
    this.appVersion = config.get("app.version") || "1.0.0";

    /**
     * ID del usuario autenticado, si está disponible.
     * @type {string|null}
     */
    this.userId = null;

    /**
     * Estado actual del consentimiento del usuario para diferentes tipos de almacenamiento.
     * Por defecto, se asume 'denied' hasta que se cargue o establezca explícitamente.
     * @type {Object.<ConsentType, ConsentStatus>}
     */
    this.consentStates = {
      analytics_storage: "denied",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    };

    /**
     * Cola de eventos que no pudieron ser enviados inmediatamente (ej. gtag no disponible).
     * @private
     * @type {Array<{type: 'event'|'page_view'|'user_properties', name?: string, params?: object, properties?: object, path?: string, title?: string}>}
     */
    this._eventQueue = [];

    /**
     * Límite máximo para la cola de eventos pendientes.
     * @private
     * @type {number}
     */
    this._maxEventQueueSize = 50; // Para evitar el consumo excesivo de memoria.

    /**
     * Intervalo para reintentar el envío de eventos en cola.
     * @private
     * @type {NodeJS.Timeout|null}
     */
    this._retryInterval = null;

    // Inicializa el logging y carga el consentimiento al construir el servicio.
    this._initializeLogging();
    this.loadConsent();
    this._setupRetryMechanism();

    // Debounce para trackPageView para evitar llamadas excesivas en SPAs.
    this.debouncedTrackPageView = this._debounce(
      this._trackPageViewInternal.bind(this),
      500
    );
  }

  /**
   * Inicializa el logging específico para el servicio de analíticas.
   * Realiza advertencias si las configuraciones críticas no están presentes.
   * @private
   */
  _initializeLogging() {
    if (!this.isEnabled) {
      logger.info(
        "[AnalyticsService] El servicio de analíticas está deshabilitado por configuración."
      );
    } else {
      logger.info(
        `[AnalyticsService] Servicio de analíticas inicializado en entorno '${this.environment}'.`
      );
      if (!this.googleAnalyticsId && this.environment === "production") {
        logger.warn(
          " [AnalyticsService] GOOGLE_ANALYTICS_ID no está configurado en producción. Las analíticas no se enviarán a Google Analytics."
        );
      } else if (this.googleAnalyticsId) {
        logger.info(
          `[AnalyticsService] Google Analytics ID configurado: ${this.googleAnalyticsId}.`
        );
      }
    }
  }

  /**
   * Verifica si la función global `gtag` de Google Analytics está disponible en el entorno del navegador.
   * @private
   * @returns {boolean} True si `gtag` está disponible, false en caso contrario.
   */
  _isGtagAvailable() {
    return typeof window !== "undefined" && typeof window.gtag === "function";
  }

  /**
   * Genera un objeto con parámetros comunes que se adjuntarán a todos los eventos.
   * @private
   * @returns {object} Objeto con parámetros comunes como nombre de la app, versión, entorno y userId.
   */
  _getCommonEventParams() {
    const commonParams = {
      app_name: this.appName,
      app_version: this.appVersion,
      environment: this.environment,
      // Puedes añadir más parámetros comunes aquí, ej. user_language, device_type
    };
    if (this.userId) {
      commonParams.user_id = this.userId;
    }
    return commonParams;
  }

  /**
   * Añade un evento a la cola si `gtag` no está disponible.
   * @private
   * @param {object} eventData - Datos del evento a encolar.
   */
  _enqueueEvent(eventData) {
    if (this._eventQueue.length < this._maxEventQueueSize) {
      this._eventQueue.push(eventData);
      logger.debug(
        `[AnalyticsService] Evento encolado. Cola actual: ${this._eventQueue.length}`
      );
    } else {
      logger.warn(
        ` [AnalyticsService] Cola de eventos llena. Descartando evento:`,
        eventData
      );
    }
  }

  /**
   * Intenta enviar eventos de la cola.
   * @private
   */
  _processEventQueue() {
    if (!this._isGtagAvailable() || this._eventQueue.length === 0) {
      return;
    }

    logger.debug(
      `[AnalyticsService] Procesando cola de eventos (${this._eventQueue.length} eventos).`
    );
    const eventsToSend = [...this._eventQueue]; // Copia la cola para procesar.
    this._eventQueue = []; // Limpia la cola original.

    eventsToSend.forEach((eventData) => {
      try {
        if (eventData.type === "event") {
          window.gtag("event", eventData.name, eventData.params);
          logger.debug(
            `[AnalyticsService] Evento '${eventData.name}' enviado desde cola.`
          );
        } else if (eventData.type === "page_view") {
          window.gtag("event", "page_view", {
            page_path: eventData.path,
            page_title: eventData.title,
            send_to: this.googleAnalyticsId,
            ...eventData.params,
          });
          logger.debug(
            `[AnalyticsService] Vista de página '${eventData.path}' enviada desde cola.`
          );
        } else if (eventData.type === "user_properties") {
          window.gtag("set", "user_properties", eventData.properties);
          logger.debug(
            `[AnalyticsService] Propiedades de usuario enviadas desde cola.`
          );
        }
      } catch (error) {
        logger.error(
          ` [AnalyticsService] Error al reintentar enviar evento desde cola. Reencolando:`,
          eventData,
          error
        );
        // Si falla, lo volvemos a encolar (o lo descartamos si hay un límite de reintentos).
        this._enqueueEvent(eventData);
      }
    });
  }

  /**
   * Configura el mecanismo de reintento para eventos en cola.
   * @private
   */
  _setupRetryMechanism() {
    if (typeof window !== "undefined") {
      // Solo en el navegador.
      // Reintentar cada 5 segundos si hay eventos en cola.
      this._retryInterval = setInterval(() => {
        if (this._eventQueue.length > 0) {
          this._processEventQueue();
        }
      }, 5000);

      // También intentar procesar la cola cuando gtag esté listo (si ya está cargado).
      if (this._isGtagAvailable()) {
        this._processEventQueue();
      }
    }
  }

  /**
   * Implementa un patrón de debounce para limitar la frecuencia de ejecución de una función.
   * @private
   * @param {Function} func - La función a debounced.
   * @param {number} wait - El tiempo de espera en milisegundos.
   * @returns {Function} La función debounced.
   */
  _debounce(func, wait) {
    let timeout;
    return function (...args) {
      const context = this;
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(context, args), wait);
    };
  }

  /**
   * Carga el estado de consentimiento del usuario desde localStorage.
   * @public
   */
  loadConsent() {
    if (typeof localStorage === "undefined") {
      logger.warn(
        " [AnalyticsService] localStorage no disponible. No se puede cargar/guardar el consentimiento."
      );
      return;
    }
    try {
      const storedConsent = localStorage.getItem("analytics_consent_states");
      if (storedConsent) {
        this.consentStates = JSON.parse(storedConsent);
        logger.info(
          "[AnalyticsService] Consentimiento cargado desde localStorage:",
          this.consentStates
        );
      }
    } catch (error) {
      logger.error(
        " [AnalyticsService] Error al cargar el consentimiento desde localStorage:",
        error
      );
    }
    this._updateGtagConsent(); // Aplicar el consentimiento cargado a gtag.
  }

  /**
   * Guarda el estado de consentimiento del usuario en localStorage.
   * @private
   */
  _saveConsent() {
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(
        "analytics_consent_states",
        JSON.stringify(this.consentStates)
      );
      logger.debug(
        "[AnalyticsService] Consentimiento guardado en localStorage."
      );
    } catch (error) {
      logger.error(
        " [AnalyticsService] Error al guardar el consentimiento en localStorage:",
        error
      );
    }
  }

  /**
   * Actualiza el estado de consentimiento de Google Analytics (`gtag('consent')`).
   * @private
   */
  _updateGtagConsent() {
    if (this._isGtagAvailable()) {
      window.gtag("consent", "update", this.consentStates);
      logger.info(
        "[AnalyticsService] Comando gtag consent update enviado:",
        this.consentStates
      );
    } else {
      logger.warn(
        " [AnalyticsService] gtag no disponible para actualizar el consentimiento."
      );
    }
  }

  /**
   * Establece el estado de consentimiento para un tipo específico de almacenamiento.
   * Esto debería ser llamado por tu UI de consentimiento (ej. un banner de cookies).
   * @param {ConsentType} type - El tipo de almacenamiento (ej. 'analytics_storage').
   * @param {ConsentStatus} status - El estado del consentimiento ('granted' o 'denied').
   * @public
   */
  setConsentType(type, status) {
    if (this.consentStates.hasOwnProperty(type)) {
      this.consentStates = { ...this.consentStates, [type]: status };
      this._saveConsent();
      this._updateGtagConsent();
      logger.info(
        `[AnalyticsService] Consentimiento para '${type}' establecido a '${status}'.`
      );
    } else {
      logger.warn(
        ` [AnalyticsService] Tipo de consentimiento desconocido: '${type}'.`
      );
    }
  }

  /**
   * Establece el ID del usuario actual. Esto se adjuntará a todos los eventos futuros.
   * @param {string|null} userId - El ID único del usuario autenticado.
   * @public
   */
  setUserId(userId) {
    this.userId = userId;
    if (this.userId && this._isGtagAvailable()) {
      window.gtag("set", "user_id", this.userId);
      logger.debug(
        `[AnalyticsService] User ID establecido para gtag: ${this.userId}`
      );
    }
    this.setUserProperties({ user_id: userId }); // También establecer como user property.
  }

  /**
   * Envía un evento a Google Analytics (o lo simula en desarrollo).
   * Los eventos solo se envían si el servicio está habilitado y el consentimiento es apropiado.
   * @param {string} eventName - Nombre del evento (ej. 'login', 'chat_message_sent').
   * @param {object} [params={}] - Parámetros adicionales del evento.
   * @public
   */
  trackEvent(eventName, params = {}) {
    if (!this.isEnabled) {
      logger.debug(
        `[AnalyticsService] Evento '${eventName}' no enviado (servicio deshabilitado).`
      );
      return;
    }

    // En desarrollo, podemos permitir el seguimiento sin consentimiento explícito para depuración,
    // o si analytics_storage está granted.
    const canTrack =
      this.environment === "development" ||
      this.consentStates.analytics_storage === "granted";

    if (!canTrack) {
      logger.debug(
        `[AnalyticsService] Evento '${eventName}' no enviado (consentimiento de analíticas no dado).`
      );
      return;
    }

    const eventParams = { ...this._getCommonEventParams(), ...params };

    if (this.environment === "development") {
      logger.debug(
        `[AnalyticsService - DEV] Evento simulado: '${eventName}' con parámetros:`,
        eventParams
      );
      return;
    }

    if (this._isGtagAvailable()) {
      try {
        window.gtag("event", eventName, eventParams);
        logger.debug(
          `[AnalyticsService] Evento '${eventName}' enviado a Google Analytics.`,
          eventParams
        );
      } catch (error) {
        logger.error(
          ` [AnalyticsService] Error al enviar evento '${eventName}' a gtag:`,
          error
        );
        this._enqueueEvent({
          type: "event",
          name: eventName,
          params: eventParams,
        }); // Encolar para reintento.
      }
    } else {
      logger.warn(
        ` [AnalyticsService] 'gtag' no disponible para enviar evento '${eventName}'. Encolando...`
      );
      this._enqueueEvent({
        type: "event",
        name: eventName,
        params: eventParams,
      });
    }
  }

  /**
   * Función interna para el envío real de la vista de página, usada por el debounce.
   * @private
   * @param {string} pagePath - Ruta de la página.
   * @param {string} pageTitle - Título de la página.
   * @param {object} additionalParams - Parámetros adicionales.
   */
  _trackPageViewInternal(pagePath, pageTitle, additionalParams) {
    if (!this.isEnabled) {
      logger.debug(
        `[AnalyticsService] Vista de página '${pagePath}' no enviada (servicio deshabilitado).`
      );
      return;
    }

    const canTrack =
      this.environment === "development" ||
      this.consentStates.analytics_storage === "granted";

    if (!canTrack) {
      logger.debug(
        `[AnalyticsService] Vista de página '${pagePath}' no enviada (consentimiento de analíticas no dado).`
      );
      return;
    }

    const eventParams = {
      page_path: pagePath,
      page_title: pageTitle,
      send_to: this.googleAnalyticsId, // Asegura que se envía al ID correcto
      ...this._getCommonEventParams(),
      ...additionalParams,
    };

    if (this.environment === "development") {
      logger.debug(
        `[AnalyticsService - DEV] Vista de página simulada: '${pagePath}' - '${pageTitle}' con parámetros:`,
        eventParams
      );
      return;
    }

    if (this._isGtagAvailable()) {
      try {
        window.gtag("event", "page_view", eventParams);
        logger.debug(
          `[AnalyticsService] Vista de página '${pagePath}' enviada a Google Analytics.`
        );
      } catch (error) {
        logger.error(
          ` [AnalyticsService] Error al enviar vista de página '${pagePath}' a gtag:`,
          error
        );
        this._enqueueEvent({
          type: "page_view",
          path: pagePath,
          title: pageTitle,
          params: additionalParams,
        }); // Encolar para reintento.
      }
    } else {
      logger.warn(
        ` [AnalyticsService] 'gtag' no disponible para enviar vista de página '${pagePath}'. Encolando...`
      );
      this._enqueueEvent({
        type: "page_view",
        path: pagePath,
        title: pageTitle,
        params: additionalParams,
      });
    }
  }

  /**
   * Registra una vista de página en Google Analytics.
   * Utiliza un debounce para evitar llamadas excesivas en SPAs.
   * @param {string} pagePath - Ruta de la página (ej. '/home', '/chat').
   * @param {string} [pageTitle=''] - Título de la página.
   * @param {object} [additionalParams={}] - Parámetros adicionales específicos de la vista de página.
   * @public
   */
  trackPageView(pagePath, pageTitle = "", additionalParams = {}) {
    // Llama a la función debounced.
    this.debouncedTrackPageView(pagePath, pageTitle, additionalParams);
  }

  /**
   * Establece propiedades de usuario (user properties) para Google Analytics.
   * Estas propiedades se adjuntan a todos los eventos futuros del usuario.
   * Los datos solo se envían si el servicio está habilitado y el consentimiento es apropiado.
   * @param {object} properties - Objeto con las propiedades de usuario (ej. { user_type: 'premium', user_id: 'abc' }).
   * @public
   */
  setUserProperties(properties) {
    if (!this.isEnabled) {
      logger.debug(
        `[AnalyticsService] Propiedades de usuario no establecidas (servicio deshabilitado).`
      );
      return;
    }

    const canTrack =
      this.environment === "development" ||
      this.consentStates.analytics_storage === "granted";

    if (!canTrack) {
      logger.debug(
        `[AnalyticsService] Propiedades de usuario no establecidas (consentimiento de analíticas no dado).`
      );
      return;
    }

    const userProperties = { ...this._getCommonEventParams(), ...properties }; // Incluir info común aquí también.

    if (this.environment === "development") {
      logger.debug(
        `[AnalyticsService - DEV] Propiedades de usuario simuladas:`,
        userProperties
      );
      return;
    }

    if (this._isGtagAvailable()) {
      try {
        window.gtag("set", "user_properties", userProperties);
        logger.debug(
          `[AnalyticsService] Propiedades de usuario establecidas.`,
          userProperties
        );
      } catch (error) {
        logger.error(
          ` [AnalyticsService] Error al establecer propiedades de usuario con gtag:`,
          error
        );
        this._enqueueEvent({
          type: "user_properties",
          properties: userProperties,
        }); // Encolar para reintento.
      }
    } else {
      logger.warn(
        ` [AnalyticsService] 'gtag' no disponible para establecer propiedades de usuario. Encolando...`
      );
      this._enqueueEvent({
        type: "user_properties",
        properties: userProperties,
      });
    }
  }

  /**
   * Método para enviar datos a otros servicios de analíticas (ej. Mixpanel, Amplitude).
   * Los datos solo se envían si el servicio está habilitado y el consentimiento es apropiado.
   * @param {string} serviceName - Nombre del servicio (ej. 'mixpanel', 'amplitude').
   * @param {string} eventName - Nombre del evento.
   * @param {object} [data={}] - Datos del evento.
   * @public
   */
  trackToOtherService(serviceName, eventName, data = {}) {
    if (!this.isEnabled) {
      logger.debug(
        `[AnalyticsService] Evento '${eventName}' para '${serviceName}' no enviado (servicio deshabilitado).`
      );
      return;
    }

    // Para otros servicios, podrías tener un tipo de consentimiento diferente o usar analytics_storage.
    const canTrack =
      this.environment === "development" ||
      this.consentStates.analytics_storage === "granted";

    if (!canTrack) {
      logger.debug(
        `[AnalyticsService] Evento '${eventName}' para '${serviceName}' no enviado (consentimiento de analíticas no dado).`
      );
      return;
    }

    const fullData = { ...this._getCommonEventParams(), ...data };

    logger.info(
      `[AnalyticsService] Enviando evento a '${serviceName}': '${eventName}' con datos:`,
      fullData
    );
    // Aquí iría la lógica específica para cada servicio de analíticas.
    switch (serviceName) {
      case "mixpanel":
        if (
          typeof window !== "undefined" &&
          typeof window.mixpanel !== "undefined"
        ) {
          window.mixpanel.track(eventName, fullData);
          logger.debug(
            `[AnalyticsService] Evento Mixpanel '${eventName}' enviado.`,
            fullData
          );
        } else {
          logger.warn(
            ` [AnalyticsService] Mixpanel no disponible para enviar evento '${eventName}'.`
          );
        }
        break;
      case "amplitude":
        if (
          typeof window !== "undefined" &&
          typeof window.amplitude !== "undefined"
        ) {
          window.amplitude.getInstance().logEvent(eventName, fullData);
          logger.debug(
            `[AnalyticsService] Evento Amplitude '${eventName}' enviado.`,
            fullData
          );
        } else {
          logger.warn(
            ` [AnalyticsService] Amplitude no disponible para enviar evento '${eventName}'.`
          );
        }
        break;
      // Añade más casos para otros servicios de analíticas aquí.
      default:
        logger.warn(
          ` [AnalyticsService] Servicio de analíticas '${serviceName}' no reconocido o no disponible.`
        );
    }
  }

  /**
   * Detiene el mecanismo de reintento de eventos en cola.
   * Útil al cerrar la aplicación o si las analíticas se deshabilitan en tiempo de ejecución.
   * @public
   */
  stopRetryMechanism() {
    if (this._retryInterval) {
      clearInterval(this._retryInterval);
      this._retryInterval = null;
      logger.info(
        "[AnalyticsService] Mecanismo de reintento de eventos detenido."
      );
    }
  }
}

// Exporta una instancia única del servicio para usarla en toda la aplicación.
const analyticsServiceInstance = new AnalyticsService();

// Asegurarse de detener el mecanismo de reintento al cerrar la ventana/pestaña.
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    analyticsServiceInstance.stopRetryMechanism();
  });
}

module.exports = analyticsServiceInstance;
