# MyDukkan24 — Enterprise Retail OS & Smart POS

![MyDukkan24 Status](https://img.shields.io/badge/MyDukkan24-v4.2%20Production-2563EB?style=for-the-badge&logo=shopify&logoColor=white)
![Platform](https://img.shields.io/badge/Platform-100%25%20Offline%20First%20PWA-10B981?style=for-the-badge&logo=pwa&logoColor=white)
![AI Engine](https://img.shields.io/badge/AI%20Copilot-Google%20Gemini%20via%20Netlify-3B82F6?style=for-the-badge&logo=google&logoColor=white)
![Deployment](https://img.shields.io/badge/Deploy-Netlify%20Serverless-00C7B7?style=for-the-badge&logo=netlify&logoColor=white)

> **"Empower Your Retail Shop with Enterprise Speed and Precision."**  
> An ultra-modern, zero-latency retail operating system & point-of-sale platform built specifically for Indian Kirana stores, departmental outlets, supermarkets, and local businesses.

---

## 🚀 Live Production Links
- **Live Platform Web App:** [https://mydukaan24.netlify.app/app.html](https://mydukaan24.netlify.app/app.html)
- **Interactive Landing Page & POS Simulator:** [https://mydukaan24.netlify.app/](https://mydukaan24.netlify.app/)
- **GitHub Repository:** [https://github.com/mayursingh24/MyDukaan](https://github.com/mayursingh24/MyDukaan)
- **Direct Android APK Download:** [Download MyDukkan24 v4.2 APK](https://mydukaan24.netlify.app/assets/MyDukkan24-v4.apk)

---

## 👨‍💻 Lead Creator & Deployment
- **Developer:** **Mayur Singh**
- **Location:** Lucknow, Uttar Pradesh, India
- **Direct Phone / WhatsApp:** **[+91 6306437348](https://wa.me/916306437348)**
- **Email:** [mayur4singhhh@gmail.com](mailto:mayur4singhhh@gmail.com)
- **Instagram:** [@_mayur.x24](https://instagram.com/_mayur.x24)
- **LinkedIn:** [mayursingh24](https://linkedin.com/in/mayursingh24)

---

## ⚡ Core SaaS Modules & Capabilities

### 1. High-Speed POS Billing Terminal
- Complete itemized invoice creation in **under 3 seconds**.
- Multi-tender settlement options:
  - **Cash:** Real-time change return calculator with rapid denomination buttons (`+₹100`, `+₹200`, `+₹500`, `Exact`).
  - **Dynamic UPI QR:** Generates instant scannable QR codes (`6306437348@upi`) for PhonePe, Google Pay, Paytm, and BHIM.
  - **Card POS & Digital Udhaar:** Direct ledger entry with customer validation.
- Real-time tax & discount engines: Subtotal, MRP discount savings, customizable GST rates (0%, 5%, 12%, 18%), and instant bill discounts (% or ₹).
- Zero-latency Web Audio API synthesizer for supermarket laser scanner beeps and cash settlement chimes.
- Print-ready **80mm & 58mm thermal receipts** with instant 1-click WhatsApp digital invoice sharing.

### 2. Universal Barcode Vision & 5-Tier FMCG Registry
- **Camera Barcode Detection:** Dual engine utilizing `Html5Qrcode` + native browser `BarcodeDetector` API.
- **Hardware Scanner Gun Support:** Auto-detects USB/Bluetooth handheld barcode guns without requiring input field focus.
- **85+ Inbuilt Indian FMCG Master DB:** Instant 0ms offline matching for Maggi, Amul Butter, Parle-G, Britannia Good Day, Aashirvaad Atta, Fortune Oil, Tata Tea, Surf Excel, Dettol, Colgate, Patanjali, Dabur, Haldiram, Cadbury Silk, etc.
- **Indian GS1 Manufacturer Resolution:** Automatically decodes manufacturer brand and category for any barcode starting with `890...` (HUL, Nestlé, ITC, Britannia, Amul, Parle, PepsiCo, Adani Wilmar, Patanjali, Dabur, Marico, Haldiram, MDH, Everest).
- **Open Food Facts API:** Global fallback for millions of packaged goods.
- **Guaranteed Auto-Fill:** Never shows a "Not Found" dead-end — product name, category, realistic MRP, selling price, and wholesale cost are automatically suggested.

### 3. Wholesale Purchases & Supplier Ledger (`js/purchases.js`)
- Directory of wholesale suppliers/distributors with GSTIN, contact numbers, and payment terms.
- Record inward purchase invoices (Bill number, date, items, purchase rate, tax).
- **Automatic Stock Inward:** Purchased quantities automatically increment inventory stock.
- Supplier credit ledger: Track dues owed to distributors and record payment vouchers.
- One-click export of purchases summary to CSV.

### 4. Daily Cash Counter & Closing Register (Z-Report)
- Real-time cash drawer tally: Cash collected, UPI collected, Card payments, and Udhaar issued.
- Day-end settlement reconciliation modal (`F4` shortcut).
- Print Day-End Z-Report closing sheet for daily book-keeping.

### 5. Digital Udhaar Khata (Customer Credit CRM)
- Customer profiles with purchase history, contact information, and outstanding balances.
- **1-Click WhatsApp Payment Reminders:** Pre-formatted message with exact balance due, bill breakdown, and shop UPI ID.
- Cash/UPI debt settlement modal updating customer ledger in real time.

### 6. Inventory & Stock Safety Control
- Product catalog with SKU, category, cost price, MRP, selling price, and gross margin percentages.
- Automated safety stock alerts for **Low Stock** and **Out of Stock** items.
- Quick 1-click inline stock adjustments.
- Instant Barcode / SKU generation.
- Full CSV Export & Import for bulk inventory updates.

### 7. Daily Expense Tracker
- Record and categorize daily store expenses (Rent, Electricity, Logistics, Staff Advance, Tea/Snacks, Maintenance).
- Integrated into net profit calculations.

### 8. Financial Reports & Analytics (P&L)
- Time range filters: Today, Last 7 Days, This Month, All Time.
- Real-time Cost of Goods Sold (COGS) and Operating Expenses breakdown.
- **Net Take-Home Profit Formula:**
  $$\text{Net Profit} = \text{Gross Revenue} - \text{COGS} - \text{Operating Expenses}$$
- Best-selling SKUs and slow-moving inventory analysis.
- Total inventory valuation (Procurement cost vs retail realization).

### 9. Multilingual Engine (`js/i18n.js`)
- Full live translation without page reload across:
  - **English**
  - **हिन्दी (Hindi)**
  - **Hinglish**
- Translates navigation menus, KPI cards, billing interfaces, reports, and settings.
- Automatically persists the user's language preference in `localStorage`.

### 10. Dukkan Copilot AI (Google Gemini via Netlify)
- Secure Serverless Architecture: Client -> Netlify Serverless Function (`/api/gemini`) -> Google Gemini API.
- **Zero API Key Exposure:** Reads strictly from Netlify Environment Variables (`GEMINI_API_KEY`).
- Live context grounding: Real-time inventory status, low-stock items, top debtors, and sales numbers are dynamically fed to the model.
- **Offline Rule-Based Fallback:** If internet is unavailable or API key is pending, an offline retail rule engine automatically handles inventory analysis and sales queries without breaking or throwing errors.

---

## 🔑 How to Setup Gemini API Key on Netlify (Step-by-Step)

### Step 1: Get Your Free Gemini API Key
1. Go to [Google AI Studio (https://aistudio.google.com/app/apikey)](https://aistudio.google.com/app/apikey).
2. Sign in with your Google account.
3. Click **"Create API Key"**.
4. Copy the generated key (starts with `AIzaSy...`).

### Step 2: Add to Netlify Environment Variables
1. Log in to [Netlify Dashboard (https://app.netlify.com)](https://app.netlify.com).
2. Select your site: **`mydukaan24`**.
3. In the left navigation, click **Site configuration** (or **Site settings**).
4. Click on **Environment variables**.
5. Click **"Add a variable"** ➔ Select **"Add a single variable"**:
   - **Key:** `GEMINI_API_KEY` *(Must be in exact capital letters)*
   - **Value:** Paste your Google Gemini API key (`AIzaSy...`)
6. Click **"Create variable"**.

### Step 3: Trigger a Fresh Deploy
1. In the top navigation bar, click on **Deploys**.
2. Click the **"Trigger deploy"** dropdown on the right side.
3. Select **"Clear cache and deploy site"**.
4. In under 60 seconds, your Netlify serverless backend will be fully active and connected to Gemini AI!

---

## 🛠️ Tech Stack
- **Frontend:** Pure HTML5, Vanilla ES6+ Modular JavaScript, Custom Modern CSS.
- **Design System:** Obsidian Slate (`#06080F`), Glassmorphism, Micro-Borders, Neon Indigo & Emerald Accents.
- **Typography:** Inter (Financials & UI) + JetBrains Mono (SKUs, Currencies, Codes).
- **Icon Library:** Lightweight Inline SVG Icon Engine (`js/icons.js`) with zero network overhead.
- **Offline Storage:** High-performance Inbuilt Local Database (`localStorage`) with full JSON backup & CSV capabilities.
- **Serverless API:** Netlify Functions (`netlify/functions/gemini.js`).
- **PWA Caching:** Service Worker v6.0 (`sw.js`) with Network-First strategy and instant cache-busting.

---

## 📁 Repository Structure
```
MyDukaan-v4/
├── assets/
│   ├── LOGO.jpeg             # Official MyDukkan24 logo
│   ├── logo.svg              # Vector logo fallback
│   └── MyDukkan24-v4.apk     # Android APK download package
├── css/
│   ├── landing.css           # Ultra-premium SaaS landing page styles
│   ├── style.css             # Main application design system & theme variables
│   └── components.css        # POS terminal, modals, and responsive layout
├── js/
│   ├── icons.js              # Centralized SVG icon library
│   ├── i18n.js               # Multi-language translation engine (EN, HI, Hinglish)
│   ├── storage.js            # Inbuilt local database & Web Audio synthesizer
│   ├── scanner.js            # 5-tier barcode vision & FMCG master registry
│   ├── pos.js                # High-speed POS billing & checkout engine
│   ├── inventory.js          # Product catalog & stock safety control
│   ├── purchases.js          # Wholesale purchases & supplier ledger
│   ├── khata.js              # Customer ledger & Udhaar CRM
│   ├── analytics.js          # Profit & Loss calculations and financial charts
│   ├── staff.js              # Employee directory & 31-day attendance
│   ├── ai.js                 # Dukkan Copilot AI assistant & offline fallback
│   └── app.js                # Master application router & views
├── netlify/
│   └── functions/
│       └── gemini.js         # Secure serverless Gemini backend proxy
├── .env.example              # Environment variables template
├── _redirects                # Netlify SPA routing rules
├── app.html                  # Main retail business OS terminal
├── index.html                # High-impact landing page & interactive POS simulator
├── manifest.json             # PWA metadata & shortcut configuration
├── netlify.toml              # Netlify build & cache configuration
├── README.md                 # Complete system documentation
└── sw.js                     # Network-First PWA service worker v6.0
```

---

## 📄 License & Attribution
- **Author:** Mayur Singh (Lucknow, India)
- **Copyright:** © 2026 Mayur Singh. All rights reserved.
- **Deployed on:** Netlify
