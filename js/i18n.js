/**
 * MyDukkan24 — Internationalization (i18n) Engine
 * Supported Languages: English (en), Hindi (hi), Hinglish (hinglish)
 * Created & Deployed by Mayur Singh
 */

const I18N_DICTIONARIES = {
  en: {
    // Topbar & Navigation
    app_title: "MyDukkan24",
    nav_dashboard: "Dashboard",
    nav_pos: "POS Billing",
    nav_inventory: "Products & Stock",
    nav_purchases: "Wholesale Purchases",
    nav_khata: "Customers & Khata",
    nav_invoices: "Sales Ledger",
    nav_expenses: "Expense Tracker",
    nav_analytics: "Reports & P&L",
    nav_staff: "Staff & Payroll",
    nav_settings: "Store Settings",
    nav_help: "Terminal Help",
    nav_download: "Download App",
    search_placeholder: "Search items, SKU or barcode...",
    scan_barcode_btn: "Scan Barcode",

    // Dashboard KPIs
    kpi_today_sales: "Today's Gross Sales",
    kpi_monthly_rev: "This Month Revenue",
    kpi_low_stock: "Low Stock Warning",
    kpi_pending_udhaar: "Pending Customer Udhaar",
    kpi_stock_value: "Inventory Asset Value",
    kpi_est_profit: "Estimated Net Margin",
    recent_transactions: "Recent Billing Transactions",
    low_stock_reorder: "Urgent Stock Reorder List",
    quick_operations: "Quick Operations",

    // Quick Actions
    btn_new_sale: "Fast POS Billing",
    btn_new_product: "New Product",
    btn_new_customer: "Add Customer",
    btn_add_expense: "Record Expense",
    btn_new_purchase: "Supplier Inward",
    btn_ask_copilot: "Ask Copilot AI",

    // POS Billing
    pos_catalog: "Kirana Product Catalog",
    pos_all_cats: "All Categories",
    pos_cart_title: "Customer Bill",
    pos_customer_select: "Customer / Walking Buyer",
    pos_subtotal: "Items Subtotal",
    pos_discount: "Discount Savings",
    pos_tax: "GST Output Tax",
    pos_grand_total: "Grand Total Payable",
    pos_pay_cash: "Cash Settlement",
    pos_pay_upi: "Dynamic UPI QR",
    pos_pay_due: "Add to Udhaar Khata",
    pos_print_slip: "Print Thermal Slip",
    pos_share_wa: "Send via WhatsApp",

    // Inventory
    inv_title: "Inventory & Catalog Master",
    inv_subtitle: "Manage product retail prices, wholesale costs, barcodes, and reorder levels",
    inv_th_prod: "Product Name",
    inv_th_cat: "Category",
    inv_th_barcode: "Barcode / EAN",
    inv_th_price: "Retail Price",
    inv_th_mrp: "MRP",
    inv_th_cost: "Wholesale Cost",
    inv_th_stock: "Available Stock",
    inv_th_actions: "Actions",

    // Purchases & Suppliers
    pur_title: "Wholesale Purchases & Supplier Ledger",
    pur_subtitle: "Record vendor inventory deliveries, wholesale bills, and outstanding supplier payables",
    pur_btn_new_supplier: "Add Supplier",
    pur_btn_inward_bill: "Record Supplier Bill",

    // Khata
    khata_title: "Customer Digital Udhaar Khata",
    khata_subtitle: "Track customer credit balances, payment histories, and automated WhatsApp payment links",
    khata_th_customer: "Customer",
    khata_th_phone: "Phone Number",
    khata_th_due: "Pending Balance",
    khata_th_spent: "Total Purchased",
    khata_btn_give_credit: "+ Give Udhaar",
    khata_btn_receive_payment: "✓ Receive Jama",
    khata_btn_send_reminder: "WhatsApp Reminder",

    // Expenses
    exp_title: "Operating Expenses Ledger",
    exp_subtitle: "Record shop rent, electricity, logistics, staff tea, and operating overheads",

    // Analytics
    analytics_title: "Business Intelligence & Profit/Loss",
    analytics_subtitle: "Track revenue velocity, gross margins, and top/slow moving products",

    // Common
    btn_save: "Save Changes",
    btn_cancel: "Cancel",
    btn_edit: "Edit",
    btn_delete: "Delete",
    btn_restock: "+ Stock",
    offline_badge: "100% Offline Ready"
  },

  hi: {
    // Topbar & Navigation
    app_title: "मायदूकान24",
    nav_dashboard: "डैशबोर्ड",
    nav_pos: "पीओएस बिलिंग",
    nav_inventory: "सामान और स्टॉक",
    nav_purchases: "थोक खरीदारी",
    nav_khata: "ग्राहक और उधार खाता",
    nav_invoices: "बिक्री खाता",
    nav_expenses: "दुकान का खर्च",
    nav_analytics: "मुनाफा और रिपोर्ट",
    nav_staff: "स्टाफ और हाजिरी",
    nav_settings: "दुकान सेटिंग्स",
    nav_help: "टर्मिनल गाइड",
    nav_download: "ऐप डाउनलोड करें",
    search_placeholder: "सामान का नाम या बारकोड खोजें...",
    scan_barcode_btn: "बारकोड स्कैन करें",

    // Dashboard KPIs
    kpi_today_sales: "आज की कुल बिक्री",
    kpi_monthly_rev: "इस महीने की कमाई",
    kpi_low_stock: "कम स्टॉक चेतावनी",
    kpi_pending_udhaar: "बाकी ग्राहक उधार",
    kpi_stock_value: "कुल स्टॉक कीमत",
    kpi_est_profit: "अनुमानित शुद्ध मुनाफा",
    recent_transactions: "हालिया बिलिंग लेन-देन",
    low_stock_reorder: "तुरंत मंगाने योग्य सामान",
    quick_operations: "त्वरित कार्य",

    // Quick Actions
    btn_new_sale: "नया बिल बनाएं",
    btn_new_product: "नया सामान जोड़ें",
    btn_new_customer: "नया ग्राहक",
    btn_add_expense: "खर्च दर्ज करें",
    btn_new_purchase: "थोक माल आमद",
    btn_ask_copilot: "एआई से पूछें",

    // POS Billing
    pos_catalog: "दुकान सामान सूची",
    pos_all_cats: "सभी श्रेणियां",
    pos_cart_title: "ग्राहक का बिल",
    pos_customer_select: "ग्राहक चुनें",
    pos_subtotal: "कुल योग",
    pos_discount: "ग्राहक बचत",
    pos_tax: "जीएसटी टैक्स",
    pos_grand_total: "अंतिम देय राशि",
    pos_pay_cash: "नकद भुगतान",
    pos_pay_upi: "यूपीआई क्यूआर (UPI)",
    pos_pay_due: "उधार खाते में लिखें",
    pos_print_slip: "थर्मल पर्ची प्रिंट",
    pos_share_wa: "व्हाट्सएप पर भेजें",

    // Inventory
    inv_title: "स्टॉक और माल प्रबंधन",
    inv_subtitle: "बिक्री मूल्य, थोक खरीद रेट, बारकोड और न्यूनतम स्टॉक सीमा प्रबंधित करें",
    inv_th_prod: "सामान का नाम",
    inv_th_cat: "श्रेणी",
    inv_th_barcode: "बारकोड",
    inv_th_price: "बिक्री दर",
    inv_th_mrp: "एमआरपी (MRP)",
    inv_th_cost: "खरीद दर",
    inv_th_stock: "उपलब्ध मात्रा",
    inv_th_actions: "विकल्प",

    // Purchases & Suppliers
    pur_title: "थोक खरीद और सप्लायर खाता",
    pur_subtitle: "थोक विक्रेताओं से आए माल के बिल और बकाया भुगतान ट्रैक करें",
    pur_btn_new_supplier: "नया सप्लायर",
    pur_btn_inward_bill: "खरीद बिल जोड़ें",

    // Khata
    khata_title: "डिजिटल ग्राहक उधार खाता",
    khata_subtitle: "उधार का हिसाब रखें और व्हाट्सएप पर 1-क्लिक पेमेंट रिमाइंडर भेजें",
    khata_th_customer: "ग्राहक",
    khata_th_phone: "मोबाइल नंबर",
    khata_th_due: "बाकी उधार",
    khata_th_spent: "कुल खरीदारी",
    khata_btn_give_credit: "+ उधार दें",
    khata_btn_receive_payment: "✓ जमा करें",
    khata_btn_send_reminder: "व्हाट्सएप तगादा",

    // Expenses
    exp_title: "दुकान के दैनिक खर्चे",
    exp_subtitle: "किराया, बिजली, चाय-नाश्ता, पल्लेदारी और अन्य खर्चे दर्ज करें",

    // Analytics
    analytics_title: "व्यापार रिपोर्ट और नफा-नुकसान",
    analytics_subtitle: "दैनिक बिक्री रुझान, शुद्ध मुनाफा और सबसे ज्यादा बिकने वाला माल देखें",

    // Common
    btn_save: "सेव करें",
    btn_cancel: "रद्द करें",
    btn_edit: "बदलें",
    btn_delete: "हटाएं",
    btn_restock: "+ स्टॉक जोड़ें",
    offline_badge: "बिना इंटरनेट (100% ऑफलाइन)"
  },

  hinglish: {
    // Topbar & Navigation
    app_title: "MyDukkan24",
    nav_dashboard: "Dashboard",
    nav_pos: "POS Billing",
    nav_inventory: "Samaan & Stock",
    nav_purchases: "Wholesale Kharidi",
    nav_khata: "Customer Udhaar Khata",
    nav_invoices: "Sales Ledger",
    nav_expenses: "Dukaan Kharcha",
    nav_analytics: "Munafa & Reports",
    nav_staff: "Staff & Haaziri",
    nav_settings: "Dukaan Settings",
    nav_help: "Terminal Help",
    nav_download: "Download App",
    search_placeholder: "Item name ya barcode search karein...",
    scan_barcode_btn: "Barcode Scan",

    // Dashboard KPIs
    kpi_today_sales: "Aaj Ki Gross Bikri",
    kpi_monthly_rev: "Is Mahine Ki Earning",
    kpi_low_stock: "Khatam Hone Wala Stock",
    kpi_pending_udhaar: "Baki Customer Udhaar",
    kpi_stock_value: "Total Dukaan Stock Value",
    kpi_est_profit: "Net Profit Margin",
    recent_transactions: "Recent Billing Transactions",
    low_stock_reorder: "Jaldi Mangane Wala Samaan",
    quick_operations: "Fast Shortcuts",

    // Quick Actions
    btn_new_sale: "Naya Bill Banayein",
    btn_new_product: "Naya Item Add Karein",
    btn_new_customer: "Naya Customer",
    btn_add_expense: "Kharcha Dalein",
    btn_new_purchase: "Wholesale Bill Add",
    btn_ask_copilot: "AI Copilot Se Puchein",

    // POS Billing
    pos_catalog: "Dukaan Items List",
    pos_all_cats: "All Categories",
    pos_cart_title: "Grahak Ka Bill",
    pos_customer_select: "Customer Select Karein",
    pos_subtotal: "Samaan Ka Total",
    pos_discount: "Discount Bachat",
    pos_tax: "GST Tax",
    pos_grand_total: "Final Pay Amount",
    pos_pay_cash: "Cash Payment",
    pos_pay_upi: "Dynamic UPI QR",
    pos_pay_due: "Udhaar Khate Me Likhein",
    pos_print_slip: "Thermal Parchi Print",
    pos_share_wa: "WhatsApp Par Bhejein",

    // Inventory
    inv_title: "Inventory & Samaan Master",
    inv_subtitle: "Selling rate, wholesale khareed bhav, barcode aur low-stock limits manage karein",
    inv_th_prod: "Item Name",
    inv_th_cat: "Category",
    inv_th_barcode: "Barcode",
    inv_th_price: "Bikri Rate",
    inv_th_mrp: "MRP",
    inv_th_cost: "Wholesale Rate",
    inv_th_stock: "Bacha Stock",
    inv_th_actions: "Actions",

    // Purchases & Suppliers
    pur_title: "Wholesale Purchases & Supplier Khata",
    pur_subtitle: "Distributor se aaya wholesale bill aur baki payment track karein",
    pur_btn_new_supplier: "Naya Supplier",
    pur_btn_inward_bill: "Kharidi Bill Add",

    // Khata
    khata_title: "Digital Customer Udhaar Khata",
    khata_subtitle: "Udhaar hisab rakhein aur WhatsApp par 1-click payment reminder bhejein",
    khata_th_customer: "Customer",
    khata_th_phone: "Phone Number",
    khata_th_due: "Baki Udhaar",
    khata_th_spent: "Total Kharidi",
    khata_btn_give_credit: "+ Udhaar Dein",
    khata_btn_receive_payment: "✓ Jama Karein",
    khata_btn_send_reminder: "WhatsApp Reminder",

    // Expenses
    exp_title: "Dukaan Daily Kharche",
    exp_subtitle: "Kiraya, bijli, chai-pani, delivery aur baki overheads likhein",

    // Analytics
    analytics_title: "Business Reports & Nafa-Nuksan",
    analytics_subtitle: "Daily sales velocity, net munafa aur top bikne wala samaan dekhein",

    // Common
    btn_save: "Save Karein",
    btn_cancel: "Cancel",
    btn_edit: "Edit",
    btn_delete: "Delete",
    btn_restock: "+ Stock Badhayein",
    offline_badge: "100% Offline Chalu"
  }
};

