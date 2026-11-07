# MyDukkan24 — Enterprise Retail OS & Smart POS

![MyDukkan24 Status](https://img.shields.io/badge/MyDukkan24-v4.0%20Production-2563EB?style=for-the-badge&logo=shopify&logoColor=white)
![Platform](https://img.shields.io/badge/Platform-100%25%20Offline%20First%20PWA-10B981?style=for-the-badge&logo=pwa&logoColor=white)
![AI Engine](https://img.shields.io/badge/AI%20Copilot-Google%20Gemini%20via%20Netlify-3B82F6?style=for-the-badge&logo=google&logoColor=white)
![Deployment](https://img.shields.io/badge/Deploy-Netlify%20Serverless-00C7B7?style=for-the-badge&logo=netlify&logoColor=white)

> **"Run Your Shop with Enterprise Precision."**  
> A commercially ready retail operating system & POS terminal engineered for Indian Kirana stores, supermarkets, and local businesses.

---

## 📖 Key Modules & Features

### 1. High-Speed POS Billing Terminal
- Generate complete itemized invoices in **under 5 seconds**.
- Multi-mode payment tenders:
  - **Cash:** Live change-return calculator with rapid tender denomination buttons (`+₹100`, `+₹200`, `+₹500`, `+₹2000`, `Exact`).
  - **Dynamic UPI QR:** Generates instant scannable QR codes for PhonePe, Google Pay, and Paytm.
  - **Card & Udhaar (Customer Credit):** Direct ledger entry with auto customer verification.
- Real-time cart calculations: Subtotal, MRP discount savings, customizable GST tax rates, and instant bill discounts (% or ₹).
- Zero-latency audio feedback via the Web Audio API with supermarket scanner beeps and cash register chimes.
- Print-ready **80mm standard thermal receipts** and instant 1-click WhatsApp digital invoice sharing.

### 2. Universal Barcode Scanner & Vision
- **Cross-Browser Camera Scanning:** Dual engine using `Html5Qrcode` + native browser `BarcodeDetector` API.
- **Hardware Scanner Gun Support:** Global keyboard event listener that auto-detects USB/Bluetooth handheld barcode guns without requiring input focus.
- Recognizes EAN-13, EAN-8, Code-128, Code-39, and QR codes.
- Shortcut: Press `Ctrl + K` anywhere in the app to open the scanner.

### 3. Inventory & Safety Stock Control
- Full product catalog with SKU, category, cost price, MRP, selling price, and profit margins.
- Automated safety stock alerts: Contextual indicators for **Low Stock** and **Out of Stock** items.
- Quick 1-click inline restock adjustments.
- Instant SKU/Barcode generator.

### 4. Digital Udhaar Khata (Credit Ledger)
- Digital ledger tracking individual customer credit dues, purchase history, and loyalty reward tiers (Bronze, Silver, Gold).
- **1-Click WhatsApp Payment Reminders:** Pre-formatted message with exact balance due and shop UPI ID.
- Cash/UPI debt settlement modal updating customer balance in real time.

### 5. Daily Expense Management
- Record and categorize daily store expenses (Shop Rent, Electricity & Utilities, Logistics, Staff Advance, Maintenance, Tea/Snacks).
- Monthly expense totals integrated into overall Net Profit calculations.

### 6. Reports & Analytics (Profit & Loss)
- Time range filtering: Today, Last 7 Days, Last 30 Days, All Time.
- Interactive SVG revenue trend chart.
- Real-time Cost of Goods Sold (COGS) and Operating Expenses breakdown.
- **Net Take-Home Profit Margin Calculation:**
  $$\text{Net Profit} = \text{Gross Revenue} - \text{COGS} - \text{Operating Expenses}$$
- Top-selling products and slow-moving / zero-sale inventory review.
- Total inventory valuation (Procurement cost vs retail realization).

### 7. Staff & 31-Day Attendance Calendar
- Staff directory for store helpers, cashiers, and delivery staff with contact and salary records.
- Interactive 31-day monthly attendance grid: Click any date to cycle between **Present (Green)**, **Half-Day (Yellow)**, and **Absent (Red)**.
- Automated monthly payroll estimations based on attendance.

### 8. Dukkan Copilot AI (Google Gemini via Netlify)
- Secure Serverless Architecture: Client -> Netlify Functions (`/api/gemini`) -> Google Gemini API.
- **Zero Client-Side Key Exposure:** Reads strictly from Netlify Environment Variables (`GEMINI_API_KEY`).
- Live context grounding: Real-time inventory status, low-stock items, top debtors, and sales numbers are dynamically provided to the model.

---

## 🛠️ Tech Stack & Architecture

- **Frontend:** Pure HTML5, Modern CSS (Inter & JetBrains Mono), Modular Vanilla ES6+ JavaScript.
- **Icon System:** Custom Lucide/Feather inline SVG icon library (`js/icons.js`) for zero-latency, high-resolution rendering without external icon fonts.
- **Database:** Inbuilt Zero-Latency Local Database (`localStorage`) with full JSON backup & CSV export capabilities.
- **Backend:** Netlify Functions (`netlify/functions/gemini.js`) for secure serverless API proxying.
- **PWA:** 100% Offline-capable Service Worker (`sw.js`) and manifest configuration.

---

## 📁 File Structure

```
MyDukkan-v4/
├── assets/
│   ├── logo.svg              # Official MyDukkan24 vector logo
│   └── logo.png              # Official MyDukkan24 raster logo
├── css/
│   ├── style.css             # Core design system & theme variables
│   ├── components.css        # POS terminal, modals, and responsive layout
│   └── landing.css           # Landing page styles
├── js/
│   ├── icons.js              # Centralized Lucide SVG icon library
│   ├── storage.js            # Inbuilt local database engine & Web Audio synthesizer
│   ├── scanner.js            # Hardware & camera barcode vision engine
│   ├── pos.js                # POS billing terminal & checkout cart
│   ├── inventory.js          # Catalog & stock management engine
│   ├── khata.js              # Customer ledger & Udhaar CRM
│   ├── analytics.js          # Financial reports & P&L calculations
│   ├── staff.js              # Employee directory & 31-day attendance
│   ├── ai.js                 # Dukkan Copilot AI assistant
│   └── app.js                # Master application router & executive views
├── netlify/
│   └── functions/
│       └── gemini.js         # Secure serverless backend proxy
├── .env.example              # Environment variables template
├── _redirects                # Netlify routing rules
├── app.html                  # Main retail business OS terminal
├── index.html                # Product landing page & interactive showcase
├── manifest.json             # PWA metadata & shortcut configuration
├── netlify.toml              # Netlify build & cache configuration
├── README.md                 # Complete documentation
└── sw.js                     # Offline caching service worker
```

---

## 🌐 Netlify Production Deployment

1. **Deploy to Netlify:**
   - Link your GitHub repository to Netlify.
   - Build command: *(leave empty or default)*
   - Publish directory: `.`
   - Functions directory: `netlify/functions`
2. **Configure Environment Variables:**
   - Go to **Site Configuration → Environment Variables**.
   - Add: `GEMINI_API_KEY` = *your Google Gemini API key from [aistudio.google.com](https://aistudio.google.com)*.
3. The serverless function `/api/gemini` will securely manage AI requests without exposing your credentials to the browser.
