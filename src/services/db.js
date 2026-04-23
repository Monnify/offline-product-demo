const fs = require("fs");
const path = require("path");

const DB_PATH = path.resolve(process.env.DB_PATH || "./data/db.json");

function readDb() {
  return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
}

function writeDb(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), "utf8");
}

async function getResidentByHouseNumber(houseNumber) {
  const { residents } = readDb();
  return (
    residents.find(
      (r) =>
        r.houseNumber.trim().toUpperCase() === houseNumber.trim().toUpperCase()
    ) || null
  );
}

async function updateResidentUnits(houseNumber, newUnits) {
  const data = readDb();
  const resident = data.residents.find(
    (r) =>
      r.houseNumber.trim().toUpperCase() === houseNumber.trim().toUpperCase()
  );
  if (!resident) throw new Error(`Resident ${houseNumber} not found`);
  resident.currentUnits = newUnits;
  writeDb(data);
}

async function getActivePlans() {
  const { plans } = readDb();
  return plans.filter((p) => (p.status || "ACTIVE") === "ACTIVE");
}

async function getPlanByCode(planCode) {
  const { plans } = readDb();
  return (
    plans.find(
      (p) =>
        p.planCode.trim().toUpperCase() === planCode.trim().toUpperCase()
    ) || null
  );
}

async function createTransaction(data) {
  const dbData = readDb();
  const now = new Date().toISOString();
  dbData.transactions.push({
    transactionRef: data.transactionRef,
    houseNumber: data.houseNumber,
    planCode: data.planCode,
    amount: data.amount,
    unitsPurchased: data.unitsPurchased || 0,
    powerToken: data.powerToken || "",
    status: data.status || "PENDING",
    createdAt: now,
    updatedAt: now,
  });
  writeDb(dbData);
}

async function getTransactionByRef(transactionRef) {
  const { transactions } = readDb();
  return transactions.find((t) => t.transactionRef === transactionRef) || null;
}

async function updateTransaction(transactionRef, updates) {
  const data = readDb();
  const tx = data.transactions.find((t) => t.transactionRef === transactionRef);
  if (!tx) throw new Error(`Transaction ${transactionRef} not found`);
  if (updates.status !== undefined) tx.status = updates.status;
  if (updates.powerToken !== undefined) tx.powerToken = updates.powerToken;
  if (updates.unitsPurchased !== undefined) tx.unitsPurchased = updates.unitsPurchased;
  tx.updatedAt = new Date().toISOString();
  writeDb(data);
}

async function initializeSheets() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  if (fs.existsSync(DB_PATH)) {
    console.log("✅ Local file DB loaded from", DB_PATH);
    return;
  }

  const now = new Date().toISOString();
  const seed = {
    residents: [
      { houseNumber: "ME001A", fullName: "Adaeze Okonkwo",   phone: "08012345678", email: "adaeze@email.com",    status: "ACTIVE",    currentUnits: 120, createdAt: now },
      { houseNumber: "ME002B", fullName: "Babatunde Lawal",   phone: "08023456789", email: "babatunde@email.com", status: "ACTIVE",    currentUnits: 45,  createdAt: now },
      { houseNumber: "ME003C", fullName: "Chioma Eze",        phone: "08034567890", email: "chioma@email.com",    status: "ACTIVE",    currentUnits: 0,   createdAt: now },
      { houseNumber: "ME004D", fullName: "Danladi Musa",      phone: "08045678901", email: "danladi@email.com",   status: "SUSPENDED", currentUnits: 200, createdAt: now },
      { houseNumber: "ME005E", fullName: "Emeka Obiora",      phone: "08056789012", email: "emeka@email.com",     status: "ACTIVE",    currentUnits: 75,  createdAt: now },
    ],
    plans: [
      { planCode: "STARTER",  planName: "Starter Plan",  amount: 2000,  units: 50,   description: "50 units - ideal for a single room occupant",              status: "ACTIVE" },
      { planCode: "HOME",     planName: "Home Plan",     amount: 5000,  units: 150,  description: "150 units - perfect for a 2-3 bedroom apartment",          status: "ACTIVE" },
      { planCode: "PREMIUM",  planName: "Premium Plan",  amount: 10000, units: 350,  description: "350 units - great for large homes with heavy appliances",   status: "ACTIVE" },
      { planCode: "BUSINESS", planName: "Business Plan", amount: 25000, units: 1000, description: "1000 units - designed for home office / small business",    status: "ACTIVE" },
    ],
    transactions: [],
  };

  writeDb(seed);
  console.log("✅ Local file DB initialized at", DB_PATH);
}

module.exports = {
  getResidentByHouseNumber,
  updateResidentUnits,
  getActivePlans,
  getPlanByCode,
  createTransaction,
  getTransactionByRef,
  updateTransaction,
  initializeSheets,
};
