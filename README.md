# MyDukkan24 — Enterprise Retail OS & Smart POS

![MyDukkan24 Status](https://img.shields.io/badge/MyDukkan24-v7.2%20Production-2563EB?style=for-the-badge&logo=shopify&logoColor=white)
![Platform](https://img.shields.io/badge/Platform-100%25%20Offline%20First%20PWA-10B981?style=for-the-badge&logo=pwa&logoColor=white)
![AI Engine](https://img.shields.io/badge/AI%20Copilot-Google%20Gemini%203.8%20via%20Netlify-3B82F6?style=for-the-badge&logo=google&logoColor=white)
![Mobile Scaling](https://img.shields.io/badge/Mobile%20Ready-100%25%20Zero%20Overflow-8B5CF6?style=for-the-badge&logo=android&logoColor=white)
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
- **Default UPI ID:** `6306437348@upi`
- **Email:** [mayur4singhhh@gmail.com](mailto:mayur4singhhh@gmail.com)
- **Instagram:** [@_mayur.x24](https://instagram.com/_mayur.x24)
- **LinkedIn:** [mayursingh24](https://linkedin.com/in/mayursingh24)

---

## 📱 Mobile Scaling & Responsiveness (v7.2 Update)

In version 7.2, the entire responsive layout across `index.html` and `app.html` was completely overhauled to deliver a native app-like experience on every smartphone screen (from 320px budget phones to modern ultra-wide flagships):

1. **Zero-Overflow Mobile Topbar:**
   - Desktop-only controls (`Counter #1 Active [F4]`, `Language Selector`, `Search items [Ctrl+K]`, and `Store Profile`) are cleanly hidden on mobile viewports (< 768px).
   - Only the Hamburger menu `[☰]`, compact `MyDukkan24` logo, `⚡ New Sale` action button, and essential icons (Copilot, Notifications, Theme) remain visible.
   - Prevents horizontal collision and overlapping text.

2. **Mobile Sidebar Quick Controls:**
   - The Language selector (`English`, `हिन्दी`, `Hinglish`) and the Day-End Cash Register button are conveniently embedded inside the mobile slide-out drawer (`#app-sidebar`), accessible with 1 tap on the hamburger menu.

3. **Bottom Dock Navigation & Netlify Badge Shielding:**
   - The 6-tab mobile dock (`Home`, `Billing`, `Scan`, `Stock`, `Khata`, `Settings`) has been elevated to `z-index: 999999` with automatic `env(safe-area-inset-bottom)` padding for bezel-less screens.
   - Content containers (`.page-container`) have 90px bottom clearance to prevent FABs, modals, and lists from being obstructed by the dock.

4. **Landing Page Mobile Pill Optimization:**
   - The `⚡ Launch App →` button on the landing page navbar is locked to a single-line pill shape (`height: 32px`, `white-space: nowrap`), preventing deformation into tall round circles.
   - The secondary `📱 Download APK` button in the navbar is hidden on small screens to give full breathing room to the primary action.

---

## 🚫 How to Disable the "Powered by Netlify" Floating Badge

Netlify sometimes injects a floating badge in the bottom right/center that can cover navigation elements on mobile devices.

### Method 1: Turn Off in Netlify Dashboard (Recommended)
1. Go to your [Netlify Dashboard (https://app.netlify.com)](https://app.netlify.com).
2. Click on your project: **`mydukaan24`**.
3. Navigate to **Site configuration** (or **Project configuration**) ➔ **General** ➔ **Site details**.
4. Scroll down to the **"Powered by Netlify badge"** section.
5. Click **"Turn off"** or uncheck the badge option and click **Save**.
6. The badge will disappear permanently from all pages.

### Method 2: Inbuilt CSS Suppression (Automatic in v7.2)
MyDukaan24 includes aggressive zero-latency CSS rules in both `css/style.css` and `css/landing.css`:
```css
#netlify-badge,
.netlify-badge,
[data-netlify-badge],
div:has(> a[href*="netlify.com"]),
div:has(> a[href*="netlify.app"]),
a[href*="netlify.com"]:not(.safe-link),
iframe[src*="netlify"],
.netlify-banner,
#netlify-drawer {
  display: none !important;
  visibility: hidden !important;
  opacity: 0 !important;
  pointer-events: none !important;
  height: 0 !important;
  width: 0 !important;
  overflow: hidden !important;
  z-index: -9999 !important;
}
```
This guarantees that even if Netlify injects a badge, it is suppressed and cannot intercept user taps on `Stock`, `Khata`, or billing buttons.

---

## ⚡ Core Modules & Platform Capabilities

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
- **Camera Barcode Detection:** Dual engine utilizing bundled local `Html5Qrcode` + native browser `BarcodeDetector` API.
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

### 10. Dukkan Copilot AI (Google Gemini 3.8 via Netlify)
- Secure Serverless Architecture: Client -> Netlify Serverless Function (`/api/gemini`) -> Google Gemini API.
- **Model Cascade:** Uses current generation Google models: `gemini-3.8-flash` with failover to `gemini-3.5-flash-lite`.
- **Zero API Key Exposure:** Reads securely from Netlify Environment Variables (`GEMINI_API_KEY`).
- **In-App Key Override:** Users can click **`[🔑 Set Key]`** in the chat header to test a personal key from their browser without touching server settings.
- **Live Context Grounding:** Real-time inventory status, low-stock items, top debtors, and sales numbers are dynamically fed to the model.
- **Offline Rule-Based Fallback:** If internet is unavailable or the API key returns 401/error, an offline retail intelligence rule engine automatically handles store inquiries, greeting, diagnostics, and stock checks with zero errors.

---

## 🔑 How to Setup Gemini API Key on Netlify (Step-by-Step)

> [!IMPORTANT]
> **API Key Format:** Google Gemini API keys from Google AI Studio ALWAYS start with **`AIzaSy...`** (39 characters).
> Keys with other prefixes (such as `AQ...`) are not valid for Google's Gemini endpoint and will return a `401 UNAUTHENTICATED` error.

### Step 1: Get Your Free Gemini API Key
1. Go to [Google AI Studio (https://aistudio.google.com/app/apikey)](https://aistudio.google.com/app/apikey).
2. Sign in with your Google account.
3. Click **"Create API Key"** ➔ Select **"Create API key in new project"**.
4. Copy the generated key (it will begin with `AIzaSy...`).

### Step 2: Add to Netlify Environment Variables
1. Log in to [Netlify Dashboard (https://app.netlify.com)](https://app.netlify.com).
2. Select your site: **`mydukaan24`**.
3. In the left navigation, click **Project configuration** (or **Site configuration**).
4. Click on **Environment variables**.
5. Click **"Add a variable"** ➔ Select **"Add a single variable"**:
   - **Key:** `GEMINI_API_KEY` *(Must be in exact capital letters)*
   - **Scopes:** Select **All scopes**
   - **Values:** Select **Same value for all deploy contexts**
   - **Value:** Paste your Google Gemini API key (`AIzaSy...`)
6. Click **"Create variable"**.

### Step 3: Trigger a Fresh Deploy
1. In the Netlify top navigation bar, click on **Deploys**.
2. Click the **"Trigger deploy"** dropdown on the right side.
3. Select **"Deploy project without cache"**.
4. In under 30 seconds, your Netlify serverless backend will be live with full Gemini AI support!

---

## 🛠️ Tech Stack
- **Frontend:** Pure HTML5, Vanilla ES6+ Modular JavaScript, Custom Modern CSS.
- **Design System:** Deep Obsidian Slate (`#070913`), High-Contrast Solid Cards (`#131A2D`), Glassmorphism, Micro-Borders, Neon Indigo & Emerald Accents.
- **Typography:** Inter (Financials & UI) + JetBrains Mono (SKUs, Currencies, Codes).
- **Icon Library:** Lightweight Inline SVG Icon Engine (`js/icons.js`) with zero network overhead.
- **Offline Storage:** High-performance Inbuilt Local Database (`localStorage`) with full JSON backup & CSV capabilities.
- **Serverless API:** Netlify Functions (`netlify/functions/gemini.js`).
- **PWA Caching:** Service Worker v7.2 (`sw.js`) with pure Network-First strategy and instant cache-busting.

---

## 📁 Repository Structure
```
MyDukaan-v4/
├── assets/
│   ├── LOGO.jpeg             # Official MyDukkan24 logo
│   ├── logo.svg              # Vector logo fallback
│   └── MyDukkan24-v4.apk     # Android APK download package
├── css/
│   ├── landing.css           # Ultra-premium SaaS landing page styles (v7.2)
│   ├── style.css             # Main application design system & theme variables (v7.2)
│   └── components.css        # POS terminal, modals, and responsive layout
├── js/
│   ├── html5-qrcode.min.js   # Bundled local barcode vision engine
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
│       └── gemini.js         # Secure serverless Gemini backend proxy (Gemini 3.8 Flash)
├── .env.example              # Environment variables template
├── _redirects                # Netlify SPA routing rules
├── app.html                  # Main retail business OS terminal (v7.2)
├── index.html                # High-impact landing page & interactive POS simulator (v7.2)
├── manifest.json             # PWA metadata & shortcut configuration
├── netlify.toml              # Netlify build & cache configuration
├── README.md                 # Complete system documentation (v7.2)
└── sw.js                     # Network-First PWA service worker v7.2
```

---

## 📄 License & Attribution
- **Author:** Mayur Singh (Lucknow, India)
- **Official Contact:** +91 6306437348
- **Copyright:** © 2026 Mayur Singh. All rights reserved.
- **Deployed on:** Netlify (https://mydukaan24.netlify.app/)
