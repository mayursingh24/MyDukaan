/**
 * MyDukaan Pro — LocalStorage Database & Audio Engine
 * Created & Deployed by Mayur Singh
 */

const STORAGE_KEY = 'mydukaan24_prod_db';

const DEFAULT_SHOP = {
  name: "MyDukaan24 Mart",
  owner: "Mayur Singh",
  phone: "+91 98765 43210",
  address: "Hazratganj Market, Lucknow, Uttar Pradesh, India",
  gstin: "09AAAAA0000A1Z5",
  upiId: "mydukaan24@upi",
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
  { id: "P112", name: "Toor Dal Premium 1kg", cat: "Grocery", barcode: "8901030383858", mrp: 200, price: 175, cost: 145, stock: 0, unit: "kg", minStock: 10, emoji: "🫘" } // Out of stock
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

class StorageEngine {
  constructor() {
    this.initDatabase();
    this.initAudio();
  }

  initDatabase() {
    try {
      const existing = localStorage.getItem(STORAGE_KEY);
      if (!existing) {
        this.saveData({
          shop: DEFAULT_SHOP,
          products: DEFAULT_PRODUCTS,
          customers: DEFAULT_CUSTOMERS,
          invoices: this.generateInitialInvoices(),
          expenses: DEFAULT_EXPENSES,
          staff: DEFAULT_STAFF,
          attendance: {},
          geminiKey: "",
          theme: "dark",
          soundEnabled: true
        });
      }
    } catch (e) {
      console.error("[Storage] Database init error:", e);
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
      if (str) return JSON.parse(str);
    } catch (e) {
      console.error("[Storage] Failed to read DB:", e);
    }
    return {
      shop: DEFAULT_SHOP,
      products: DEFAULT_PRODUCTS,
      customers: DEFAULT_CUSTOMERS,
      invoices: [],
      expenses: DEFAULT_EXPENSES,
      staff: DEFAULT_STAFF,
      attendance: {},
      geminiKey: "",
      theme: "dark",
      soundEnabled: true
    };
  }

  saveData(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      console.error("[Storage] Storage quota or write failure:", e);
      return false;
    }
  }

  updateItem(category, item) {
    const db = this.getData();
    if (!db[category]) db[category] = [];
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
