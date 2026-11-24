(function () {
  // Already logged in? Go straight to the chat.
  if (App.getToken()) {
    App.api("/api/auth/me").then(() => (location.href = "/chat.html")).catch(() => App.clearSession());
  }

  App.hydrateIcons();
  App.setupPasswordToggles();

  const form = document.getElementById("loginForm");
  const alertBox = document.getElementById("formAlert");
  const btn = document.getElementById("submitBtn");

  function setFieldError(name, msg) {
    const field = document.getElementById("f-" + name);
    field.classList.toggle("invalid", !!msg);
    field.querySelector(".field-error").textContent = msg || "";
  }
  function showAlert(msg, type) {
    alertBox.textContent = msg;
    alertBox.className = "form-alert show " + type;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const identifier = document.getElementById("identifier").value.trim();
    const password = document.getElementById("password").value;
    const remember = document.getElementById("remember").checked;

    setFieldError("identifier", identifier ? "" : "Enter your email or username.");
    setFieldError("password", password ? "" : "Enter your password.");
    if (!identifier || !password) return;

    btn.disabled = true;
    btn.replaceChildren(Object.assign(document.createElement("span"), { className: "spinner" }), "Logging in…");
    alertBox.className = "form-alert";

    try {
      const data = await App.api("/api/auth/login", { method: "POST", body: { identifier, password, remember } });
      App.setSession(data.token, remember);
      showAlert(data.message + " Redirecting…", "success");
      setTimeout(() => (location.href = "/chat.html"), 500);
    } catch (err) {
      showAlert(err.message, "error");
      btn.disabled = false;
      btn.textContent = "Log in";
    }
  });
})();
