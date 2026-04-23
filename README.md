# 🏘️ MonieEstate — Monnify Offline Pay-in Integration

A Node.js backend that powers **MonieEstate**, an imaginary housing estate that generates its own power and allows residents to purchase electricity plans offline via Monnify agents across Nigeria.

---

## 📐 System Architecture

```
Resident walks to Moniepoint Agent
         │
         ▼
  Agent opens POS / Web
         │
         ▼
 Enters: HouseNumber:PlanCode
  e.g.  "ME001A:HOME"
         │
         ▼
[Monnify] ──POST──▶ /monnify/verify-payer  ──▶ [MonieEstate Backend]
                                                      │
                                               Local JSON DB
                                               (Residents, Plans)
                                                      │
                                         Returns resident name + plan amount
         │
         ▼
  Agent collects cash, confirms amount
         │
         ▼
[Monnify] ──POST──▶ /monnify/payment-request  ──▶ [MonieEstate Backend]
                                                         │
                                                  Generates power token
                                                  Credits resident units
                                                  Logs to local DB
                                                         │
                                                Returns power token
         │
         ▼
  Agent prints receipt with power token
  Resident enters token on estate meter
```

---

## 🗄️ Local File Database Structure

Data is stored in `data/db.json` — a plain JSON file created automatically on first run. It contains three collections:

### `residents`
| Field | Type | Description |
|-------|------|-------------|
| houseNumber | String | Alphanumeric ID, e.g. `ME001A`, `A12B` |
| fullName | String | Resident's full name |
| phone | String | Contact phone number |
| email | String | Email address |
| status | String | `ACTIVE` or `SUSPENDED` |
| currentUnits | Number | Current power unit balance |
| createdAt | String | ISO timestamp |

### `plans`
| Field | Type | Description |
|-------|------|-------------|
| planCode | String | e.g. `STARTER`, `HOME`, `PREMIUM`, `BUSINESS` |
| planName | String | Human-readable plan name |
| amount | Number | Price in Naira |
| units | Number | Power units included |
| description | String | Plan description |
| status | String | `ACTIVE` or `INACTIVE` |

### `transactions`
| Field | Type | Description |
|-------|------|-------------|
| transactionRef | String | Monnify transaction reference |
| houseNumber | String | Resident's house number |
| planCode | String | Plan code purchased |
| amount | Number | Amount paid in Naira |
| unitsPurchased | Number | Power units purchased |
| powerToken | String | Generated token, e.g. `1234-5678-9012-3456` |
| status | String | `PENDING`, `SUCCESS`, or `FAILED` |
| createdAt | String | ISO timestamp |
| updatedAt | String | ISO timestamp |

---

## ⚡ Monnify Endpoints

### 1. Payer Verification — `POST /monnify/verify-payer`
**Called by Monnify to verify customer at agent**

**Request (from Monnify):**
```json
{
  "productCode": "P10101",
  "paymentRecipientId": "ME001A:HOME"
}
```

> **Format:** `HOUSE_NUMBER:PLAN_CODE`  
> The colon separator lets the agent capture both house number and desired plan in a single ID field.

**Success Response:**
```json
{
  "responseCode": "00",
  "responseMessage": "User verified successfully.",
  "paymentRecipientId": "ME001A:HOME",
  "paymentRecipientDescription": "Adaeze Okonkwo | Home Plan (150 units) | Current Balance: 120 units",
  "amount": 5000
}
```

**User Not Found:**
```json
{
  "responseCode": "02",
  "responseMessage": "House number ME999X does not exist in MonieEstate."
}
```

---

### 2. Payment Request — `POST /monnify/payment-request`
**Called by Monnify after successful cash collection**

**Request (from Monnify):**
```json
{
  "amount": 5000,
  "transactionReference": "MNFY|66|20210825115615|000002",
  "productCode": "P10101",
  "paymentRecipientId": "ME001A:HOME"
}
```

**Success Response:**
```json
{
  "responseCode": "00",
  "productCode": "HOME",
  "paymentRecipientId": "ME001A:HOME",
  "transactionReference": "MNFY|66|20210825115615|000002",
  "paymentToken": "1234-5678-9012-3456"
}
```

> This token is printed on the agent receipt and entered by the resident on their estate meter.

---

### 3. Payment Requery — `GET /monnify/payment-requery`
**Called by Monnify to check status of a payment**

**Request:**
```
GET /monnify/payment-requery?transactionReference=MNFY%7C66%7C20210825115615%7C000002
```

