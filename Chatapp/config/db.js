const mongoose = require("mongoose");

// Connects to MongoDB Atlas using the address stored in the .env file.
async function connectDB() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error(
      "MONGODB_URI is missing. Copy .env.example to .env and paste your MongoDB Atlas connection string (see README)."
    );
  }

  mongoose.set("strictQuery", true);

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  console.log(`MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);

  mongoose.connection.on("error", (err) => console.error("MongoDB error:", err.message));
  mongoose.connection.on("disconnected", () => console.warn("MongoDB disconnected"));
}

module.exports = connectDB;
