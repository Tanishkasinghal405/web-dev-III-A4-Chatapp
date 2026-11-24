(function () {
  if (App.getToken()) {
    App.api("/api/auth/me").then(() => (location.href = "/chat.html")).catch(() => App.clearSession());
  }

  App.hydrateIcons();
  App.setupPasswordToggles();

  const form = document.getElementById("registerForm");
  const alertBox = document.getElementById("formAlert");
  const btn = document.getElementById("submitBtn");
  const FIELDS = ["fullName", "username", "email", "password", "confirmPassword"];
  const val = (id) => document.getElementById(id).value;

  function setFieldError(name, msg) {
    const field = document.getElementById("f-" + name);
    field.classList.toggle("invalid", !!msg);
    field.querySelector(".field-error").textContent = msg || "";
  }
  function showAlert(msg, type) {
    alertBox.textContent = msg;
    alertBox.className = "form-alert show " + type;
  }

  // Same rules as the server (the server re-checks everything, this just gives instant feedback)
  function validate() {
    const errors = {};
    const fullName = val("fullName").trim();
    const username = val("username").trim().toLowerCase();
    const email = val("email").trim();
    const password = val("password");

    if (fullName.length < 2) errors.fullName = "Full name must be at least 2 characters.";
    if (!/^[a-z0-9_]{3,20}$/.test(username)) errors.username = "3-20 characters: lowercase letters, numbers or underscore.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errors.email = "Enter a valid email address.";
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password))
      errors.password = "At least 8 characters with a letter and a number.";
    if (val("confirmPassword") !== password) errors.confirmPassword = "Passwords do not match.";
    return errors;
  }

  // Clear a field's error as soon as the user edits it
  FIELDS.forEach((f) => document.getElementById(f).addEventListener("input", () => setFieldError(f, "")));

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    alertBox.className = "form-alert";

    const errors = validate();
    FIELDS.forEach((f) => setFieldError(f, errors[f]));
    if (Object.keys(errors).length) return;

    btn.disabled = true;
    btn.replaceChildren(Object.assign(document.createElement("span"), { className: "spinner" }), "Creating account…");

    try {
      const data = await App.api("/api/auth/register", {
        method: "POST",
        body: {
          fullName: val("fullName"),
          username: val("username"),
          email: val("email"),
          password: val("password"),
          confirmPassword: val("confirmPassword"),
        },
      });
      App.setSession(data.token, false);
      showAlert(data.message + " Redirecting to your chats…", "success");
      setTimeout(() => (location.href = "/chat.html"), 800);
    } catch (err) {
      // Show messages from the server next to the right fields (e.g. "username already taken")
      Object.entries(err.errors || {}).forEach(([f, m]) => setFieldError(f, m));
      showAlert(err.message, "error");
      btn.disabled = false;
      btn.textContent = "Create account";
    }
  });
})();
