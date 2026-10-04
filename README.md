# ⚡ MyDukaan24 — Modern Retail Business OS

> **Run Your Shop Smarter with MyDukaan24**  
> A startup-ready digital platform built for Indian local retail shops, Kirana stores, and small businesses.  
> **Created & Deployed by Mayur Singh (Lucknow, India)** 🇮🇳

---

## 🌟 What is MyDukaan24?

**MyDukaan24** is an offline-capable, startup-grade Business OS and Point-of-Sale (POS) terminal designed specifically to eliminate manual paper notebooks, unrecorded customer credit (Udhaar), slow billing queues, and stockouts for retail shopkeepers in India.

It combines high-speed camera barcode scanning, instant digital invoicing with thermal printer and WhatsApp sharing support, a dedicated customer Udhaar ledger, interactive employee attendance tracking, real-time financial P&L analytics, and a conversational AI business consultant powered by Google Gemini 3.8 Flash.

---

## ✨ Features

### 1. ⚡ High-Speed POS Billing Terminal
- Generate complete itemized invoices in under 5 seconds.
- Multi-mode tender support: Cash (with automatic change return calculator), UPI (with shop UPI QR link), Card, and Udhaar (Credit).
- Live cart calculations with custom discounts (% or ₹) and configurable GST tax rates.
- Audio checkout feedback using the HTML5 Web Audio API (realistic cash register chime).

### 2. 📷 Barcode Vision & MRP Detector
- High-speed camera scanner using the native `BarcodeDetector` API.
- USB and Bluetooth hardware barcode scanner gun listener (handles rapid keyboard keystrokes ending in `Enter`).
- Auto-detects product name, MRP (₹), discounted selling price (₹), and remaining stock quantity.
- One-tap "➕ Add to Bill" or "✏️ Register New Barcode".

### 3. 📦 Inventory & Stock Control
- Master catalog with EAN-13 barcodes, categories, cost price, MRP, and selling price.
- Live safety threshold tracking with automatic low stock and out-of-stock alert banners.
- Quick restock modal and profit margin indicators per item.

### 4. 📒 Customer Udhaar Khata (Credit Ledger)
- Digital ledger tracking individual customer credit dues, purchase history, and loyalty reward tiers (Bronze, Silver, Gold).
- One-click polite WhatsApp payment reminder generator pre-filled with the customer's balance and your shop UPI ID.
- Cash/UPI due payment recording modal that updates customer balance in real time.

### 5. 🧾 Thermal Receipts & WhatsApp Invoices
- Print-ready 80mm standard thermal receipts with store header, itemized breakdown, and tax.
- Instant WhatsApp invoice share links pre-formatted with item details and payment confirmation.

### 6. 👔 Employee Directory & 31-Day Attendance
- Team roster for store helpers, billing cashiers, and delivery staff with contact and salary records.
- Interactive 31-day monthly attendance grid: Click any date to cycle between Present (Green), Half-Day (Yellow), and Absent (Red).
- Real-time monthly payroll calculation.

### 7. 📈 Financial Analytics & Profit/Loss Statement
- Real SVG weekly revenue trend chart.
- Real-time Cost of Goods Sold (COGS) and Operating Expenses category breakdown (Rent, Utilities, Salary, Logistics).
- Net take-home profit margin calculation.

### 8. ✨ MyDukaan24 AI — Real Online AI Business Advisor
- Powered by **Google Gemini 3.8 Flash**.
- Real-time online responses with live store context grounding (feeds inventory, low-stock items, top debtors, and sales figures into context).
- Answers questions like:
  - *"Which products are low in stock and need reordering?"*
  - *"Who owes me the most in pending Udhaar?"*
  - *"How can I increase my profit margin this month?"*
  - *"Draft a polite WhatsApp payment reminder for customers."*
- Full chat history, copy response button, typing indicator, and retry handling.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend UI** | Modern Vanilla HTML5, CSS3 Custom Properties (Design System), Modular ES6+ JavaScript |
| **Typography** | `Plus Jakarta Sans` & `JetBrains Mono` |
| **Icons & Audio** | Native SVG System & Web Audio API Sound Synthesizer |
| **Database** | Inbuilt Browser Local Database Engine (`localStorage` / `IndexedDB`), 100% Offline & Private |
| **Vision AI** | Native HTML5 `BarcodeDetector` API + MediaDevices Camera Stream |
| **Generative AI** | Google Gemini 3.8 Flash (`gemini-3.8-flash`) |
| **Backend / API** | Netlify Serverless Functions (`netlify/functions/gemini.js`) |
| **Deployment** | Netlify Production Hosting with Continuous Deployment from GitHub |

---

## 🏗️ Architecture

```
Client (Browser)
   │
   ├── Local UI Controller (app.js, pos.js, inventory.js, khata.js, analytics.js)
   │      │
   │      └── Inbuilt Database Engine (storage.js) [100% Offline, Zero Latency]
   │
   └── AI Advisor Component (ai.js)
          │
          ├── [Production Route] ──> POST /api/gemini (Netlify Serverless Function)
          │                                 │
          │                                 └──> Google Gemini 3.8 Flash API
          │
          └── [Local / Standalone Route] ──> Direct Google AI Studio REST with User Key
```

---

## 📁 Project Structure

