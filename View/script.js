document.addEventListener("DOMContentLoaded", () => {
  const MAX_CHARS = 100_000_000;

  const textos = {
    es: {
      welcome: "Hola. Soy Korbux, asistente IA 100% offline.\n¿En qué te ayudo hoy?",
      responses: ["Entendido", "Perfecto", "Buena pregunta", "Claro", "Interesante", "Genial", "Listo"],
      newChat: "Nuevo Chat",
      typing: "Korbux está escribiendo...",
      empty: "No hay chats disponibles.",
      confirmDelete: "¿Seguro que quieres eliminar este chat?",
      tooLong: `El texto excede el límite de ${MAX_CHARS} caracteres.`,
      sent: "✓ enviado",
    },
    en: {
      welcome: "Hi. I'm Korbux, 100% offline AI.\nHow can I help you today?",
      responses: ["Got it", "Perfect", "Great question", "Sure", "Interesting", "Awesome", "Done"],
      newChat: "New Chat",
      typing: "Korbux is typing...",
      empty: "No chats available.",
      confirmDelete: "Are you sure you want to delete this chat?",
      tooLong: `Text exceeds the ${MAX_CHARS} characters limit.`,
      sent: "✓ sent",
    },
  };

  const state = {
    chats: [],
    currentChatId: null,
    nextId: 1,
    lang: "es",
    theme: "light",
    lastSent: 0,
  };

  const history = document.getElementById("history");
  const chatList = document.getElementById("chats");
  const input = document.getElementById("input");
  const newChatBtn = document.getElementById("new-chat");
  const sendBtn = document.getElementById("send-btn");
  const themeBtn = document.getElementById("theme");
  const downBtn = document.getElementById("down");
  const langBtn = document.getElementById("lang");

  if (!history || !chatList || !input) return;

  // --- Seguridad y robustez ---
  function sanitize(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  function limitSpam() {
    const now = Date.now();
    if (now - state.lastSent < 200) return false; // máximo 5 mensajes/segundo
    state.lastSent = now;
    return true;
  }

  function truncateHistory(chat) {
    if (chat.messages.length > 1000) {
      chat.messages = chat.messages.slice(-1000);
    }
  }

  function backupSession() {
    try {
      sessionStorage.setItem("korbux_backup", JSON.stringify(state));
    } catch {}
  }

  function safeStorageSet(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      backupSession();
    }
  }

  // --- Experiencia de usuario ---
  function showLangIndicator() {
    const indicator = document.getElementById("lang-indicator");
    if (indicator) indicator.textContent = state.lang.toUpperCase();
  }

  function showLastResponses() {
    const last = state.chats.find(c => c.id === state.currentChatId)?.messages.slice(-3) || [];
    console.log("Últimas respuestas:", last.filter(m => m.type === "b").map(m => m.text));
  }

  function editLastMessage() {
    const chat = state.chats.find(c => c.id === state.currentChatId);
    if (!chat) return;
    const last = chat.messages.findLast(m => m.type === "u");
    if (last) input.value = last.text;
  }

  function confirmSent(msgEl) {
    const span = document.createElement("span");
    span.className = "sent";
    span.textContent = textos[state.lang].sent;
    msgEl.appendChild(span);
  }

  function animateTyping(text, callback) {
    let i = 0;
    const msg = document.createElement("div");
    msg.className = "msg b fade-in";
    history.appendChild(msg);
    const interval = setInterval(() => {
      msg.textContent = "Korbux: " + text.slice(0, i);
      i++;
      if (i > text.length) {
        clearInterval(interval);
        callback?.();
      }
    }, 30);
  }

  // --- Accesibilidad ---
  function enableAccessibility() {
    history.setAttribute("aria-live", "polite");
    input.setAttribute("maxlength", String(MAX_CHARS));
    chatList.setAttribute("role", "list");
  }

  function toggleHighContrast() {
    document.documentElement.classList.toggle("high-contrast");
  }

  function navigateChats(direction) {
    const idx = state.chats.findIndex(c => c.id === state.currentChatId);
    if (idx < 0) return;
    const nextIdx = direction === "up" ? idx - 1 : idx + 1;
    if (state.chats[nextIdx]) switchChat(state.chats[nextIdx].id);
  }

  function addSoundNotification() {
    const audio = new Audio("notify.mp3");
    audio.play().catch(() => {});
  }

  // --- Escalabilidad ---
  function exportChats() {
    const data = JSON.stringify(state.chats, null, 2);
    console.log("Export:", data);
  }

  function importChats(json) {
    try {
      const parsed = JSON.parse(json);
      if (Array.isArray(parsed)) state.chats = parsed;
    } catch {}
  }

  function multiUser(profile) {
    safeStorageSet("korbux_profile_" + profile, JSON.stringify(state));
  }

  function syncIndexedDB() {
    // Placeholder: integración futura con IndexedDB
  }

  function registerPlugin(name, fn) {
    state[name] = fn;
  }

  // --- Funciones principales ---
  function renderChats() {
    chatList.innerHTML = "";
    state.chats.forEach((c) => {
      const li = document.createElement("li");
      li.textContent = c.titles[state.lang] || c.titles.es;
      li.dataset.id = String(c.id);
      if (c.id === state.currentChatId) li.classList.add("active");
      li.onclick = () => switchChat(c.id);
      chatList.appendChild(li);
    });
    showLangIndicator();
  }

  function switchChat(id) {
    const chat = state.chats.find((c) => c.id === id);
    if (!chat) return;
    state.currentChatId = id;
    history.innerHTML = "";
    if (chat.messages.length === 0) {
      const msg = document.createElement("div");
      msg.className = "msg b fade-in";
      msg.textContent = textos[state.lang].welcome;
      history.appendChild(msg);
    } else {
      chat.messages.forEach((m) => {
        const msg = document.createElement("div");
        msg.className = `msg ${m.type}`;
        msg.textContent = m.type === "u" ? m.text : "Korbux: " + m.text;
        history.appendChild(msg);
      });
    }
    truncateHistory(chat);
    renderChats();
    history.scrollTop = history.scrollHeight;
  }

  function newChat() {
    const id = state.nextId++;
    const nuevo = {
      id,
      titles: { es: `${textos.es.newChat} ${id}`, en: `${textos.en.newChat} ${id}` },
      messages: [],
    };
    state.chats.push(nuevo);
    switchChat(nuevo.id);
  }

  function sendMessage() {
    if (!limitSpam()) return;
    const txt = sanitize((input.value || "").trim());
    if (!txt) return;
    if (txt.length > MAX_CHARS) {
      alert(textos[state.lang].tooLong);
      return;
    }
    const chat = state.chats.find((c) => c.id === state.currentChatId);
    if (!chat) return;
    const msg = document.createElement("div");
    msg.className = "msg u";
    msg.textContent = txt;
    history.appendChild(msg);
    confirmSent(msg);
    chat.messages.push({ type: "u", text: txt });
    setTimeout(() => {
      const resp = textos[state.lang].responses[Math.floor(Math.random() * textos[state.lang].responses.length)];
      animateTyping(resp, () => {
        chat.messages.push({ type: "b", text: resp });
        addSoundNotification();
      });
    }, 800);
    input.value = "";
  }

  function eliminarChat(id) {
    if (!confirm(textos[state.lang].confirmDelete)) return;
    state.chats = state.chats.filter(c => c.id !== id);
    if (state.chats.length > 0) {
      switchChat(state.chats[0].id);
    } else {
      history.innerHTML = `<p>${textos[state.lang].empty}</p>`;
    }
  }

  // --- Inicialización ---
  enableAccessibility();
  newChat();
  if (newChatBtn) newChatBtn.onclick = newChat;
  if (sendBtn) sendBtn.onclick = sendMessage;
  if (themeBtn) themeBtn.onclick = () => document
  if (themeBtn) {
    themeBtn.onclick = () => {
      document.documentElement.classList.toggle("dark");
      state.theme = document.documentElement.classList.contains("dark") ? "dark" : "light";
      const span = themeBtn.querySelector("span");
      if (span) span.textContent = state.theme === "dark" ? "Dark" : "System";
      safeStorageSet("korbux_theme", state.theme);
    };
  }

  if (langBtn) {
    langBtn.onclick = () => {
      state.lang = state.lang === "es" ? "en" : "es";
      renderChats();
      switchChat(state.currentChatId);
      safeStorageSet("korbux_lang", state.lang);
    };
  }

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
    if (e.ctrlKey && e.key.toLowerCase() === "e") {
      e.preventDefault();
      editLastMessage();
    }
  });

  input.addEventListener("input", function () {
    if (this.value.length > MAX_CHARS) {
      this.value = this.value.slice(0, MAX_CHARS);
    }
    this.style.height = "auto";
    const nextHeight = Math.min(this.scrollHeight, 220);
    this.style.height = nextHeight + "px";
  });

  history.addEventListener("scroll", () => {
    if (!downBtn) return;
    const show = history.scrollHeight - history.scrollTop > history.clientHeight + 500;
    downBtn.style.display = show ? "block" : "none";
  });

  if (downBtn) {
    downBtn.onclick = () => {
      history.scrollTop = history.scrollHeight;
    };
  }

  window.addEventListener("load", () => input.focus());

  // Atajos de teclado adicionales
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.key.toLowerCase() === "n") {
      e.preventDefault();
      newChatBtn?.click();
    }
    if (e.ctrlKey && e.key === "Enter") {
      e.preventDefault();
      sendMessage();
    }
    if (e.ctrlKey && e.key.toLowerCase() === "l") {
      e.preventDefault();
      langBtn?.click();
    }
    if (e.ctrlKey && e.key.toLowerCase() === "d") {
      e.preventDefault();
      themeBtn?.click();
    }
    if (e.ctrlKey && e.key.toLowerCase() === "ArrowUp") {
      e.preventDefault();
      navigateChats("up");
    }
    if (e.ctrlKey && e.key.toLowerCase() === "ArrowDown") {
      e.preventDefault();
      navigateChats("down");
    }
    if (e.ctrlKey && e.key.toLowerCase() === "x") {
      e.preventDefault();
      exportChats();
    }
    if (e.ctrlKey && e.key.toLowerCase() === "i") {
      e.preventDefault();
      showLastResponses();
    }
    if (e.ctrlKey && e.key.toLowerCase() === "h") {
      e.preventDefault();
      toggleHighContrast();
    }
  });

  // Inicialización
  newChat();
  renderChats();
  switchChat(state.currentChatId);
});
