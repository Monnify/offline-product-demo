/**
 * Monnify Offline Pay-in Endpoints
 *
 * These are the 3 endpoints that Monnify calls during an offline payment flow:
 *
 * 1. POST /monnify/verify-payer     → Payer Verification (MANDATORY)
 * 2. POST /monnify/payment-request  → Payment Request / Token Delivery (OPTIONAL)
 * 3. GET  /monnify/payment-requery  → Payment Requery / Status Check (OPTIONAL)
 */

const express = require("express");
const router = express.Router();
const db = require("../services/db");
const { generatePowerToken, calculateUnits } = require("../utils/tokenGenerator");

// ============================================================
// 1. PAYER VERIFICATION ENDPOINT (MANDATORY)
//    Monnify calls this to verify the customer paying at the agent
//
//    Request Body from Monnify:
//      { productCode, paymentRecipientId }
//
//    paymentRecipientId = House Number (e.g. "ME001A")
//
//    For MERCHANT_INVOICE type: also return `amount` so Monnify
//    knows what to charge (plan amount encoded in recipientId as "HOUSENO:PLANCODE")
// ============================================================
router.post("/verify-payer", async (req, res) => {
  const { productCode, paymentRecipientId } = req.body;

  console.log(`\n🔍 [Payer Verification] productCode=${productCode}, recipientId=${paymentRecipientId}`);

  try {
    // paymentRecipientId format: "HOUSENO:PLANCODE"  e.g. "ME001A:HOME"
    // This lets the agent collect both the house number and the plan in one field
    const parts = (paymentRecipientId || "").split(":");
    const houseNumber = parts[0]?.trim().toUpperCase();
    const planCode = parts[1]?.trim().toUpperCase();

    if (!houseNumber) {
      return res.json({
        responseCode: "02",
        responseMessage: "Invalid recipient ID. Format should be HOUSE_NUMBER:PLAN_CODE (e.g. ME001A:HOME)",
      });
    }

    // Look up resident in Google Sheets
    const resident = await db.getResidentByHouseNumber(houseNumber);

    if (!resident) {
      return res.json({
        responseCode: "02",
        responseMessage: `House number ${houseNumber} does not exist in MonieEstate.`,
      });
    }

    if (resident.status === "SUSPENDED") {
      return res.json({
        responseCode: "02",
        responseMessage: `Account for ${houseNumber} is suspended. Please contact the estate office.`,
      });
    }

    // If a plan code was provided, validate it and return the amount
    if (planCode) {
      const plan = await db.getPlanByCode(planCode);

      if (!plan) {
        return res.json({
          responseCode: "02",
          responseMessage: `Plan code "${planCode}" does not exist. Available plans: STARTER, HOME, PREMIUM, BUSINESS`,
        });
      }

      if (plan.status !== "ACTIVE") {
        return res.json({
          responseCode: "02",
          responseMessage: `Plan "${plan.planName}" is currently unavailable.`,
        });
      }

      // MERCHANT_INVOICE response — includes dynamic amount for this plan
      console.log(`✅ Verified: ${resident.fullName} (${houseNumber}) | Plan: ${plan.planName} | Amount: ₦${plan.amount}`);
      return res.json({
        responseCode: "00",
        responseMessage: "User verified successfully.",
        paymentRecipientId: paymentRecipientId,
        paymentRecipientDescription: `${resident.fullName} | ${plan.planName} (${plan.units} units) | Current Balance: ${resident.currentUnits} units`,
        amount: plan.amount, // MERCHANT_INVOICE: Monnify will charge exactly this amount
      });
    }

    // No plan code — show resident info only (agent will let customer pick plan manually)
    console.log(`✅ Verified: ${resident.fullName} (${houseNumber}) | No plan specified`);
    return res.json({
      responseCode: "00",
      responseMessage: "User verified successfully.",
      paymentRecipientId: houseNumber,
      paymentRecipientDescription: `${resident.fullName} | House: ${houseNumber} | Current Balance: ${resident.currentUnits} units`,
    });
  } catch (error) {
    console.error("❌ [Payer Verification Error]", error.message);
    return res.json({
      responseCode: "02",
      responseMessage: "Verification service temporarily unavailable. Please try again.",
    });
  }
});

