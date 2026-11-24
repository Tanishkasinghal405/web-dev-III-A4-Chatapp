// Runs when an API route throws an error. Express 5 sends async errors here automatically.
function notFound(req, res) {
  res.status(404).json({ message: "API route not found." });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ message: "Invalid JSON in request." });
  }
  if (err.type === "entity.too.large") {
    return res.status(413).json({ message: "Request is too large." });
  }
  console.error("Server error:", err);
  res.status(500).json({ message: "Something went wrong on the server. Please try again." });
}

module.exports = { notFound, errorHandler };
