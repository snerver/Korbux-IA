// Model/Product.js

/**
 * Crea un bloque visual de producto o entidad generada.
 * @param {Object} options - Parámetros del producto
 * @param {string} options.title - Título principal
 * @param {string} options.description - Descripción breve
 * @param {string} [options.image] - Ruta local de imagen
 * @param {Array<string>} [options.tags] - Etiquetas semánticas
 * @param {Function} [options.onSelect] - Acción al hacer clic
 * @returns {HTMLElement|null} Elemento visual del producto
 */
function createProduct({ title, description, image, tags = [], onSelect }) {
  if (!title || !description) return null;

  const timestamp = Date.now();
  const semanticId = `product-${timestamp}`;

  const card = document.createElement("div");
  card.className = "product-card";
  card.setAttribute("role", "article");
  card.setAttribute("aria-label", title);
  card.setAttribute("tabindex", "0");
  card.dataset.agent = "Product";
  card.dataset.timestamp = timestamp;
  card.dataset.semanticId = semanticId;

  // 🔳 Imagen local (opcional)
  if (image) {
    const imgWrapper = document.createElement("div");
    imgWrapper.className = "product-image";

    const img = document.createElement("img");
    img.src = image;
    img.alt = `Imagen de ${title}`;
    img.loading = "lazy";
    img.decoding = "async";
    img.draggable = false;
    img.setAttribute("aria-hidden", "false");

    imgWrapper.appendChild(img);
    card.appendChild(imgWrapper);
  }

  // 📝 Contenido textual
  const content = document.createElement("div");
  content.className = "product-content";

  const heading = document.createElement("h3");
  heading.className = "product-title";
  heading.textContent = title;
  heading.setAttribute("aria-level", "3");

  const desc = document.createElement("p");
  desc.className = "product-description";
  desc.textContent = description;

  content.appendChild(heading);
  content.appendChild(desc);

  // 🏷️ Etiquetas semánticas (opcional)
  if (Array.isArray(tags) && tags.length > 0) {
    const tagContainer = document.createElement("div");
    tagContainer.className = "product-tags";
    tagContainer.setAttribute("role", "list");

    tags.forEach((tag) => {
      const span = document.createElement("span");
      span.className = "tag";
      span.textContent = tag;
      span.setAttribute("role", "listitem");
      span.setAttribute("aria-label", `Etiqueta: ${tag}`);
      span.setAttribute("tabindex", "0");
      tagContainer.appendChild(span);
    });

    content.appendChild(tagContainer);
  }

  // 🧠 Registro local (opcional)
  const meta = document.createElement("div");
  meta.className = "product-meta";
  meta.setAttribute("aria-hidden", "true");
  meta.style.display = "none";
  meta.textContent = `ID: ${semanticId} | Timestamp: ${timestamp}`;
  content.appendChild(meta);

  // 🖱️ Botón de acción (opcional)
  if (typeof onSelect === "function") {
    const button = document.createElement("button");
    button.className = "product-button";
    button.textContent = "📦 Ver Detalles";
    button.setAttribute("aria-label", `Ver detalles de ${title}`);
    button.setAttribute("type", "button");
    button.setAttribute("tabindex", "0");

    button.onclick = () => {
      button.disabled = true;
      button.textContent = "⏳ Procesando...";
      try {
        onSelect({ id: semanticId, timestamp });
      } catch (e) {
        console.warn("Error en onSelect:", e);
      } finally {
        setTimeout(() => {
          button.disabled = false;
          button.textContent = "📦 Ver Detalles";
        }, 1000);
      }
    };

    content.appendChild(button);
  }

  card.appendChild(content);
  return card;
}