**Success Response:**
```json
{
  "responseCode": "00",
  "productCode": "HOME",
  "paymentRecipientId": "ME001A:HOME",
  "transactionReference": "MNFY|66|20210825115615|000002",
  "paymentToken": "1234-5678-9012-3456"
}
```

---

## 🛠️ Setup Guide

### Step 1: Clone and Install
```bash
git clone <your-repo>
cd monie-estate
npm install
```

### Step 2: Configure Environment
```bash
cp .env.example .env
```

Edit `.env`:
```env
PORT=3000
MONNIFY_PRODUCT_CODE=your_product_code
# Optional: override DB file location (default: ./data/db.json)
# DB_PATH=./data/db.json
```

### Step 3: Start the Server
```bash
npm start
# or for development:
npm run dev
```

On first run the server will:
- Create `data/db.json` with seed residents and plans
- Start listening on port 3000

### Step 5: Expose Publicly with ngrok
Monnify needs to call your endpoints from the internet:

```bash
# Install ngrok from https://ngrok.com
ngrok http 3000
```

Copy the HTTPS URL (e.g. `https://abc123.ngrok.io`)

### Step 6: Configure on Monnify Dashboard

1. Log into [Monnify Dashboard](https://app.monnify.com)
2. Go to **Developer Settings → Offline Payment Setup**
3. Set your endpoints:
   - **Payer Verification URL:** `https://abc123.ngrok.io/monnify/verify-payer`
   - **Payment Request URL:** `https://abc123.ngrok.io/monnify/payment-request`
   - **Payment Requery URL:** `https://abc123.ngrok.io/monnify/payment-requery`
4. Create an **Offline Product**:
   - Product Type: **Merchant Invoice** (allows dynamic amounts per plan)
   - This gives you a `productCode` to put in your `.env`

---

## 🧪 Testing Locally

### Test Payer Verification
```bash
curl -X POST http://localhost:3000/monnify/verify-payer \
  -H "Content-Type: application/json" \
  -d '{"productCode": "P10101", "paymentRecipientId": "ME001A:HOME"}'
```

### Test Payment Request
```bash
curl -X POST http://localhost:3000/monnify/payment-request \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 5000,
    "transactionReference": "MNFY|66|20241201120000|000001",
    "productCode": "P10101",
    "paymentRecipientId": "ME001A:HOME"
  }'
```

### Test Payment Requery
```bash
curl "http://localhost:3000/monnify/payment-requery?transactionReference=MNFY%7C66%7C20241201120000%7C000001"
```

### Check Resident Balance
```bash
curl http://localhost:3000/api/residents/ME001A
```

### List Plans
```bash
curl http://localhost:3000/api/plans
```

---

## 📋 Sample Residents (Pre-seeded)

| House Number | Name | Status | Initial Units |
|-------------|------|--------|---------------|
| ME001A | Adaeze Okonkwo | ACTIVE | 120 |
| ME002B | Babatunde Lawal | ACTIVE | 45 |
| ME003C | Chioma Eze | ACTIVE | 0 |
| ME004D | Danladi Musa | **SUSPENDED** | 200 |
| ME005E | Emeka Obiora | ACTIVE | 75 |

---

## 💡 Plans Available

| Code | Name | Price | Units |
|------|------|-------|-------|
| STARTER | Starter Plan | ₦2,000 | 50 units |
| HOME | Home Plan | ₦5,000 | 150 units |
| PREMIUM | Premium Plan | ₦10,000 | 350 units |
| BUSINESS | Business Plan | ₦25,000 | 1,000 units |

---

## 🔐 How The Power Token Works

When a resident pays at a Moniepoint agent:
1. Agent enters `ME001A:HOME` on the POS
2. Monnify calls `/monnify/verify-payer` → backend confirms resident + returns ₦5,000
3. Resident pays ₦5,000 cash
4. Monnify calls `/monnify/payment-request`
5. Backend generates token: `3847-2910-5634-8821`
6. Token is printed on agent receipt
7. Resident enters token on their estate meter → 150 units loaded
8. Resident's balance updated in `data/db.json`: 120 + 150 = **270 units**

---

## 📁 Project Structure

```
monie-estate/
├── src/
│   ├── index.js                    # Express app entry point
│   ├── routes/
│   │   ├── monnify.js              # Monnify offline pay-in endpoints
│   │   └── api.js                  # Internal management API
│   ├── services/
│   │   └── db.js                   # Local JSON file DB layer
│   └── utils/
│       └── tokenGenerator.js       # Power token generation
├── data/
│   └── db.json                     # Local database (auto-created, gitignored)
├── .env                            # Environment variables (gitignored)
├── .env.example                    # Environment template
├── .gitignore
└── package.json
```