class I18nManager {
  constructor() {
    this.currentLang = 'en';
    this.init();
  }

  init() {
    try {
      const db = window.DB ? window.DB.getData() : {};
      this.currentLang = db.language || localStorage.getItem('mydukaan24_lang') || 'en';
    } catch(e) {
      this.currentLang = 'en';
    }
  }

  t(key, fallback = '') {
    const dict = I18N_DICTIONARIES[this.currentLang] || I18N_DICTIONARIES.en;
    if (dict && dict[key]) return dict[key];
    const enDict = I18N_DICTIONARIES.en;
    if (enDict && enDict[key]) return enDict[key];
    return fallback || key;
  }

  setLanguage(lang, options = {}) {
    if (!I18N_DICTIONARIES[lang]) lang = 'en';
    this.currentLang = lang;
    localStorage.setItem('mydukaan24_lang', lang);

    if (window.DB && !options.fromCloud) {
      const db = window.DB.getData();
      db.language = lang;
      window.DB.saveData(db);
    }

    // Update active label in UI
    const langSelect = document.getElementById('lang-selector-select');
    if (langSelect) langSelect.value = lang;
    const sidebarLangSelect = document.getElementById('sidebar-lang-select');
    if (sidebarLangSelect) sidebarLangSelect.value = lang;

    if (options.fromCloud) {
      if (window.App) window.App.updateI18nLabels();
      return;
    }

    // Toast confirmation
    const langNames = { en: 'English', hi: 'हिन्दी (Hindi)', hinglish: 'Hinglish' };
    if (window.App && window.App.toast) {
      window.App.toast('success', 'Language Updated', `Display language changed to ${langNames[lang]}`);
    }

    // Re-render current view and sidebar labels
    if (window.App) {
      window.App.updateI18nLabels();
      window.App.navigate(window.App.currentView || 'dashboard');
    }
  }

  getLanguage() {
    return this.currentLang;
  }
}

window.I18n = new I18nManager();
