/**
 * MyDukaan Pro — LocalStorage Database & Audio Engine
 * Created & Deployed by Mayur Singh
 */

const STORAGE_KEY = 'mydukaan24_prod_db';
const SYNC_META_KEY = 'mydukaan24_sync_meta';
const PENDING_SHOP_PROFILE_KEY = 'mydukaan24_pending_shop_profile';
const SYNC_CATEGORIES = ['products', 'customers', 'invoices', 'suppliers', 'purchases', 'expenses', 'staff'];
const META_FIELDS = ['shop', 'shops', 'activeShopId', 'attendance', 'theme', 'accent', 'language', 'soundEnabled'];

const DEFAULT_SHOP = {
  name: "MyDukkan24 Mart",
  owner: "Mayur Singh",
  phone: "+91 6306437348",
  address: "Hazratganj Market, Lucknow, Uttar Pradesh, India",
  gstin: "09AAAAA0000A1Z5",
  upiId: "6306437348@upi",
  currency: "₹",
  taxRate: 5 // Default GST 5%
};

const DEFAULT_PRODUCTS = [
  { id: "P101", name: "Aashirvaad Shudh Chakki Atta 5kg", cat: "Grocery", barcode: "8901725131235", mrp: 260, price: 235, cost: 198, stock: 28, unit: "bag", minStock: 8, emoji: "🌾" },
  { id: "P102", name: "Fortune Sunflower Oil 1L", cat: "Oils", barcode: "8906007280145", mrp: 175, price: 155, cost: 130, stock: 34, unit: "pouch", minStock: 10, emoji: "🫙" },
  { id: "P103", name: "Amul Butter 100g", cat: "Dairy", barcode: "8901262010053", mrp: 58, price: 55, cost: 48, stock: 45, unit: "pack", minStock: 12, emoji: "🧈" },
  { id: "P104", name: "Tata Tea Gold 250g", cat: "Beverages", barcode: "8901052003888", mrp: 160, price: 140, cost: 115, stock: 19, unit: "box", minStock: 6, emoji: "☕" },
  { id: "P105", name: "Maggi 2-Minute Noodles 70g", cat: "Snacks", barcode: "8901058852336", mrp: 14, price: 14, cost: 11.5, stock: 95, unit: "pack", minStock: 25, emoji: "🍜" },
  { id: "P106", name: "Colgate Total Toothpaste 120g", cat: "Personal Care", barcode: "8901314010529", mrp: 110, price: 95, cost: 75, stock: 22, unit: "tube", minStock: 8, emoji: "🪥" },
  { id: "P107", name: "Parle-G Glucose Biscuits 80g", cat: "Snacks", barcode: "8901719101015", mrp: 10, price: 10, cost: 8.5, stock: 120, unit: "pack", minStock: 30, emoji: "🍪" },
  { id: "P108", name: "Surf Excel Quick Wash 1kg", cat: "Household", barcode: "8901030015520", mrp: 165, price: 148, cost: 125, stock: 16, unit: "pack", minStock: 5, emoji: "🧼" },
  { id: "P109", name: "Dettol Antiseptic Liquid 250ml", cat: "Healthcare", barcode: "8901396112104", mrp: 145, price: 130, cost: 105, stock: 4, unit: "bottle", minStock: 6, emoji: "🧴" }, // Low stock
  { id: "P110", name: "Cadbury Dairy Milk Silk 60g", cat: "Chocolates", barcode: "7622201738210", mrp: 85, price: 80, cost: 68, stock: 30, unit: "bar", minStock: 10, emoji: "🍫" },
  { id: "P111", name: "Basmati Rice India Gate 1kg", cat: "Grocery", barcode: "8901030383841", mrp: 140, price: 120, cost: 95, stock: 40, unit: "kg", minStock: 10, emoji: "🍚" },
  { id: "P112", name: "Toor Dal Premium 1kg", cat: "Grocery", barcode: "8901030383858", mrp: 200, price: 175, cost: 145, stock: 0, unit: "kg", minStock: 10, emoji: "🫘" }, // Out of stock
  { id: "P113", name: "Indian Retail FMCG Pack", cat: "Grocery", barcode: "8904258116198", mrp: 30, price: 25, cost: 20, stock: 45, unit: "pack", minStock: 10, emoji: "🍿" }
];

