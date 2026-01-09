// Model/Token.js

let tokenRequestCounter = 0; // 🔢 Contador global por solicitud

/**
 * Crea un bloque visual para representar un token semántico.
 * Evita duplicados, limita a 10 por solicitud y minimiza la carga visual.
 * @param {Object} options - Parámetros del token
 * @param {string} options.label - Texto principal del token
 * @param {string} [options.type] - Tipo semántico (ej: 'acción', 'estado', 'valor')
 * @param {string} [options.color] - Color personalizado (opcional)
 * @param {Function} [options.onClick] - Acción al hacer clic
 * @param {HTMLElement} [container] - Contenedor donde se insertará el token (opcional)
 * @returns {HTMLElement|null} Elemento visual del token
 */
function createToken({
  label,
  type = "neutro",
  color = null,
  onClick,
  container = null,
}) {
  // 1. Validación estricta del label
  if (!label || typeof label !== "string" || label.trim() === "") return null;

  // 2. Normalización del label
  label = label.trim();

  // 3. Límite de 10 tokens por solicitud
  if (tokenRequestCounter >= 10) return null;
  tokenRequestCounter++;

  // 4. Evitar duplicados en el contenedor
  if (container && container.querySelector(`[data-label="${label}"]`))
    return null;

  // 5. Generación de ID semántico único
  const timestamp = Date.now();
  const semanticId = `token-${timestamp}`;

  // 6. Creación del elemento visual
  const token = document.createElement("span");
  token.className = "semantic-token";
  token.textContent = label;

  // 7. Accesibilidad
  token.setAttribute("role", "button");
  token.setAttribute("aria-label", `Token: ${label}`);
  token.setAttribute("tabindex", "0");

  // 8. Trazabilidad semántica
  token.dataset.type = type;
  token.dataset.semanticId = semanticId;
  token.dataset.timestamp = timestamp;
  token.dataset.label = label;

  // 9. Color personalizado
  if (color) {
    token.style.backgroundColor = color;
    token.style.color = "#fff";
  }

  // 10. Registro oculto para auditoría evolutiva
  const meta = document.createElement("span");
  meta.className = "token-meta";
  meta.textContent = `ID: ${semanticId} | Tipo: ${type} | Tiempo: ${timestamp}`;
  meta.setAttribute("aria-hidden", "true");
  meta.style.display = "none";
  token.appendChild(meta);

  // 11. Acción al hacer clic
  if (typeof onClick === "function") {
    token.onclick = () => {
      token.classList.add("token-active");
      try {
        onClick({ id: semanticId, label, type, timestamp });
      } catch (e) {
        console.warn("Error en token onClick:", e);
      } finally {
        setTimeout(() => {
          token.classList.remove("token-active");
        }, 800);
      }
    };
  }

  // 12. Prevención de doble clic rápido
  token.addEventListener("dblclick", (e) => e.preventDefault());

  // 13. Soporte para teclado (Enter activa el token)
  token.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && typeof onClick === "function") {
      token.click();
    }
  });

  // 14. Estilo visual adaptativo por tipo
  if (type === "acción") token.classList.add("token-action");
  if (type === "estado") token.classList.add("token-state");
  if (type === "valor") token.classList.add("token-value");

  // 15. Compatibilidad con modo oscuro
  token.dataset.theme = document.body.classList.contains("dark")
    ? "dark"
    : "light";

  // 16. Preparado para persistencia local
  token.dataset.persistible = "true";

  // 17. Preparado para exportación semántica
  token.dataset.exportable = "true";

  // 18. Preparado para auditoría visual
  token.dataset.auditable = "true";

  // 19. Preparado para agrupación por tipo
  token.dataset.group = `group-${type}`;

  // 20. Preparado para filtrado dinámico
  token.dataset.filterable = "true";

  // 21. Inserción opcional en contenedor
  if (container instanceof HTMLElement) {
    container.appendChild(token);
  }

  return token;
}

/**
 * Reinicia el contador de tokens por solicitud.
 * Debe llamarse antes de iniciar una nueva generación.
 */
function resetTokenCounter() {
  tokenRequestCounter = 0;
}
