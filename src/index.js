/**
 * MonieEstate Backend
 * Monnify Offline Pay-in Integration
 *
 * Startup: node src/index.js
 */

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const { initializeSheets } = require("./services/db");

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// ── Routes ────────────────────────────────────────────────────
// Monnify offline payment endpoints (called by Monnify)
app.use("/monnify", require("./routes/monnify"));

// Internal management API
app.use("/api", require("./routes/api"));

// Root
app.get("/", (req, res) => {
  res.json({
    name: "MonieEstate Power Payment System",
    version: "1.0.0",
    description: "Monnify Offline Pay-in integration for MonieEstate housing estate",
    docs: "/api/health",
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.path} not found` });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("💥 Unhandled error:", err);
  res.status(500).json({ success: false, message: "Internal server error" });
});

// ── Boot ──────────────────────────────────────────────────────
async function boot() {
  try {
    console.log("🏘️  MonieEstate Backend starting...\n");

    console.log("📂 Initializing local file DB...");
    await initializeSheets();

    app.listen(PORT, () => {
      console.log(`\n🚀 Server running on http://localhost:${PORT}`);
      console.log(`\n📡 Monnify Offline Pay-in Endpoints:`);
      console.log(`   POST http://localhost:${PORT}/monnify/verify-payer`);
      console.log(`   POST http://localhost:${PORT}/monnify/payment-request`);
      console.log(`   GET  http://localhost:${PORT}/monnify/payment-requery?transactionReference=`);
      console.log(`\n🔧 Internal API:`);
      console.log(`   GET  http://localhost:${PORT}/api/plans`);
      console.log(`   GET  http://localhost:${PORT}/api/residents/:houseNumber`);
      console.log(`   GET  http://localhost:${PORT}/api/health`);
      console.log(`\n💡 Tip: Use ngrok to expose this server publicly for Monnify to call`);
      console.log(`   ngrok http ${PORT}\n`);
    });
  } catch (err) {
    console.error("❌ Failed to start server:", err.message);
    console.error("\n📝 Check your .env file and that the data/ directory is writable.");
    process.exit(1);
  }
}

boot();