```
MyDukaan24/
├── index.html                 ← Modern SaaS Landing Page
├── app.html                   ← Full MyDukaan24 POS & Business OS Application
├── manifest.json              ← Progressive Web App (PWA) Manifest
├── sw.js                      ← Offline Service Worker
├── netlify.toml               ← Netlify Build & Functions Configuration
├── _redirects                 ← Netlify SPA Routing Rules
├── .env.example               ← Example Environment Configuration
├── README.md                  ← Comprehensive Documentation
├── netlify/
│   └── functions/
│       └── gemini.js          ← Secure Serverless Backend for Gemini 3.8 Flash
├── css/
│   ├── style.css              ← Design System, Layout, & Dual Theme Engine
│   ├── components.css         ← POS Grid, Barcode Reticle, Modals, Empty States
│   └── landing.css            ← SaaS Landing Page Stylesheet
└── js/
    ├── storage.js             ← Inbuilt Local Database & Audio Synthesizer
    ├── scanner.js             ← Camera & Hardware Barcode Vision Engine
    ├── pos.js                 ← Quick Billing, Cart Calculations, Receipts
    ├── inventory.js           ← Product Catalog & Stock Threshold Management
    ├── khata.js               ← Customer Ledger & WhatsApp Due Reminders
    ├── analytics.js           ← SVG Financial Graphs & P&L Statement
    ├── staff.js               ← Staff Directory & Daily Attendance Grid
    ├── ai.js                  ← Real Online Gemini 3.8 Flash AI Engine
    └── app.js                 ← Master Router, Contextual Actions & Settings
```

---

## ⚙️ Inbuilt Database Setup

MyDukaan24 uses an **inbuilt, zero-setup local database engine**.
- **No external database server or cloud connection required** for core store operations.
- **100% Private**: Your financial data, customer phone numbers, and profit margins never leave your device.
- **Instant Speed**: Zero network latency during checkout.
- **Export & Backup**: One-click export to CSV for Tally/Excel or full JSON backup file from the Settings tab.

---

## 🔑 AI Setup (Gemini 3.8 Flash)

MyDukaan24 connects to Google's official `gemini-3.8-flash` model:

1. **Option A (In-App Entry — Recommended)**:
   - Open MyDukaan24 → Click **✨ MyDukaan AI** or open **Settings**.
   - Paste your free Gemini API key from [aistudio.google.com](https://aistudio.google.com).
   - Click **Save & Activate**.

2. **Option B (Serverless Environment Variable on Netlify)**:
   - In your Netlify dashboard: **Site configuration → Environment variables**.
   - Add: `GEMINI_API_KEY = your_key_here`.
   - The backend serverless function `/api/gemini` will automatically read this key.

---

## 🚀 Local Development

Since MyDukaan24 is built with clean vanilla web standards:

1. Clone the repository:
   ```bash
   git clone https://github.com/mayursingh24/MyDukaan.git
   cd MyDukaan
   ```
2. Open in your browser:
   - Double click `index.html` (Landing Page) or `app.html` (Application).
   - Or serve with any static web server:
     ```bash
     npx serve .
     # or
     python -m http.server 8080
     ```

---

## 🌐 Production Deployment

The project is configured for seamless deployment on **Netlify**:

1. Push your repository to GitHub (`main` branch).
2. Link the repository in Netlify.
3. Build settings:
   - **Publish directory**: `.`
   - **Functions directory**: `netlify/functions`
4. Set `GEMINI_API_KEY` in Netlify Environment Variables if using the serverless route.
5. The `netlify.toml` and `_redirects` files automatically configure routing, caching, and serverless proxying.

---

## 🔄 Complete User Workflow

```
Landing Page (index.html)
   ↓
Click "Get Started"
   ↓
Shop Setup & Profile in Settings
   ↓
Overview Dashboard (Review Today's Sales, Low Stock, Pending Udhaar)
   ↓
Add Products or Scan Barcodes in Inventory
   ↓
Open Quick Billing POS (Scan Barcodes → Auto-Detect MRP → Live Cart)
   ↓
Complete Checkout (Cash, UPI QR, or Udhaar)
   ↓
Print 80mm Thermal Receipt or Share Bill via WhatsApp
   ↓
Manage Customer Ledger in Udhaar Khata (Send WhatsApp Payment Reminders)
   ↓
Mark Staff Daily Attendance & Review Payroll
   ↓
View Analytics & Net Profit in Analytics
   ↓
Ask MyDukaan24 AI for Inventory, Margin, or Debt Recovery Advice
```

---

## 🔮 Future Improvements

- Multi-terminal local network sync via WebRTC peer-to-peer.
- Voice-enabled billing ("2 packets of milk and 1 bread").
- Direct thermal Bluetooth printer integration via Web Bluetooth API.
- Automated GST quarterly filing export.

---

## 👨‍💻 Developer Profile

- **Developer**: **Mayur Singh**
- **Location**: Lucknow, India
- **Email**: [mayur4singhhh@gmail.com](mailto:mayur4singhhh@gmail.com)
- **Instagram**: [@_mayur.x24](https://instagram.com/_mayur.x24)
- **LinkedIn**: [mayursingh24](https://linkedin.com/in/mayursingh24)
- **GitHub**: [@mayursingh24](https://github.com/mayursingh24)

---

*Designed and deployed with pride for Indian local businesses 🇮🇳*