// ============================================================
// 2. PAYMENT REQUEST ENDPOINT (OPTIONAL)
//    Monnify calls this AFTER successful payment at the agent.
//    We generate a power token here and credit the resident's units.
//
//    Request Body from Monnify:
//      { amount, transactionReference, productCode, paymentRecipientId }
// ============================================================
router.post("/payment-request", async (req, res) => {
  const { amount, transactionReference, productCode, paymentRecipientId } = req.body;

  console.log(`\n⚡ [Payment Request] ref=${transactionReference}, recipientId=${paymentRecipientId}, amount=₦${amount}`);

  try {
    // Parse house number and plan code from recipientId
    const parts = (paymentRecipientId || "").split(":");
    const houseNumber = parts[0]?.trim().toUpperCase();
    const planCode = parts[1]?.trim().toUpperCase();

    // Verify resident still exists
    const resident = await db.getResidentByHouseNumber(houseNumber);
    if (!resident) {
      return res.json({
        responseCode: "01",
        responseMessage: `Resident ${houseNumber} not found.`,
      });
    }

    // Check for duplicate transaction
    const existing = await db.getTransactionByRef(transactionReference);
    if (existing && existing.status === "SUCCESS") {
      console.log(`⚠️ Duplicate payment request for ${transactionReference} - returning existing token`);
      return res.json({
        responseCode: "00",
        productCode,
        paymentRecipientId,
        transactionReference,
        paymentToken: existing.powerToken,
      });
    }

    // Get plan details
    let plan = planCode ? await db.getPlanByCode(planCode) : null;

    // Calculate units earned based on amount paid
    let unitsPurchased;
    if (plan) {
      unitsPurchased = calculateUnits(amount, plan);
    } else {
      // Fallback: ₦20 per unit if no specific plan
      unitsPurchased = Math.floor(amount / 20);
    }

    // Generate unique power token
    const powerToken = generatePowerToken(houseNumber, planCode || "CUSTOM", amount);

    // Save transaction to Google Sheets
    await db.createTransaction({
      transactionRef: transactionReference,
      houseNumber,
      planCode: planCode || "CUSTOM",
      amount,
      unitsPurchased,
      powerToken,
      status: "SUCCESS",
    });

    // Credit units to resident's balance
    const newBalance = resident.currentUnits + unitsPurchased;
    await db.updateResidentUnits(houseNumber, newBalance);

    console.log(`✅ Payment processed: ${houseNumber} | +${unitsPurchased} units | Token: ${powerToken} | New balance: ${newBalance}`);

    return res.json({
      responseCode: "00",
      productCode,
      paymentRecipientId,
      transactionReference,
      paymentToken: powerToken,
    });
  } catch (error) {
    console.error("❌ [Payment Request Error]", error.message);

    // Try to mark transaction as failed if it was created
    try {
      await db.updateTransaction(transactionReference, { status: "FAILED" });
    } catch (_) {}

    return res.json({
      responseCode: "01",
      responseMessage: "Payment processing failed. Please contact estate office.",
    });
  }
});

// ============================================================
// 3. PAYMENT REQUERY ENDPOINT (OPTIONAL)
//    Monnify calls this when a previous payment request had unknown status.
//    We look up the transaction and return current status.
//
//    Query Params from Monnify:
//      transactionReference (URL encoded)
// ============================================================
router.get("/payment-requery", async (req, res) => {
  const transactionReference = decodeURIComponent(req.query.transactionReference || "");

  console.log(`\n🔄 [Payment Requery] ref=${transactionReference}`);

  try {
    if (!transactionReference) {
      return res.json({
        responseCode: "01",
        responseMessage: "Transaction reference is required.",
      });
    }

    const transaction = await db.getTransactionByRef(transactionReference);

    if (!transaction) {
      return res.json({
        responseCode: "01",
        responseMessage: `Transaction ${transactionReference} not found.`,
      });
    }

    if (transaction.status === "SUCCESS") {
      console.log(`✅ Requery success: ${transactionReference} | Token: ${transaction.powerToken}`);
      return res.json({
        responseCode: "00",
        productCode: transaction.planCode,
        paymentRecipientId: transaction.houseNumber,
        transactionReference,
        paymentToken: transaction.powerToken,
      });
    }

    // Transaction exists but was not successful
    return res.json({
      responseCode: "01",
      responseMessage: `Transaction status: ${transaction.status}`,
    });
  } catch (error) {
    console.error("❌ [Payment Requery Error]", error.message);
    return res.json({
      responseCode: "01",
      responseMessage: "Requery service temporarily unavailable.",
    });
  }
});

module.exports = router;
