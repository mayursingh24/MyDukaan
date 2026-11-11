# MyDukkan24 — Enterprise Retail OS & Smart POS

![MyDukkan24 Status](https://img.shields.io/badge/MyDukkan24-v8.2%20Production-2563EB?style=for-the-badge&logo=shopify&logoColor=white)
![Storage](https://img.shields.io/badge/Dual%20Storage-Offline%20%2B%20Firebase%20Firestore-F59E0B?style=for-the-badge&logo=firebase&logoColor=white)
![Platform](https://img.shields.io/badge/Platform-Strict%20Online%20%2B%20Offline%20PWA-10B981?style=for-the-badge&logo=pwa&logoColor=white)
![AI Engine](https://img.shields.io/badge/AI%20Copilot-Gemini%203.8%20Interactions%20API-3B82F6?style=for-the-badge&logo=google&logoColor=white)
![Mobile Scaling](https://img.shields.io/badge/Mobile%20Ready-100%25%20Zero%20Overflow-8B5CF6?style=for-the-badge&logo=android&logoColor=white)
![Deployment](https://img.shields.io/badge/Deploy-Vercel%20%2B%20Netlify%20Serverless-000000?style=for-the-badge&logo=vercel&logoColor=white)

> **"Empower Your Retail Shop with Enterprise Speed and Precision."**  
> An ultra-modern, high-speed retail operating system & point-of-sale platform built specifically for Indian Kirana stores, departmental outlets, supermarkets, and local businesses.

---

## 🚀 Live Production Links
- **Live Vercel Web App:** [https://mydukaan-eta.vercel.app/app.html](https://mydukaan-eta.vercel.app/app.html)
- **Live Vercel Landing Page & Login:** [https://mydukaan-eta.vercel.app/](https://mydukaan-eta.vercel.app/)
- **Netlify Mirror:** [https://mydukaan24.netlify.app/](https://mydukaan24.netlify.app/)
- **GitHub Repository:** [https://github.com/mayursingh24/MyDukaan](https://github.com/mayursingh24/MyDukaan)
- **Direct Android APK Download:** [Download MyDukkan24 v4.2 APK](https://mydukaan-eta.vercel.app/assets/MyDukkan24-v4.apk)

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

## 🔥 Firebase Cloud + Offline Dual Storage (v8.2)

MyDukkan24 supports **hybrid Offline + Online dual persistence**, so every bill, product SKU, customer Khata ledger entry, supplier invoice, expense, and staff record saves locally in **0ms** and synchronizes automatically with your private **Cloud Firestore Standard Edition** database when online.

### How Dual Storage Works
| Layer | Technology | Behavior |
| :--- | :--- | :--- |
| **Offline-First Local Engine** | `localStorage` (`mydukaan24_prod_db`) + Sync Delta Queue (`mydukaan24_sync_meta`) | POS checkout, Inventory updates, and Udhaar entries write in **0ms** with zero internet dependency. Boots seamlessly even if cloud SDK CDN is not cached yet. |
| **Browser Persistence Cache** | Firestore `persistentLocalCache` (`persistentMultipleTabManager`) | Caches cloud documents cleanly in IndexedDB across multiple open tabs/windows on the same device. |
| **Real-Time Cloud Sync** | Firebase Auth + Firestore `onSnapshot` (`/users/{uid}/...`) | Automatically reconciles local edits and streams multi-device updates in real time across mobile & desktop terminals. |
| **Zero-Leak Isolation** | `firestore.rules` (UID tenant boundary) | Enforces `request.auth.uid == uid`, immutable document IDs, schema bounds, and **strictly excludes `geminiKey`** so API keys stay local on device. |

### Firebase Auth Modes
- **Google Sign-In:** One-tap OAuth login (automatically falls back to redirect auth if popups are blocked).
- **Email & Password:** Sign In, Create Account, Password Reset email, and Sign Out.

### Step-by-Step Firebase Console Setup (Spark Free Plan)
1. Open the [Firebase Console](https://console.firebase.google.com/), create or select a project, and add a **Web App (`</>`)**.
2. Go to **Build ➔ Authentication ➔ Sign-in method** and enable **Google** and **Email/Password**.
3. Go to **Authentication ➔ Settings ➔ Authorized domains** and add **`mydukaan-eta.vercel.app`** (and your custom/Netlify domain + `localhost`).
4. Go to **Build ➔ Firestore Database ➔ Create database** and select **Standard Edition** (using the `(default)` database).
5. Publish your security rules:
   - Paste the contents of [`firestore.rules`](firestore.rules) into the Firebase Console **Firestore ➔ Rules** tab and click **Publish**, **or**
   - Deploy from CLI: `npx -y firebase-tools@latest deploy --only firestore`
6. Open **Project Settings ➔ General ➔ Your apps**, copy your `firebaseConfig` JSON/JS snippet:
   - **Quick Browser Connect:** Click **`🔐 Login / Sign Up`** right on [`index.html`](index.html) (or **Settings ➔ Firebase Cloud Sync** inside [`app.html`](app.html)), paste `firebaseConfig`, and click **Save & Connect Firebase**.
   - **All-Device Auto-Connect (Optional):** Set `DEFAULT_FIREBASE_CONFIG` in [`js/firebase-sync.js`](js/firebase-sync.js) once so every device opens directly into Google / Email Login without pasting config again.

---

## ▲ How to Deploy on Vercel (Zero Floating Badge)

Deploying on **Vercel** removes the third-party `"Powered by Netlify"` floating badge automatically and runs [`api/gemini.js`](api/gemini.js) + [`vercel.json`](vercel.json) natively:

1. Push this repository to **GitHub**.
2. Open [vercel.com/new](https://vercel.com/new), import **`mayursingh24/MyDukaan`**, leave **Framework Preset: Other** and **Output Directory** blank (static root), and click **Deploy**.
3. In your Vercel project go to **Settings ➔ Environment Variables** and add:
   - **Key:** `GEMINI_API_KEY` *(your key from [Google AI Studio](https://aistudio.google.com/api-keys) — `AQ...` or `AIzaSy...`)*
   - **Environments:** Production, Preview, Development
4. Open **Deployments** ➔ click **Redeploy** so the live serverless function picks up `GEMINI_API_KEY`.
5. Copy your live Vercel URL (`https://mydukaan-eta.vercel.app`), add that domain in **Firebase Console ➔ Authentication ➔ Settings ➔ Authorized domains**, then paste your `firebaseConfig` inside **`🔐 Login / Sign Up`** on the landing page (or **Settings ➔ Firebase Cloud Sync** inside `app.html`).

*(Alternatively via CLI: run `npx -y vercel --prod` from the project folder and set `GEMINI_API_KEY` via `vercel env add GEMINI_API_KEY`.)*

---

## 📱 A-to-Z Mobile Scaling & Responsiveness

Every view, modal, grid, and control across `index.html` and `app.html` is engineered for zero horizontal overflow from **320px** compact phones up to tablets and desktop monitors:

1. **Zero Grid & Flex Blowout (`320px`–`900px`):**
   - Applied `overflow-x: clip`, explicit `min-width: 0` across CSS Grid/Flex children, and responsive `minmax(min(100%, ...), 1fr)` track sizing across KPI cards, POS product grids, simulator shelves, comparison cards, and ROI stats.
   - Unified the responsive breakpoint at `<= 900px` with compact adaptations at `<= 600px`, `<= 440px`, and `<= 350px`.

2. **Collision-Free Mobile Topbar & Drawer:**
   - Desktop-only controls (`Counter #1 Active [F4]`, `Language Selector`, `Search items [Ctrl+K]`, and `Store Profile`) hide cleanly below `900px`.
   - The quick sale button automatically switches from `⚡ New Sale` to `⚡ Sale` on ultra-small screens (`<= 440px`) so the topbar never wraps or crowds out icons.
   - `Language Selector` (`English`, `हिन्दी`, `Hinglish`) and `Counter #1 • Cash Drawer (F4)` live inside the mobile slide-out drawer (`#app-sidebar`).

3. **Structured Layering & Theme-Aware Mobile Navigation:**
   - Clean z-index stack prevents overlapping drawers or obstructed taps: Sticky POS Cart Bar (`9980`) < Slide-Up POS Cart Drawer (`9985`) < Bottom Dock (`9990`) < Sidebar Drawer (`10005`–`10010`) < Scrollable Modals (`10020`) < Barcode Scanner (`10030`) < Toast Notifications (`10050`).
   - `.mobile-bottom-nav` dynamically matches both Dark and Light themes (`var(--bg-surface)`), and modals allow form bodies (`.modal-card > form`) to scroll naturally on short screens.
   - Removed the duplicate mobile sticky dock from `index.html` so landing page navigation stays unobstructed.

4. **Mobile-First Module Layouts:**
   - Secondary columns in Dashboard, Invoices, and Expenses tables use `.hide-mobile-col` so primary invoice, customer, and amount figures stay readable without squeezing.
   - Refactored Khata customer cards, Wholesale Purchase inward grids, Staff rows, Analytics valuation cards, Settings backup URLs, and Dukkan Copilot chat headers for clean vertical wrapping on narrow viewports.

---

## 🌐 Strict Online API Mode vs. Offline Local Mode

MyDukaan24 strictly separates **live cloud API execution** from **offline local execution** so cached or local heuristic data is never silently mixed into live API responses:

| System State | Connection Indicator | Dukkan Copilot AI (`/api/gemini`) | Barcode Vision & Auto-Fill |
| :--- | :--- | :--- | :--- |
| **🟢 Online** (`navigator.onLine === true`) | `Online • Live API Ready` | Calls live **Google Gemini Interactions API** exclusively with real-time store context. Never silently substitutes offline mock answers. On transient errors, shows exact HTTP diagnostics with Retry / `[🔑 Key]` / opt-in offline advisor button. | 1. Checks Store Inventory for exact SKU match.<br>2. Queries **Open Food Facts API**.<br>3. Queries live **Gemini API + Google Search Grounding** (`/api/gemini`) for exact product name, brand, category, MRP, price, cost, unit & emoji.<br>4. Shows explicit status rather than guessing fake details when online. |
| **🟠 Offline** (`navigator.onLine === false`) | `Offline • Local DB Mode` | Automatically switches to the **Inbuilt Local Retail Rule-Engine** (`Offline Mode • Local Advisor`) for low-stock alerts, Udhaar reminders, and business diagnostics. | Matches against the **85+ Inbuilt Indian FMCG Master DB** and decodes **GS1 India (`890...`) Manufacturer Prefix** with guaranteed local auto-fill — zero network dependency. |

---

## 🏷️ How to Turn Off the "Powered by Netlify" Floating Badge

If a Netlify preview or deployment floating badge overlaps bottom navigation controls on free plans, disable it directly from your Netlify Dashboard:

1. Open your [Netlify Dashboard](https://app.netlify.com).
2. Select your project: **`mydukaan24`**.
3. Go to **Project configuration** (or **Site configuration**) ➔ **General** ➔ **Site details**.
4. Scroll to the **Powered by Netlify badge** setting.
5. Click **Turn off** (or uncheck the option) and click **Save**.
6. Wait a moment for settings to sync — the badge is removed across all pages cleanly.

---

## ⚡ Core Modules & Platform Capabilities

### 1. High-Speed POS Billing Terminal
- Complete itemized invoice creation in **under 3 seconds**.
- Multi-tender settlement options:
  - **Cash:** Real-time change return calculator with rapid denomination buttons (`+₹100`, `+₹200`, `+₹500`, `Exact`).
  - **Dynamic UPI QR:** Generates instant scannable QR codes (`6306437348@upi`) for PhonePe, Google Pay, Paytm, and BHIM.
  - **Card POS & Digital Udhaar:** Direct ledger entry with customer validation.
- Real-time tax & discount engines: Subtotal, MRP discount savings, customizable GST rates (0%, 5%, 12%, 18%), and instant bill discounts (`%` or `₹`).
- Zero-latency Web Audio API synthesizer for supermarket laser scanner beeps and cash settlement chimes.
- Print-ready **80mm & 58mm thermal receipts** with instant 1-click WhatsApp digital invoice sharing.

### 2. Universal Barcode Vision & Cloud + Local Product Identification
- **Dual Camera Engine:** Combines bundled local `Html5Qrcode` (with 1D wide reticle optimization) + native browser `BarcodeDetector` API.
- **Hardware Scanner Gun Support:** Auto-detects USB/Bluetooth handheld barcode guns without requiring input field focus.
- **Online Live Enrichment:** Checks your store catalog, queries **Open Food Facts**, and runs **Gemini Google Search Grounding** via `/api/gemini` for strict live auto-fill (`barcode`, `name`, `brand`, `cat`, `mrp`, `price`, `cost`, `stock`, `unit`, `emoji`).
- **Offline Zero-Latency Lookup:** Uses **85+ Inbuilt Indian FMCG Master DB** + **GS1 India (`890...`) Manufacturer Prefix Resolver** whenever offline.

### 3. Wholesale Purchases & Supplier Ledger (`js/purchases.js`)
- Directory of wholesale suppliers/distributors with GSTIN, contact numbers, and payment terms.
- Record inward purchase invoices with **automatic inventory stock increment**.
- Supplier credit ledger to track dues owed to distributors and record payment vouchers, with CSV export.

### 4. Daily Cash Counter & Closing Register (Z-Report)
- Real-time cash drawer tally across Cash, UPI, Card payments, and Udhaar issued (`F4` shortcut).
- Print Day-End Z-Report closing sheet for daily book-keeping.

### 5. Digital Udhaar Khata (Customer Credit CRM)
- Customer profiles with purchase history, contact details, and outstanding balances.
- **1-Click WhatsApp Payment Reminders** with balance due and store UPI ID, plus real-time partial/full settlements.

### 6. Inventory & Stock Safety Control
- Catalog management with SKU, barcode lookup button (`.barcode-input-group`), cost price, MRP, selling price, and rounded inventory valuations (`Math.round`).
- Automated Low Stock & Out of Stock alerts, inline stock adjustments, Barcode generation, and CSV Import/Export.

### 7. Daily Expense Tracker & P&L Analytics (`js/analytics.js`)
- Track Rent, Electricity, Logistics, Staff Advances, Tea/Snacks, and Maintenance.
- Time range filters (`Today`, `Last 7 Days`, `This Month`, `All Time`), SVG sales trends, COGS breakdown, and real-time Net Profit calculation:
  $$\text{Net Profit} = \text{Gross Revenue} - \text{COGS} - \text{Operating Expenses}$$

### 8. Multilingual Engine (`js/i18n.js`)
- Instant live UI switching across **English**, **हिन्दी (Hindi)**, and **Hinglish** with `localStorage` persistence.

### 9. Dukkan Copilot AI (May 2026 Gemini Interactions API)
- **Serverless Proxy:** Client ➔ Vercel / Netlify Function (`/api/gemini`) ➔ `POST https://generativelanguage.googleapis.com/v1beta/interactions` (`Api-Revision: 2026-05-20`, `x-goog-api-key`).
- **Model Cascade:** `gemini-3.8-flash` ➔ `gemini-3.6-flash` ➔ `gemini-2.5-flash`.
- **Live Store Grounding:** Dynamically passes live SKU levels, low-stock items, pending Udhaar balances, and store totals on every online request.
- **Per-Browser Override:** Click **`🔑 Key`** in the Copilot header anytime to configure a custom key without editing server settings.

---

## 🔑 How to Setup Gemini API Key on Vercel / Netlify (Step-by-Step)

> [!IMPORTANT]
> **Supported Key Formats:** MyDukkan24 supports **both** current Google AI Studio key formats starting with **`AQ...`** and **`AIzaSy...`** created at [`aistudio.google.com/api-keys`](https://aistudio.google.com/api-keys). Never commit keys into source files or share screenshots containing active keys (if exposed, revoke and create a new key immediately).

### Step 1: Create Your Gemini API Key
1. Open [Google AI Studio API Keys](https://aistudio.google.com/api-keys).
2. Sign in with your Google account and click **Create API key**.
3. Copy the newly generated key (`AQ...` or `AIzaSy...`).

### Step 2: Add Environment Variable
- **On Vercel:**
  1. Open your project in [Vercel Dashboard](https://vercel.com/dashboard) ➔ **Settings** ➔ **Environment Variables**.
  2. Add Key **`GEMINI_API_KEY`**, paste your key as **Value**, select **Production / Preview / Development**, and click **Save**.
  3. Open **Deployments** ➔ **Redeploy** so the serverless `/api/gemini` endpoint receives the updated variable.
- **On Netlify:**
  1. Open **`mydukaan24`** in [Netlify Dashboard](https://app.netlify.com) ➔ **Project configuration** ➔ **Environment variables**.
  2. Add Key **`GEMINI_API_KEY`**, paste your key for all scopes, click **Create variable**, then click **Deploys** ➔ **Trigger deploy** ➔ **Deploy project without cache**.

*(Alternatively, for quick browser-only testing inside the app, click **`🔑 Key`** in Dukkan Copilot to store a local key on that device.)*

---

## 🛠️ Tech Stack
- **Frontend:** Pure HTML5, Vanilla ES6+ Modular JavaScript, Custom Responsive CSS.
- **Design System:** Deep Obsidian Slate (`#070913`), High-Contrast Solid Cards (`#131A2D`), Light/Dark Mode CSS Variables, Inter + JetBrains Mono.
- **Icon Engine:** Zero-overhead Inline SVG Icon Library (`js/icons.js`).
- **Offline Storage:** Inbuilt `localStorage` Database (`js/storage.js`) with item/meta diff queue, JSON Backup & CSV Import/Export.
- **Cloud Sync & Auth:** Dynamic Firebase SDK (`11.6.0` ESM) with Google Sign-In + Email/Password Auth and **Cloud Firestore Standard Edition** (`persistentLocalCache` multi-tab IndexedDB + `/users/{uid}/` real-time sync).
- **Serverless API:** Vercel Functions (`api/gemini.js`) & Netlify Functions (`netlify/functions/gemini.js`) targeting the Gemini Interactions API (`v1beta/interactions`).
- **PWA Caching:** Service Worker `v8.2` (`sw.js`) with strict Network-First same-origin caching (bypassing `/api/*` and cross-origin SDK/API calls).

---

## 📁 Repository Structure
```
MyDukaan-v4/
├── api/
│   └── gemini.js             # Vercel Serverless Gemini Interactions API + Search Grounding
├── assets/
│   ├── LOGO.jpeg             # Official MyDukkan24 logo
│   ├── logo.svg              # Vector logo fallback
│   └── MyDukkan24-v4.apk     # Android APK download package
├── css/
│   ├── landing.css           # Responsive SaaS landing page + Auth Modal styles (v8.2)
│   ├── style.css             # Core app theme variables, modals, z-index & mobile layout (v8.2)
│   └── components.css        # POS terminal, khata cards, scanner & responsive components (v8.2)
├── js/
│   ├── html5-qrcode.min.js   # Bundled local barcode vision engine
│   ├── icons.js              # Centralized SVG icon library
│   ├── i18n.js               # Multi-language translation engine (EN, HI, Hinglish)
│   ├── storage.js            # Inbuilt local database, sync queue & Web Audio synthesizer
│   ├── firebase-sync.js      # Hybrid Offline-First + Firestore real-time cloud sync (v8.2)
│   ├── scanner.js            # Strict Online/Offline barcode scanner & FMCG resolver
│   ├── pos.js                # High-speed POS billing & checkout engine
│   ├── inventory.js          # Product catalog & stock safety control
│   ├── purchases.js          # Wholesale purchases & supplier ledger
│   ├── khata.js              # Customer ledger & Udhaar CRM
│   ├── analytics.js          # Profit & Loss calculations and financial charts
│   ├── staff.js              # Employee directory & 31-day attendance
│   ├── ai.js                 # Dukkan Copilot AI (Strict Online vs. Offline rule-engine)
│   └── app.js                # Master application router, network monitor & views
├── netlify/
│   └── functions/
│       └── gemini.js         # Netlify Serverless Gemini Interactions API proxy
├── .env.example              # Environment variables template
├── _redirects                # Netlify SPA routing rules
├── app.html                  # Main retail business OS terminal (v8.2)
├── firebase.json             # Firebase Firestore rules & indexes project config
├── firestore.indexes.json    # Firestore composite index configuration
├── firestore.rules           # Strict per-user (/users/{uid}/) Firestore security rules
├── index.html                # Responsive landing page, Login/Sign Up modal & POS simulator (v8.2)
├── manifest.json             # PWA metadata & shortcut configuration
├── netlify.toml              # Netlify build & cache configuration
├── README.md                 # Complete system documentation (v8.2)
├── sw.js                     # Network-First PWA service worker v8.2
└── vercel.json               # Vercel rewrites & cache configuration
```

---

## 📄 License & Attribution
- **Author:** Mayur Singh (Lucknow, India)
- **Official Contact:** +91 6306437348
- **Copyright:** © 2026 Mayur Singh. All rights reserved.
- **Supported Hosting:** Vercel & Netlify ([https://mydukaan24.netlify.app/](https://mydukaan24.netlify.app/))
