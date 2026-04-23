/**
 * MonieEstate Internal API Routes
 * For your own frontend / dashboard / admin use
 * NOT called by Monnify — these are for managing the estate
 */

const express = require("express");
const router = express.Router();
const db = require("../services/db");

// GET /api/residents/:houseNumber - Look up a resident
router.get("/residents/:houseNumber", async (req, res) => {
  try {
    const resident = await db.getResidentByHouseNumber(req.params.houseNumber);
    if (!resident) {
      return res.status(404).json({ success: false, message: "Resident not found" });
    }
    res.json({ success: true, data: resident });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/plans - List all available power plans
router.get("/plans", async (req, res) => {
  try {
    const plans = await db.getActivePlans();
    res.json({ success: true, data: plans });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/plans/:planCode - Get a specific plan
router.get("/plans/:planCode", async (req, res) => {
  try {
    const plan = await db.getPlanByCode(req.params.planCode);
    if (!plan) {
      return res.status(404).json({ success: false, message: "Plan not found" });
    }
    res.json({ success: true, data: plan });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/transactions/:ref - Get a transaction by reference
router.get("/transactions/:ref", async (req, res) => {
  try {
    const transaction = await db.getTransactionByRef(
      decodeURIComponent(req.params.ref)
    );
    if (!transaction) {
      return res.status(404).json({ success: false, message: "Transaction not found" });
    }
    res.json({ success: true, data: transaction });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/health - System health check
router.get("/health", async (req, res) => {
  res.json({
    success: true,
    service: "MonieEstate Backend",
    status: "operational",
    timestamp: new Date().toISOString(),
    endpoints: {
      monnify: {
        verifyPayer:      "POST /monnify/verify-payer",
        paymentRequest:   "POST /monnify/payment-request",
        paymentRequery:   "GET  /monnify/payment-requery?transactionReference=",
      },
      internal: {
        getResident:    "GET /api/residents/:houseNumber",
        listPlans:      "GET /api/plans",
        getPlan:        "GET /api/plans/:planCode",
        getTransaction: "GET /api/transactions/:ref",
      },
    },
  });
});

module.exports = router;
