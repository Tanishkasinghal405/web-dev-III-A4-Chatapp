// A tiny in-memory rate limiter (no extra package needed).
// Stops people from guessing passwords by trying thousands of times.
function rateLimit({ windowMs, max, message }) {
  const hits = new Map(); // ip -> { count, resetAt }

  setInterval(() => {
    const now = Date.now();
    for (const [ip, h] of hits) if (h.resetAt <= now) hits.delete(ip);
  }, windowMs).unref();

  return (req, res, next) => {
    const now = Date.now();
    const ip = req.ip;
    let h = hits.get(ip);
    if (!h || h.resetAt <= now) {
      h = { count: 0, resetAt: now + windowMs };
      hits.set(ip, h);
    }
    h.count++;
    if (h.count > max) {
      return res.status(429).json({ message });
    }
    next();
  };
}

module.exports = rateLimit;