const DEFAULT_CUSTOMERS = [
  { id: "C101", name: "Ramesh Sharma", phone: "9876543210", email: "ramesh.sharma@gmail.com", balanceDue: 1850, totalSpent: 18450, points: 620, tier: "Gold", notes: "Regular customer, pays every month end" },
  { id: "C102", name: "Pooja Verma", phone: "9811223344", email: "pooja.v@outlook.com", balanceDue: 0, totalSpent: 9200, points: 310, tier: "Silver", notes: "Prefers digital UPI payments" },
  { id: "C103", name: "Anil Gupta", phone: "9899001122", email: "", balanceDue: 3400, totalSpent: 14200, points: 480, tier: "Gold", notes: "Pending due for last two grocery orders" },
  { id: "C104", name: "Sunita Devi", phone: "9711556677", email: "", balanceDue: 450, totalSpent: 3500, points: 120, tier: "Bronze", notes: "Walk-in neighbour" }
];

const DEFAULT_EXPENSES = [
  { id: "E101", desc: "Monthly Shop Rent (Oct 2026)", cat: "Rent", amount: 18000, date: "2026-10-01", status: "Paid" },
  { id: "E102", desc: "Commercial Electricity Bill", cat: "Utilities", amount: 3450, date: "2026-10-02", status: "Paid" },
  { id: "E103", desc: "Stock Delivery Porter Freight", cat: "Logistics", amount: 850, date: "2026-10-03", status: "Paid" },
  { id: "E104", desc: "Store Staff Advance", cat: "Salary", amount: 5000, date: "2026-10-04", status: "Pending" }
];

const DEFAULT_STAFF = [
  { id: "S101", name: "Vikas Rawat", role: "Store Helper", phone: "9911223344", salary: 14000, joinDate: "2024-03-01", status: "Active" },
  { id: "S102", name: "Kavita Singh", role: "Billing Cashier", phone: "9922334455", salary: 17500, joinDate: "2024-01-15", status: "Active" }
];

const DEFAULT_SUPPLIERS = [
  { id: "SUP-101", name: "Metro Wholesale Hub", contactPerson: "Rajesh Agrawal", phone: "9822114455", email: "orders@metrowholesale.in", gstin: "09AAACM1234F1Z1", city: "Lucknow", balanceDue: 0, itemsSupplied: "Grocery, Atta, Rice, Spices" },
  { id: "SUP-102", name: "Hindustan FMCG Distributors", contactPerson: "Suresh Gupta", phone: "9833221100", email: "sales@hindustanfmcg.com", gstin: "09AAACH1234F1Z2", city: "Kanpur", balanceDue: 4500, itemsSupplied: "Soaps, Detergents, Shampoos" },
  { id: "SUP-103", name: "Amul Dairy Products Agency", contactPerson: "Mohit Verma", phone: "9844332211", email: "amullucknow@dairycoop.org", gstin: "09AAACA1234F1Z3", city: "Lucknow", balanceDue: 1800, itemsSupplied: "Butter, Milk, Ghee, Paneer" }
];

const DEFAULT_PURCHASES = [
  {
    id: "PUR-201",
    billNo: "HUL-8891",
    date: "2026-10-02",
    supplierId: "SUP-102",
    supplierName: "Hindustan FMCG Distributors",
    items: [
      { id: "P108", name: "Surf Excel Quick Wash 1kg", qty: 24, cost: 125, total: 3000 },
      { id: "P106", name: "Colgate Total Toothpaste 120g", qty: 20, cost: 75, total: 1500 }
    ],
    totalAmount: 4500,
    paidAmount: 0,
    dueAmount: 4500,
    status: "Due",
    paymentMode: "Credit"
  },
  {
    id: "PUR-202",
    billNo: "AMUL-4402",
    date: "2026-10-04",
    supplierId: "SUP-103",
    supplierName: "Amul Dairy Products Agency",
    items: [
      { id: "P103", name: "Amul Butter 100g", qty: 40, cost: 48, total: 1920 }
    ],
    totalAmount: 1920,
    paidAmount: 1920,
    dueAmount: 0,
    status: "Paid",
    paymentMode: "UPI"
  }
];

