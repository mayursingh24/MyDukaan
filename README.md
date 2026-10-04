# ⚡ MyDukaan Pro — Retail Business OS

> **The Modern Business OS for Indian Retailers & Kirana Stores**  
> **Created & Deployed by Mayur Singh** 🇮🇳

---

## 🌟 Highlights & Architecture

- **⚡ High-Speed POS Terminal**: Instant bill creation in under 5 seconds with cash change calculation, UPI QR, and WhatsApp itemized receipt generator.
- **📷 Barcode Vision & MRP Detector**: Real camera scanner (`BarcodeDetector` API) + hardware USB scanner listener. Instantly detects product, MRP, and discounted price.
- **📒 Customer Udhaar Khata**: Ledger tracking with one-click automated WhatsApp payment reminder link.
- **✨ Gemini 3.8 Flash Dukaan AI**: Smart conversational retail assistant with offline intelligent fallback responses.
- **📊 Financial Analytics & P&L**: Live SVG weekly revenue charts, operating expenses category breakdown, and net profit margins.
- **👔 Staff Attendance**: Interactive 31-day daily register with monthly payroll estimator.
- **💾 100% Offline LocalStorage**: Never loses data. Complete JSON backup & CSV export for Excel.
- **🚀 Netlify Ready**: Built-in `netlify.toml` and `_redirects` configuration.

---

## 📁 Modular File Structure

```
C:\MyDukaan-v4\
├── index.html            ← Modern SaaS Landing Page
├── app.html              ← Full MyDukaan Pro POS & ERP Terminal
├── manifest.json         ← PWA Install Configuration
├── sw.js                 ← Offline Service Worker
├── netlify.toml          ← Netlify Deployment Configuration
├── _redirects            ← Netlify SPA Routing Rules
├── css/
│   ├── style.css         ← Global Design System & Theme Engine
│   ├── components.css    ← POS, Barcode Reticle, Modal & Receipt Styles
│   └── landing.css       ← Landing Page Stylesheet
└── js/
    ├── storage.js        ← LocalStorage DB & Web Audio Sound Engine
    ├── scanner.js        ← Camera & Hardware Barcode Vision Engine
    ├── pos.js            ← POS Billing, Live Cart & WhatsApp Invoicing
    ├── inventory.js      ← Product Management & Stock Alerts
    ├── khata.js          ← Udhaar Ledger & WhatsApp Due Reminders
    ├── analytics.js      ← SVG Charts, Profit & Loss Statements
    ├── staff.js          ← Staff Directory & Daily Attendance Grid
    ├── ai.js             ← Gemini 3.8 Flash Retail Brain
    └── app.js            ← Master UI Router & Event Controller
```

---

## 👨‍💻 Created & Deployed by Mayur Singh

- **Developer**: Mayur Singh
- **GitHub**: [@mayursingh24](https://github.com/mayursingh24)
- **Deployment Platform**: Netlify
