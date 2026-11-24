/* ===== ChatApp dashboard: REST API for data + Socket.IO for real-time ===== */
(function () {
  "use strict";

  // ---------- Not logged in? Go to the login page ----------
  if (!App.getToken()) {
    location.replace("/login.html");
    return;
  }

  // ---------- State ----------
  let me = null;
  let socket = null;
  let conversations = []; // [{ id, user, lastMessage, unread, updatedAt }]
  const onlineMap = new Map(); // userId -> user (everyone currently online except me)
  let active = null; // the open chat: { id, user }
  let messages = []; // messages of the open chat (oldest first)
  let seen = new Set(); // message ids already on screen (prevents duplicates)
  let hasMore = false;
  let tab = "chats";
  let searchTerm = "";
  let searchResults = [];
  let searchTimer = null;
  let openSeq = 0; // protects against clicking quickly between chats
  let firstConnect = true;
  let pendingDeleteId = null;

  // ---------- Elements ----------
  const $ = (id) => document.getElementById(id);
  const el = {
    app: $("app"), list: $("list"), tabs: $("tabs"), searchInput: $("searchInput"),
    activeCount: $("activeCount"), onlineCount: $("onlineCount"), unreadBadge: $("unreadBadge"),
    meAvatar: $("meAvatar"), meName: $("meName"), meUser: $("meUser"),
    emptyState: $("emptyState"), chatInner: $("chatInner"), serverNote: $("serverNote"),
    headAvatar: $("headAvatar"), headName: $("headName"), headStatus: $("headStatus"),
    messages: $("messages"), composer: $("composer"), input: $("messageInput"),
    connBanner: $("connBanner"),
  };

  // ---------- Tiny helper to build elements safely (uses textContent, never innerHTML) ----------
  function h(tag, attrs, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === false || v == null) continue;
      if (k === "class") node.className = v;
      else node.setAttribute(k, v);
    }
    for (const c of children) {
      if (c == null || c === false) continue;
      node.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return node;
  }

  // ---------- Time formatting ----------
  const sameDay = (a, b) => a.toDateString() === b.toDateString();
  const clock = (d) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  function dayLabel(d) {
    const now = new Date();
    const y = new Date(); y.setDate(now.getDate() - 1);
    if (sameDay(d, now)) return "Today";
    if (sameDay(d, y)) return "Yesterday";
    return d.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  }
  function listTime(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    const now = new Date();
    const y = new Date(); y.setDate(now.getDate() - 1);
    if (sameDay(d, now)) return clock(d);
    if (sameDay(d, y)) return "Yesterday";
    return d.toLocaleDateString([], { day: "numeric", month: "short" });
  }
  function statusText(u) {
    if (u.isOnline) return "Online";
    if (!u.lastSeen) return "Offline";
    const d = new Date(u.lastSeen);
    const now = new Date();
    const y = new Date(); y.setDate(now.getDate() - 1);
    if (sameDay(d, now)) return "Last seen today at " + clock(d);
    if (sameDay(d, y)) return "Last seen yesterday at " + clock(d);
    return "Last seen " + d.toLocaleDateString([], { day: "numeric", month: "short" });
  }

  // ======================================================================
  //  SIDEBAR RENDERING
  // ======================================================================
  function renderMe() {
    el.meAvatar.replaceChildren(App.avatar(me, { size: "" }));
    el.meName.textContent = me.fullName;
    el.meUser.textContent = "@" + me.username;
  }

  function previewText(c) {
    if (!c.lastMessage) return "No messages yet";
    return (c.lastMessage.sender === me.id ? "You: " : "") + c.lastMessage.text;
  }

  function userItem(u, onClick, subtitle) {
    const btn = h("button", { class: "item" + (active && active.user.id === u.id ? " active" : ""), type: "button" },
      App.avatar(u, { showDot: true }),
      h("div", { class: "item-main" },
        h("div", { class: "item-row" }, h("span", { class: "item-name" }, u.fullName)),
        h("div", { class: "item-sub" }, h("span", { class: "item-preview" }, subtitle))
      )
    );
    btn.addEventListener("click", onClick);
    return btn;
  }

  function convItem(c) {
    const isActive = active && active.id === c.id;
    const btn = h("button", { class: "item" + (isActive ? " active" : "") + (c.unread ? " has-unread" : ""), type: "button" },
      App.avatar(c.user, { showDot: true }),
      h("div", { class: "item-main" },
        h("div", { class: "item-row" },
          h("span", { class: "item-name" }, c.user.fullName),
          h("span", { class: "item-time" + (c.unread ? " unread" : "") }, listTime(c.updatedAt))
        ),
        h("div", { class: "item-sub" },
          h("span", { class: "item-preview" }, previewText(c)),
          c.unread ? h("span", { class: "badge" }, c.unread > 99 ? "99+" : c.unread) : null
        )
      )
    );
    btn.addEventListener("click", () => openChat(c.user, c.id));
    return btn;
  }

  function renderList() {
    const totalUnread = conversations.reduce((n, c) => n + c.unread, 0);
    el.unreadBadge.textContent = totalUnread;
    el.unreadBadge.classList.toggle("hidden", totalUnread === 0);
    el.onlineCount.textContent = onlineMap.size;
    document.title = (totalUnread ? "(" + totalUnread + ") " : "") + "ChatApp";

    const frag = document.createDocumentFragment();

    if (searchTerm) {
      frag.append(h("div", { class: "list-title" }, "Search results"));
      if (!searchResults.length) {
        frag.append(h("div", { class: "list-empty" }, 'No users found for "' + searchTerm + '".'));
      }
      searchResults.forEach((u) => {
        const live = onlineMap.get(u.id) || u;
        frag.append(userItem(live, () => startFromUser(live), "@" + live.username + " · " + statusText(live)));
      });
    } else if (tab === "chats") {
      if (!conversations.length) {
        frag.append(h("div", { class: "list-empty" }, "No conversations yet.", h("br"), "Search for a user above to say hello!"));
      }
      conversations.forEach((c) => frag.append(convItem(c)));
    } else {
      const users = [...onlineMap.values()].sort((a, b) => a.fullName.localeCompare(b.fullName));
      if (!users.length) {
        frag.append(h("div", { class: "list-empty" }, "Nobody else is online right now."));
      }
      users.forEach((u) => frag.append(userItem(u, () => startFromUser(u), "@" + u.username)));
    }
    el.list.replaceChildren(frag);
  }

  function sortConversations() {
    conversations.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
  }

  // ======================================================================
  //  DATA LOADING
  // ======================================================================
  async function loadConversations() {
    const data = await App.api("/api/conversations");
    conversations = data.conversations;
    sortConversations();
    renderList();
  }

  async function loadOnlineUsers() {
    const data = await App.api("/api/users/online");
    onlineMap.clear();
    data.users.forEach((u) => onlineMap.set(u.id, u));
    renderList();
  }

  // Someone came online / went offline: update every place that shows them
  function applyPresence(user) {
    if (user.id === me.id) return;
    if (user.isOnline) onlineMap.set(user.id, user);
    else onlineMap.delete(user.id);
    conversations.forEach((c) => { if (c.user.id === user.id) c.user = Object.assign({}, c.user, user); });
    searchResults = searchResults.map((u) => (u.id === user.id ? Object.assign({}, u, user) : u));
    if (active && active.user.id === user.id) {
      active.user = Object.assign({}, active.user, user);
      renderHeader();
    }
    renderList();
  }

  // ======================================================================
  //  OPENING A CHAT
  // ======================================================================
  async function startFromUser(user) {
    await openChat(user, null);
  }

  async function openChat(user, convId) {
    const seq = ++openSeq;
    try {
      if (!convId) {
        const existing = conversations.find((c) => c.user.id === user.id);
        if (existing) convId = existing.id;
        else {
          const data = await App.api("/api/conversations", { method: "POST", body: { userId: user.id } });
          convId = data.conversation.id;
          user = data.conversation.user;
        }
      }
      if (seq !== openSeq) return;

      const live = onlineMap.get(user.id);
      active = { id: convId, user: live ? Object.assign({}, user, live) : user };
      messages = [];
      seen = new Set();
      hasMore = false;

      el.emptyState.classList.add("hidden");
      el.chatInner.classList.remove("hidden");
      el.app.classList.add("show-chat");
      renderHeader();
      el.messages.replaceChildren(h("div", { class: "no-msgs" }, "Loading messages…"));
      renderList();

      const data = await App.api("/api/conversations/" + convId + "/messages?limit=40");
      if (seq !== openSeq) return;
      messages = data.messages;
      hasMore = data.hasMore;
      messages.forEach((m) => seen.add(m.id));
      renderMessages();
      scrollToBottom();
      el.input.focus();
      await markActiveRead();
    } catch (err) {
      if (seq !== openSeq) return;
      App.toast(err.message, "error");
    }
  }

  function closeChat() {
    openSeq++;
    active = null;
    messages = [];
    seen = new Set();
    el.chatInner.classList.add("hidden");
    el.emptyState.classList.remove("hidden");
    el.app.classList.remove("show-chat");
    renderList();
  }

  function renderHeader() {
    if (!active) return;
    el.headAvatar.replaceChildren(App.avatar(active.user, { size: "sm", showDot: true }));
    el.headName.textContent = active.user.fullName;
    el.headStatus.textContent = statusText(active.user);
    el.headStatus.classList.toggle("on", !!active.user.isOnline);
  }

  async function markActiveRead() {
    if (!active || document.hidden) return;
    const conv = conversations.find((c) => c.id === active.id);
    const hasUnreadFromThem = (conv && conv.unread > 0) || messages.some((m) => m.sender !== me.id && !m.read);
    if (!hasUnreadFromThem) return;
    const id = active.id;
    try {
      await App.api("/api/conversations/" + id + "/read", { method: "POST" });
      messages.forEach((m) => { if (m.sender !== me.id) m.read = true; });
      if (conv) conv.unread = 0;
      renderList();
    } catch (e) { /* not critical: will retry next time */ }
  }

  // ======================================================================
  //  MESSAGES
  // ======================================================================
  function ticks(read) {
    const t = h("span", { class: "ticks" + (read ? " read" : ""), title: read ? "Read" : "Sent" });
    t.append(App.icon(read ? "checks" : "check"));
    return t;
  }

  function messageNode(m) {
    const mine = m.sender === me.id;
    const meta = h("div", { class: "meta" }, h("span", {}, clock(new Date(m.createdAt))));
    if (mine) meta.append(ticks(m.read));
    return h("div", { class: "msg-row " + (mine ? "me" : "them"), "data-id": m.id },
      h("div", { class: "bubble" }, h("div", { class: "text" }, m.text), meta)
    );
  }

  function renderMessages() {
    const frag = document.createDocumentFragment();
    if (hasMore) {
      const more = h("button", { class: "load-more", type: "button" }, "Load earlier messages");
      more.addEventListener("click", loadOlder);
      frag.append(more);
    }
    if (!messages.length) {
      frag.append(h("div", { class: "no-msgs" }, "No messages yet.", h("br"), "Say hello to " + active.user.fullName + "!"));
    }
    let prev = null;
    messages.forEach((m) => {
      const d = new Date(m.createdAt);
      if (!prev || !sameDay(d, new Date(prev.createdAt))) frag.append(h("div", { class: "day" }, dayLabel(d)));
      frag.append(messageNode(m));
      prev = m;
    });
    el.messages.replaceChildren(frag);
  }

  function appendMessage(m) {
    if (seen.has(m.id)) return; // already shown: never show a message twice
    seen.add(m.id);

    const wasEmpty = messages.length === 0;
    const prev = messages[messages.length - 1];
    messages.push(m);

    if (wasEmpty) {
      renderMessages();
    } else {
      const d = new Date(m.createdAt);
      if (!sameDay(d, new Date(prev.createdAt))) el.messages.append(h("div", { class: "day" }, dayLabel(d)));
      el.messages.append(messageNode(m));
    }
    scrollToBottom();
  }

  async function loadOlder() {
    if (!active || !messages.length) return;
    const id = active.id;
    try {
      const data = await App.api("/api/conversations/" + id + "/messages?limit=40&before=" + encodeURIComponent(messages[0].createdAt));
      if (!active || active.id !== id) return;
      const oldHeight = el.messages.scrollHeight;
      const fresh = data.messages.filter((m) => !seen.has(m.id));
      fresh.forEach((m) => seen.add(m.id));
      messages = fresh.concat(messages);
      hasMore = data.hasMore;
      renderMessages();
      el.messages.scrollTop = el.messages.scrollHeight - oldHeight; // keep the view where it was
    } catch (err) {
      App.toast(err.message, "error");
    }
  }

  function scrollToBottom() {
    el.messages.scrollTop = el.messages.scrollHeight;
  }

  // Turn the ticks blue when the other person has read my messages
  function markMineAsRead() {
    messages.forEach((m) => { if (m.sender === me.id) m.read = true; });
    el.messages.querySelectorAll(".msg-row.me .ticks:not(.read)").forEach((t) => {
      t.classList.add("read");
      t.title = "Read";
      t.replaceChildren(App.icon("checks"));
    });
  }

  // ======================================================================
  //  SENDING (Socket.IO "msg" event with acknowledgement)
  // ======================================================================
  function sendMessage() {
    const text = el.input.value.trim();
    if (!text || !active) return;
    if (!socket || !socket.connected) {
      App.toast("You are offline. Reconnecting… try again in a moment.", "error");
      return;
    }

    const target = active;
    el.input.value = "";
    autosize();

    socket.timeout(8000).emit("msg", { to: target.user.id, text }, (err, res) => {
      if (err || !res || !res.ok) {
        App.toast((res && res.error) || "Message may not have been sent. Check your connection.", "error");
        if (!el.input.value) { el.input.value = text; autosize(); }
        return;
      }
      const m = res.message;
      let conv = conversations.find((c) => c.id === m.conversation);
      if (!conv) {
        conv = { id: m.conversation, user: target.user, lastMessage: m, unread: 0, updatedAt: m.createdAt };
        conversations.push(conv);
      } else {
        conv.lastMessage = m;
        conv.updatedAt = m.createdAt;
      }
      sortConversations();
      if (active && active.id === m.conversation) appendMessage(m);
      renderList();
    });
  }

  // A new message arrived from the server (from someone else, or from my other browser tab)
  async function onIncoming(m) {
    const mine = m.sender === me.id;
    let conv = conversations.find((c) => c.id === m.conversation);
    let fromServer = false;

    if (!conv) { // first message of a brand-new conversation
      try { await loadConversations(); } catch (e) { return; }
      conv = conversations.find((c) => c.id === m.conversation);
      fromServer = true;
    } else {
      conv.lastMessage = m;
      conv.updatedAt = m.createdAt;
    }

    const isActive = !!active && active.id === m.conversation;
    if (isActive) appendMessage(m);

    if (!mine) {
      if (isActive && !document.hidden) {
        if (conv) conv.unread = 0;
        markActiveRead();
      } else {
        if (conv && !fromServer) conv.unread++;
        if (!isActive) {
          const who = conv ? conv.user.fullName : "Someone";
          App.toast(who + ": " + (m.text.length > 60 ? m.text.slice(0, 60) + "…" : m.text), "info", 3500);
        }
      }
    }
    sortConversations();
    renderList();
  }

  // ======================================================================
  //  SOCKET.IO CONNECTION
  // ======================================================================
  function showBanner(text) {
    el.connBanner.replaceChildren(App.icon("wifiOff"), text);
    el.connBanner.classList.remove("hidden");
  }

  function connectSocket() {
    socket = io({ auth: { token: App.getToken() } });

    socket.on("connect", async () => {
      el.connBanner.classList.add("hidden");
      if (!firstConnect) {
        // We were disconnected for a while: reload anything we may have missed
        try {
          await Promise.all([loadConversations(), loadOnlineUsers()]);
          if (active) {
            const data = await App.api("/api/conversations/" + active.id + "/messages?limit=40");
            data.messages.forEach((m) => { if (!seen.has(m.id)) appendMessage(m); });
            markActiveRead();
          }
        } catch (e) { /* ignore */ }
      }
      firstConnect = false;
    });

    socket.on("connect_error", (err) => {
      if (err && err.message === "Authentication failed") {
        App.clearSession();
        location.replace("/login.html");
        return;
      }
      showBanner("Connection problem. Trying to reconnect…");
    });

    socket.on("disconnect", (reason) => {
      if (reason === "io client disconnect") return;
      showBanner("Disconnected. Trying to reconnect…");
    });

    // --- your original events ---
    socket.on("active", (count) => { el.activeCount.textContent = count; });
    socket.on("chat", (text) => {
      el.serverNote.textContent = text;
      el.serverNote.classList.remove("hidden");
    });
    socket.on("announce", (text) => App.toast("📢 " + text, "info", 7000));
    socket.on("join", ({ user }) => {
      applyPresence(user);
      App.toast(user.fullName + " is now online", "success", 3000);
    });
    socket.on("leave", ({ user }) => {
      applyPresence(user);
      App.toast(user.fullName + " went offline", "info", 3000);
    });
    socket.on("msg", onIncoming);
    socket.on("read", ({ conversationId }) => {
      if (active && active.id === conversationId) markMineAsRead();
    });
  }

  // ======================================================================
  //  SETTINGS, LOGOUT, DELETE
  // ======================================================================
  const settingsModal = $("settingsModal");
  const confirmModal = $("confirmModal");

  function openModal(m) { m.classList.remove("hidden"); }
  function closeModal(m) { m.classList.add("hidden"); }

  function setSettingsError(name, msg) {
    const f = $("sf-" + name);
    f.classList.toggle("invalid", !!msg);
    f.querySelector(".field-error").textContent = msg || "";
  }

  function openSettings() {
    $("settingsAvatar").replaceChildren(App.avatar(me, { size: "lg" }));
    $("setUsername").textContent = "@" + me.username;
    $("setEmail").textContent = me.email || "";
    $("setFullName").value = me.fullName;
    $("setPicture").value = me.profilePicture || "";
    setSettingsError("fullName", "");
    setSettingsError("profilePicture", "");
    openModal(settingsModal);
    $("setFullName").focus();
  }

  $("settingsForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("saveProfileBtn");
    btn.disabled = true;
    setSettingsError("fullName", "");
    setSettingsError("profilePicture", "");
    try {
      const data = await App.api("/api/users/me", {
        method: "PATCH",
        body: { fullName: $("setFullName").value, profilePicture: $("setPicture").value },
      });
      me = data.user;
      renderMe();
      closeModal(settingsModal);
      App.toast("Profile updated", "success", 2500);
    } catch (err) {
      Object.entries(err.errors || {}).forEach(([f, m]) => setSettingsError(f, m));
      if (!err.errors || !Object.keys(err.errors).length) App.toast(err.message, "error");
    } finally {
      btn.disabled = false;
    }
  });

  function logout() {
    if (socket) socket.disconnect();
    App.clearSession();
    location.href = "/login.html";
  }

  function askDelete() {
    if (!active) return;
    pendingDeleteId = active.id;
    $("confirmText").textContent =
      "This removes your chat history with " + active.user.fullName + " from your account. " +
      (active.user.fullName.split(" ")[0]) + " keeps their own copy. This cannot be undone.";
    openModal(confirmModal);
  }

  $("confirmDeleteBtn").addEventListener("click", async () => {
    const id = pendingDeleteId;
    if (!id) return;
    const btn = $("confirmDeleteBtn");
    btn.disabled = true;
    try {
      await App.api("/api/conversations/" + id, { method: "DELETE" });
      conversations = conversations.filter((c) => c.id !== id);
      closeModal(confirmModal);
      if (active && active.id === id) closeChat();
      renderList();
      App.toast("Conversation deleted", "success", 2500);
    } catch (err) {
      App.toast(err.message, "error");
    } finally {
      btn.disabled = false;
      pendingDeleteId = null;
    }
  });

  // ======================================================================
  //  EVENT WIRING
  // ======================================================================
  function autosize() {
    el.input.style.height = "auto";
    el.input.style.height = Math.min(el.input.scrollHeight, 140) + "px";
  }

  el.composer.addEventListener("submit", (e) => { e.preventDefault(); sendMessage(); });
  el.input.addEventListener("input", autosize);
  el.input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      sendMessage();
    }
  });

  el.tabs.addEventListener("click", (e) => {
    const btn = e.target.closest(".tab");
    if (!btn) return;
    tab = btn.dataset.tab;
    el.tabs.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t === btn));
    el.searchInput.value = "";
    searchTerm = "";
    searchResults = [];
    renderList();
  });

  el.searchInput.addEventListener("input", () => {
    clearTimeout(searchTimer);
    const q = el.searchInput.value.trim();
    if (!q) {
      searchTerm = "";
      searchResults = [];
      renderList();
      return;
    }
    searchTimer = setTimeout(async () => {
      try {
        const data = await App.api("/api/users?search=" + encodeURIComponent(q));
        if (el.searchInput.value.trim() !== q) return; // the user kept typing
        searchTerm = q;
        searchResults = data.users;
        renderList();
      } catch (err) {
        App.toast(err.message, "error");
      }
    }, 300);
  });

  $("openSettings").addEventListener("click", openSettings);
  $("settingsBtn").addEventListener("click", openSettings);
  $("logoutBtn").addEventListener("click", logout);
  $("deleteConvBtn").addEventListener("click", askDelete);
  $("backBtn").addEventListener("click", closeChat);

  document.querySelectorAll(".modal-backdrop").forEach((m) => {
    m.addEventListener("click", (e) => {
      if (e.target === m || e.target.closest("[data-close]")) closeModal(m);
    });
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") document.querySelectorAll(".modal-backdrop").forEach(closeModal);
  });

  // When you come back to this tab, mark the open chat as read
  document.addEventListener("visibilitychange", () => { if (!document.hidden) markActiveRead(); });
  window.addEventListener("focus", markActiveRead);

  // ======================================================================
  //  START
  // ======================================================================
  App.hydrateIcons();

  (async function init() {
    try {
      const data = await App.api("/api/auth/me");
      me = data.user;
    } catch (err) {
      if (err.status === 401) {
        App.clearSession();
        location.replace("/login.html");
      } else {
        App.toast(err.message, "error", 10000);
      }
      return;
    }
    renderMe();
    connectSocket();
    try {
      await Promise.all([loadConversations(), loadOnlineUsers()]);
    } catch (err) {
      App.toast(err.message, "error");
    }
  })();
})();