const DEFAULT_SHOPS = [
  { id: "SHOP-1", name: "MyDukkan24 Mart (Main Branch)", owner: "Mayur Singh", address: "Hazratganj Market, Lucknow, UP", phone: "+91 6306437348", gstin: "09AAAAA0000A1Z5", upiId: "6306437348@upi" },
  { id: "SHOP-2", name: "MyDukkan24 Express (Gomti Nagar)", owner: "Mayur Singh", address: "Patrakarpuram, Gomti Nagar, Lucknow", phone: "+91 6306437348", gstin: "09AAAAA0000A2Z6", upiId: "6306437348@upi" }
];

class StorageEngine {
  constructor() {
    this.initDatabase();
    this.initAudio();
  }

  getDefaultSyncMeta() {
    return {
      hasUserMutated: false,
      lastLocalWriteAt: 0,
      lastSyncedAt: 0,
      metaDirty: false,
      pendingUpserts: {},
      pendingDeletes: {}
    };
  }

  getSyncMeta() {
    try {
      const raw = localStorage.getItem(SYNC_META_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          ...this.getDefaultSyncMeta(),
          ...parsed,
          pendingUpserts: parsed.pendingUpserts || {},
          pendingDeletes: parsed.pendingDeletes || {}
        };
      }
    } catch (e) {}
    return this.getDefaultSyncMeta();
  }

  saveSyncMeta(meta) {
    try {
      localStorage.setItem(SYNC_META_KEY, JSON.stringify(meta));
    } catch (e) {}
  }

  initDatabase() {
    try {
      const existing = localStorage.getItem(STORAGE_KEY);
      if (!existing) {
        this.saveData({
          shop: DEFAULT_SHOP,
          shops: DEFAULT_SHOPS,
          activeShopId: "SHOP-1",
          products: DEFAULT_PRODUCTS,
          suppliers: DEFAULT_SUPPLIERS,
          purchases: DEFAULT_PURCHASES,
          customers: DEFAULT_CUSTOMERS,
          invoices: this.generateInitialInvoices(),
          expenses: DEFAULT_EXPENSES,
          staff: DEFAULT_STAFF,
          attendance: {},
          geminiKey: "",
          theme: "dark",
          accent: "blue",
          language: "en",
          soundEnabled: true
        }, { silentInit: true });
        this.saveSyncMeta({
          ...this.getDefaultSyncMeta(),
          hasUserMutated: false
        });
      } else {
        const parsed = JSON.parse(existing);
        let updated = false;
        if (!parsed.shop || parsed.shop.phone === "+91 98765 43210" || parsed.shop.phone === "9876543210") {
          if (!parsed.shop) parsed.shop = { ...DEFAULT_SHOP };
          parsed.shop.phone = "+91 6306437348";
          parsed.shop.upiId = "6306437348@upi";
          updated = true;
        }
        if (updated) this.saveData(parsed, { silentInit: true });
        if (!localStorage.getItem(SYNC_META_KEY)) {
          // Preserve existing data when upgrading from pre-v8.0 builds
          this.saveSyncMeta({
            ...this.getDefaultSyncMeta(),
            hasUserMutated: true
          });
        }
      }
      this.applyPendingShopProfile();
    } catch (e) {
      console.error("[Storage] Database init error:", e);
    }
  }

  applyPendingShopProfile() {
    try {
      const raw = localStorage.getItem(PENDING_SHOP_PROFILE_KEY);
      if (!raw) return false;
      const profile = JSON.parse(raw);
      if (!profile || typeof profile !== 'object') {
        localStorage.removeItem(PENDING_SHOP_PROFILE_KEY);
        return false;
      }

      const str = localStorage.getItem(STORAGE_KEY);
      if (!str) return false;
      const db = JSON.parse(str);
      if (!db.shop) db.shop = { ...DEFAULT_SHOP };

      let applied = false;
      if (profile.name) {
        db.shop.name = String(profile.name).trim();
        db.shop.rcptHeader = `${db.shop.name.toUpperCase()} • TAX INVOICE`;
        applied = true;
      }
      if (profile.owner) { db.shop.owner = String(profile.owner).trim(); applied = true; }
      if (profile.phone) { db.shop.phone = String(profile.phone).trim(); applied = true; }
      if (profile.address) { db.shop.address = String(profile.address).trim(); applied = true; }
      if (profile.upiId) { db.shop.upiId = String(profile.upiId).trim(); applied = true; }
      if (profile.gstin) { db.shop.gstin = String(profile.gstin).trim(); applied = true; }

      if (applied) {
        if (!Array.isArray(db.shops) || !db.shops.length) {
          db.shops = DEFAULT_SHOPS.map(s => ({ ...s }));
        }
        db.shops[0] = {
          ...db.shops[0],
          name: profile.name ? `${String(profile.name).trim()} (Main Branch)` : db.shops[0].name,
          owner: profile.owner ? String(profile.owner).trim() : db.shops[0].owner,
          phone: profile.phone ? String(profile.phone).trim() : db.shops[0].phone,
          address: profile.address ? String(profile.address).trim() : db.shops[0].address,
          upiId: profile.upiId ? String(profile.upiId).trim() : db.shops[0].upiId,
          gstin: profile.gstin ? String(profile.gstin).trim() : db.shops[0].gstin
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
        const meta = this.getSyncMeta();
        meta.metaDirty = true;
        this.saveSyncMeta(meta);
      }

      localStorage.removeItem(PENDING_SHOP_PROFILE_KEY);
      return applied;
    } catch (e) {
      return false;
    }
  }

  generateInitialInvoices() {
    const today = new Date().toISOString().split('T')[0];
    return [
      {
        id: "INV-1001",
        date: today,
        time: "10:30 AM",
        customerId: "C101",
        customerName: "Ramesh Sharma",
        customerPhone: "9876543210",
        items: [
          { id: "P101", name: "Aashirvaad Shudh Chakki Atta 5kg", qty: 2, mrp: 260, price: 235, total: 470 },
          { id: "P103", name: "Amul Butter 100g", qty: 2, mrp: 58, price: 55, total: 110 }
        ],
        subtotal: 580,
        tax: 29,
        discount: 0,
        total: 609,
        paid: 609,
        due: 0,
        paymentMode: "UPI",
        status: "Paid"
      },
      {
        id: "INV-1002",
        date: today,
        time: "11:45 AM",
        customerId: "C103",
        customerName: "Anil Gupta",
        customerPhone: "9899001122",
        items: [
          { id: "P102", name: "Fortune Sunflower Oil 1L", qty: 3, mrp: 175, price: 155, total: 465 },
          { id: "P104", name: "Tata Tea Gold 250g", qty: 2, mrp: 160, price: 140, total: 280 }
        ],
        subtotal: 745,
        tax: 37,
        discount: 20,
        total: 762,
        paid: 0,
        due: 762,
        paymentMode: "Udhaar",
        status: "Due"
      }
    ];
  }

  getData() {
    try {
      const str = localStorage.getItem(STORAGE_KEY);
      if (str) {
        const parsed = JSON.parse(str);
        if (parsed && parsed.products && !localStorage.getItem('mydukaan24_p113_seeded')) {
          localStorage.setItem('mydukaan24_p113_seeded', '1');
          if (!parsed.products.some(p => p.barcode === "8904258116198")) {
            parsed.products.push({
              id: "P113",
              name: "Indian Retail FMCG Pack",
              cat: "Grocery",
              barcode: "8904258116198",
              mrp: 30,
              price: 25,
              cost: 20,
              stock: 45,
              unit: "pack",
              minStock: 10,
              emoji: "🍿"
            });
            this.saveData(parsed, { silentInit: true });
          }
        }
        if (!parsed.suppliers) parsed.suppliers = DEFAULT_SUPPLIERS;
        if (!parsed.purchases) parsed.purchases = DEFAULT_PURCHASES;
        if (!parsed.shops) parsed.shops = DEFAULT_SHOPS;
        if (!parsed.activeShopId) parsed.activeShopId = "SHOP-1";
        if (!parsed.language) parsed.language = "en";
        return parsed;
      }
    } catch (e) {
      console.error("[Storage] Failed to read DB:", e);
    }
    return {
      shop: DEFAULT_SHOP,
      shops: DEFAULT_SHOPS,
      activeShopId: "SHOP-1",
      products: DEFAULT_PRODUCTS,
      suppliers: DEFAULT_SUPPLIERS,
      purchases: DEFAULT_PURCHASES,
      customers: DEFAULT_CUSTOMERS,
      invoices: [],
      expenses: DEFAULT_EXPENSES,
      staff: DEFAULT_STAFF,
      attendance: {},
      geminiKey: "",
      theme: "dark",
      accent: "blue",
      language: "en",
      soundEnabled: true
    };
  }

  saveData(data, options = {}) {
    try {
      const now = Date.now();
      let prev = null;
      if (!options.fromCloud && !options.silentInit) {
        try {
          const prevStr = localStorage.getItem(STORAGE_KEY);
          if (prevStr) prev = JSON.parse(prevStr);
        } catch (e) {}

        const meta = this.getSyncMeta();
        meta.hasUserMutated = true;
        meta.lastLocalWriteAt = now;

        // Track item-level changes & deletions across synced collections
        SYNC_CATEGORIES.forEach((cat) => {
          const prevList = Array.isArray(prev && prev[cat]) ? prev[cat] : [];
          const nextList = Array.isArray(data && data[cat]) ? data[cat] : [];
          const prevMap = new Map(prevList.map(item => [String(item.id), JSON.stringify(item)]));
          const nextIds = new Set();

          const upsertSet = new Set(meta.pendingUpserts[cat] || []);
          const deleteSet = new Set(meta.pendingDeletes[cat] || []);

          nextList.forEach((item) => {
            if (!item || !item.id) return;
            const idStr = String(item.id);
            nextIds.add(idStr);
            const prevJson = prevMap.get(idStr);
            const curJson = JSON.stringify(item);
            if (prevJson !== curJson) {
              item.updatedAt = now;
              upsertSet.add(idStr);
              deleteSet.delete(idStr);
            }
          });

          prevList.forEach((oldItem) => {
            if (oldItem && oldItem.id && !nextIds.has(String(oldItem.id))) {
              const idStr = String(oldItem.id);
              deleteSet.add(idStr);
              upsertSet.delete(idStr);
            }
          });

          meta.pendingUpserts[cat] = Array.from(upsertSet);
          meta.pendingDeletes[cat] = Array.from(deleteSet);
        });

        // Track store meta changes
        if (prev) {
          const metaChanged = META_FIELDS.some((k) => JSON.stringify(prev[k]) !== JSON.stringify(data[k]));
          if (metaChanged) meta.metaDirty = true;
        } else {
          meta.metaDirty = true;
        }

        this.saveSyncMeta(meta);
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

      if (!options.fromCloud && !options.silentInit && window.CloudSync && typeof window.CloudSync.onLocalChange === 'function') {
        window.CloudSync.onLocalChange();
      }
      return true;
    } catch (e) {
      console.error("[Storage] Storage quota or write failure:", e);
      return false;
    }
  }

  updateItem(category, item) {
    const db = this.getData();
    if (!db[category]) db[category] = [];
    item.updatedAt = Date.now();
    const idx = db[category].findIndex(i => i.id === item.id);
    if (idx >= 0) {
      db[category][idx] = item;
    } else {
      db[category].unshift(item);
    }
    this.saveData(db);
    return item;
  }

  deleteItem(category, id) {
    const db = this.getData();
    if (!db[category]) return;
    db[category] = db[category].filter(i => i.id !== id);
    this.saveData(db);
  }

  // Web Audio Synthesizer for high-fidelity retail sound feedback
  initAudio() {
    this.audioCtx = null;
  }

  getAudioContext() {
    if (!this.audioCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.audioCtx = new AudioCtx();
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  playScanBeep() {
    const db = this.getData();
    if (!db.soundEnabled) return;
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1760, ctx.currentTime); // High pitch supermarket scan beep
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } catch (e) {}
  }

  playCashChime() {
    const db = this.getData();
    if (!db.soundEnabled) return;
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      // Dual tone cash register chime
      [523.25, 659.25, 1046.50].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + (i * 0.08));
        gain.gain.setValueAtTime(0.15, ctx.currentTime + (i * 0.08));
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (i * 0.08) + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + (i * 0.08));
        osc.stop(ctx.currentTime + (i * 0.08) + 0.25);
      });
    } catch (e) {}
  }

  // Backup & CSV Utilities
  exportCSV(category) {
    const db = this.getData();
    const data = db[category] || [];
    if (!data.length) return "";
    const headers = Object.keys(data[0]).filter(k => typeof data[0][k] !== 'object');
    const rows = data.map(row => headers.map(h => `"${String(row[h] || '').replace(/"/g, '""')}"`).join(','));
    return [headers.join(','), ...rows].join('\n');
  }

  downloadFile(content, fileName, mimeType = 'text/csv') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }
}

window.DB = new StorageEngine();
