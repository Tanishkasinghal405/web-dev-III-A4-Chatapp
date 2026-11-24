/* ===== Shared helpers used by every page: session storage, API calls, toasts, icons ===== */
(function () {
  const TOKEN_KEY = "chatapp_token";

  // "Remember me" -> localStorage (stays after closing the browser). Otherwise -> sessionStorage (cleared on close).
  function getToken() {
    try {
      return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
    } catch (e) {
      return null;
    }
  }
  function setSession(token, remember) {
    clearSession();
    try {
      (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, token);
    } catch (e) {
      /* storage blocked: user will simply need to log in again */
    }
  }
  function clearSession() {
    try {
      localStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(TOKEN_KEY);
    } catch (e) { /* ignore */ }
  }

  // Calls the backend. Throws an Error with .status and .errors (field messages) when something goes wrong.
  async function api(path, { method = "GET", body } = {}) {
    const headers = {};
    const token = getToken();
    if (token) headers.Authorization = "Bearer " + token;
    if (body !== undefined) headers["Content-Type"] = "application/json";

    let res;
    try {
      res = await fetch(path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
    } catch (e) {
      const err = new Error("Cannot reach the server. Check your connection and that the server is running.");
      err.status = 0;
      throw err;
    }

    let data = {};
    try { data = await res.json(); } catch (e) { /* empty body */ }

    if (!res.ok) {
      const err = new Error(data.message || "Something went wrong.");
      err.status = res.status;
      err.errors = data.errors || {};
      throw err;
    }
    return data;
  }

  // Small popup messages
  function toast(message, type = "info", ms = 4500) {
    let box = document.querySelector(".toasts");
    if (!box) {
      box = document.createElement("div");
      box.className = "toasts";
      document.body.appendChild(box);
    }
    const el = document.createElement("div");
    el.className = "toast " + type;
    el.textContent = message; // textContent (not innerHTML) so nobody can inject HTML
    box.appendChild(el);
    setTimeout(() => {
      el.classList.add("out");
      setTimeout(() => el.remove(), 320);
    }, ms);
  }

  // Inline SVG icons (feather-style)
  const P = {
    chat: '<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z"/>',
    user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    mail: '<path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><path d="M22 6l-10 7L2 6"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    at: '<circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.9 7.9"/>',
    eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
    eyeOff: '<path d="M17.9 17.9A10.1 10.1 0 0 1 12 20c-7 0-11-8-11-8a18.5 18.5 0 0 1 5.1-5.9M9.9 4.2A9.1 9.1 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.2 3.2M14.1 14.1a3 3 0 1 1-4.2-4.2"/><path d="M1 1l22 22"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/>',
    send: '<path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',
    trash: '<path d="M3 6h18"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
    back: '<path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/>',
    x: '<path d="M18 6L6 18M6 6l12 12"/>',
    users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
    check: '<path d="M20 6L9 17l-5-5"/>',
    checks: '<path d="M2 12l5 5L17 7"/><path d="M12 17l1 1L22 7"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>',
    wifiOff: '<path d="M1 1l22 22"/><path d="M16.7 11.1A11 11 0 0 1 21 13.6M5 12.9a11 11 0 0 1 5.2-2.7M10.7 5.1A16 16 0 0 1 22.6 9M1.4 9a16 16 0 0 1 4.7-2.9M8.5 16.1a6 6 0 0 1 6.9 0M12 20h.01"/>',
  };
  function icon(name) {
    const span = document.createElement("span");
    span.className = "icon";
    span.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      (P[name] || "") + "</svg>"; // P holds only our own fixed SVG strings
    return span;
  }
  // Replace every <i data-icon="name"> in the page with the real icon
  function hydrateIcons(root = document) {
    root.querySelectorAll("i[data-icon]").forEach((el) => {
      const ic = icon(el.dataset.icon);
      if (el.dataset.class) ic.className += " " + el.dataset.class;
      el.replaceWith(ic);
    });
  }

  // Show/hide password buttons: <button class="toggle-pass" data-target="inputId">
  function setupPasswordToggles() {
    document.querySelectorAll(".toggle-pass").forEach((btn) => {
      const input = document.getElementById(btn.dataset.target);
      const render = () => {
        btn.replaceChildren(icon(input.type === "password" ? "eye" : "eyeOff"));
        btn.setAttribute("aria-label", input.type === "password" ? "Show password" : "Hide password");
      };
      render();
      btn.addEventListener("click", () => {
        input.type = input.type === "password" ? "text" : "password";
        render();
      });
    });
  }

  // Avatar element: picture if the user has one, otherwise colored initials
  const PALETTE = [
    ["#8b5cf6", "#3b82f6"], ["#ec4899", "#8b5cf6"], ["#06b6d4", "#3b82f6"],
    ["#f59e0b", "#ec4899"], ["#10b981", "#06b6d4"], ["#6366f1", "#a855f7"],
  ];
  function avatar(user, { size = "", showDot = false } = {}) {
    const el = document.createElement("div");
    el.className = "avatar " + size;
    const seed = (user.username || "?").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    const [c1, c2] = PALETTE[seed % PALETTE.length];
    el.style.background = `linear-gradient(135deg, ${c1}, ${c2})`;

    const initials = (user.fullName || user.username || "?")
      .trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

    if (user.profilePicture) {
      const img = document.createElement("img");
      img.alt = "";
      img.referrerPolicy = "no-referrer";
      img.src = user.profilePicture;
      img.addEventListener("error", () => { img.remove(); el.prepend(document.createTextNode(initials)); });
      el.appendChild(img);
    } else {
      el.textContent = initials;
    }
    if (showDot) {
      const dot = document.createElement("span");
      dot.className = "dot" + (user.isOnline ? " on" : "");
      el.appendChild(dot);
    }
    return el;
  }

  window.App = { getToken, setSession, clearSession, api, toast, icon, hydrateIcons, setupPasswordToggles, avatar };
})();
