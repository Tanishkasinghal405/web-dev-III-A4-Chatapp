// ChatApp server: Express (REST API + static pages) + Socket.IO (real time) + MongoDB (storage)
require("dotenv").config();
require("dns").setServers(["8.8.8.8", "1.1.1.1"]);

const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const connectDB = require("./config/db");
const User = require("./models/User");
const initSocket = require("./socket");
const { notFound, errorHandler } = require("./middleware/errorHandler");

// ---- Check the .env file first, so beginners get a clear message ----
const missing = ["MONGODB_URI", "JWT_SECRET"].filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`\nMissing in your .env file: ${missing.join(", ")}`);
  console.error("Copy .env.example to .env and fill it in. See README.md for step-by-step help.\n");
  process.exit(1);
}
if (process.env.JWT_SECRET.length < 16 || process.env.JWT_SECRET.startsWith("replace_me")) {
  console.error("\nJWT_SECRET in your .env file is too weak. Generate a long random one (see README.md).\n");
  process.exit(1);
}

const app = express();
const httpserver = http.createServer(app);
const io = new Server(httpserver);

app.set("io", io); // lets controllers send real-time events
app.disable("x-powered-by");

// Basic security headers
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "same-origin");
  next();
});

app.use(express.json({ limit: "10kb" }));

// ---- REST API ----
app.use("/api/auth", require("./routes/auth"));
app.use("/api/users", require("./routes/users"));
app.use("/api/conversations", require("./routes/conversations"));
app.use("/api", notFound);

// ---- Frontend (HTML, CSS, JS) ----
app.use(express.static(path.join(__dirname, "public")));
app.get("/", (req, res) => res.redirect("/chat.html"));

app.use(errorHandler);

// ---- Real time ----
initSocket(io);

const PORT = process.env.PORT || 8080;

async function start() {
  try {
    await connectDB();
    // If the server crashed earlier, nobody can really be online now
    await User.updateMany({ isOnline: true }, { isOnline: false });
  } catch (err) {
    console.error("\nCould not connect to MongoDB:", err.message);
    console.error("Check MONGODB_URI in .env, your database password, and that your IP is allowed in Atlas > Network Access.\n");
    process.exit(1);
  }

  httpserver.listen(PORT, () => {
    console.log(`Server started: http://localhost:${PORT}`);
  });
}

start();
