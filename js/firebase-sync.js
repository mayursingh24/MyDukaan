/**
 * MyDukaan24 — Hybrid Offline-First + Firebase Cloud Sync Engine (v8.0)
 * Architecture:
 *  - Instant 0ms LocalStorage writes (works 100% offline, never blocks POS)
 *  - Persistent Firestore IndexedDB Cache + Offline Mutation Queue (Standard Edition)
 *  - Firebase Auth (Google Sign-In + Email/Password)
 *  - Multi-device Real-Time onSnapshot Sync under /users/{uid}/...
 *  - Gemini API keys strictly remain local (never uploaded to cloud DB)
 */

(function () {
  const FIREBASE_CFG_KEY = 'mydukaan24_firebase_config';
  const DEVICE_ID_KEY = 'mydukaan24_device_id';
  const SDK_VERSION = '11.6.0';
  const CATEGORIES = ['products', 'customers', 'invoices', 'suppliers', 'purchases', 'expenses', 'staff'];

  function getDeviceId() {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = `dev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  }

  function safeStr(val, maxLen = 200, fallback = '') {
    if (val === null || val === undefined) return fallback;
    const s = String(val).trim();
    return s.length > maxLen ? s.slice(0, maxLen) : s;
  }

  function safeNum(val, fallback = 0) {
    const n = Number(val);
    if (!Number.isFinite(n) || n < 0) return fallback;
    return n;
  }

  function chunkArray(arr, size) {
    const out = [];
    for (let i = 0; i < arr.length; i += size) {
      out.push(arr.slice(i, i + size));
    }
    return out;
  }

  function withTimeout(promise, ms, label = 'Cloud operation timed out') {
    let timer;
    return Promise.race([
      promise.finally(() => clearTimeout(timer)),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(label)), ms);
      })
    ]);
  }

  class FirebaseCloudSync {
    constructor() {
      this.sdk = null;
      this.app = null;
      this.auth = null;
      this.db = null;
      this.user = null;
      this.unsubscribers = [];
      this.syncState = 'idle'; // idle | unconfigured | signed-out | connecting | syncing | synced | offline-queued | error
      this.lastError = '';
      this.lastSyncedAt = 0;
      this.persistenceMode = 'memory';
      this.authTab = 'signin';
      this._debounceTimer = null;
      this._flushPromise = null;
      this._authListenerAttached = false;
      this._initStarted = false;
      this.deviceId = getDeviceId();
    }

    getSavedConfig() {
      try {
        const raw = localStorage.getItem(FIREBASE_CFG_KEY);
        if (!raw) return null;
        const cfg = JSON.parse(raw);
        if (cfg && cfg.apiKey && cfg.authDomain && cfg.projectId && cfg.appId) {
          return cfg;
        }
      } catch (e) {}
      return null;
    }

    parseConfigInput(rawText) {
      const text = String(rawText || '').trim();
      if (!text) return null;

      // 1. Direct JSON parse attempt
      try {
        const parsed = JSON.parse(text);
        if (parsed && parsed.apiKey && parsed.projectId) {
          return this.pickValidConfigFields(parsed);
        }
      } catch (e) {}

      // 2. Safe key/value extraction for JS snippets pasted from Firebase Console
      const fields = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId', 'measurementId'];
      const extracted = {};
      fields.forEach((key) => {
        const re = new RegExp(`["']?${key}["']?\\s*:\\s*["']([^"']+)["']`, 'i');
        const m = text.match(re);
        if (m && m[1]) extracted[key] = m[1].trim();
      });

      if (extracted.apiKey && extracted.authDomain && extracted.projectId && extracted.appId) {
        return extracted;
      }
      return null;
    }

    pickValidConfigFields(obj) {
      const cfg = {};
      ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId', 'measurementId'].forEach((k) => {
        if (obj[k]) cfg[k] = String(obj[k]).trim();
      });
      if (cfg.apiKey && cfg.authDomain && cfg.projectId && cfg.appId) return cfg;
      return null;
    }

    async saveConfig(rawText) {
      const cfg = this.parseConfigInput(rawText);
      if (!cfg) {
        return {
          ok: false,
          error: 'Invalid Firebase config. Required keys: apiKey, authDomain, projectId, appId.'
        };
      }
      localStorage.setItem(FIREBASE_CFG_KEY, JSON.stringify(cfg));
      this.stopListeners();
      this.sdk = null;
      this.app = null;
      this.auth = null;
      this.db = null;
      this.user = null;
      this._authListenerAttached = false;
      this._initStarted = false;
      this.lastError = '';
      await this.init();
      return { ok: true, config: cfg };
    }

    clearConfig() {
      this.stopListeners();
      if (this.auth && this.sdk && this.sdk.signOut) {
        try { this.sdk.signOut(this.auth); } catch (e) {}
      }
      localStorage.removeItem(FIREBASE_CFG_KEY);
      this.app = null;
      this.auth = null;
      this.db = null;
      this.user = null;
      this._authListenerAttached = false;
      this._initStarted = false;
      this.syncState = 'unconfigured';
      this.lastError = '';
      this.notifyUI();
    }

    isOnline() {
      return typeof navigator === 'undefined' ? true : navigator.onLine !== false;
    }

    getPendingCount() {
      if (!window.DB || typeof DB.getSyncMeta !== 'function') return 0;
      const meta = DB.getSyncMeta();
      let count = meta.metaDirty ? 1 : 0;
      CATEGORIES.forEach((cat) => {
        count += (meta.pendingUpserts[cat] || []).length;
        count += (meta.pendingDeletes[cat] || []).length;
      });
      return count;
    }

    async loadFirebaseSdk() {
      if (this.sdk) return this.sdk;
      const base = `https://www.gstatic.com/firebasejs/${SDK_VERSION}`;
      const [appMod, authMod, fsMod] = await withTimeout(
        Promise.all([
          import(`${base}/firebase-app.js`),
          import(`${base}/firebase-auth.js`),
          import(`${base}/firebase-firestore.js`)
        ]),
        12000,
        'Unable to download Firebase SDK. Check your internet connection.'
      );

      this.sdk = {
        ...appMod,
        ...authMod,
        ...fsMod
      };
      return this.sdk;
    }

    async init() {
      const cfg = this.getSavedConfig();
      if (!cfg) {
        this.syncState = 'unconfigured';
        this.notifyUI();
        return false;
      }

      if (this._initStarted && this.auth && this.db) {
        return true;
      }

      this._initStarted = true;
      this.syncState = 'connecting';
      this.lastError = '';
      this.notifyUI();

      try {
        const sdk = await this.loadFirebaseSdk();
        const existingApps = sdk.getApps ? sdk.getApps() : [];
        const appName = `mydukaan_${cfg.projectId}`;
        const foundApp = existingApps.find(a => a.name === appName);
        this.app = foundApp || sdk.initializeApp(cfg, appName);
        this.auth = sdk.getAuth(this.app);

        // Initialize Standard Edition Firestore with persistent offline IndexedDB cache
        try {
          if (sdk.initializeFirestore && sdk.persistentLocalCache && sdk.persistentMultipleTabManager) {
            this.db = sdk.initializeFirestore(this.app, {
              localCache: sdk.persistentLocalCache({
                tabManager: sdk.persistentMultipleTabManager()
              })
            });
            this.persistenceMode = 'indexeddb-multi-tab';
          } else {
            this.db = sdk.getFirestore(this.app);
            this.persistenceMode = 'standard';
          }
        } catch (fsInitErr) {
          this.db = sdk.getFirestore(this.app);
          this.persistenceMode = 'fallback';
        }

        if (!this._authListenerAttached) {
          this._authListenerAttached = true;
          sdk.onAuthStateChanged(this.auth, async (user) => {
            this.user = user || null;
            if (this.user) {
              await this.onUserSignedIn(this.user);
            } else {
              this.stopListeners();
              this.syncState = 'signed-out';
              this.notifyUI();
            }
          });
        }

        // Complete pending OAuth redirect login if any
        if (sdk.getRedirectResult) {
          sdk.getRedirectResult(this.auth).catch(() => {});
        }

        return true;
      } catch (err) {
        this._initStarted = false;
        this.lastError = err.message || 'Firebase initialization error';
        this.syncState = this.isOnline() ? 'error' : 'offline-queued';
        this.notifyUI();
        return false;
      }
    }

    async signInWithGoogle() {
      const ok = await this.init();
      if (!ok || !this.auth || !this.sdk) {
        App.toast('warning', 'Firebase Setup Needed', this.lastError || 'Save a valid Firebase config first.');
        return;
      }
      if (!this.isOnline()) {
        App.toast('warning', 'System Offline', 'Connect to the internet to sign in with Google.');
        return;
      }
      try {
        const provider = new this.sdk.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        await this.sdk.signInWithPopup(this.auth, provider);
        App.toast('success', 'Signed In', 'Google account linked for live cloud sync.');
      } catch (err) {
        const code = err.code || '';
        if (code === 'auth/popup-blocked') {
          try {
            const provider = new this.sdk.GoogleAuthProvider();
            await this.sdk.signInWithRedirect(this.auth, provider);
            return;
          } catch (redirErr) {
            err = redirErr;
          }
        }
        const host = window.location.hostname || 'localhost';
        let msg = err.message || 'Google Sign-In failed.';
        if (code === 'auth/unauthorized-domain') {
          msg = `Domain "${host}" is not authorized in Firebase Auth > Settings > Authorized domains.`;
        } else if (code === 'auth/popup-closed-by-user') {
          msg = 'Sign-in popup closed before completing.';
        }
        this.lastError = msg;
        App.toast('danger', 'Sign-In Error', msg);
        this.notifyUI();
      }
    }

    async signInEmail(email, password) {
      const ok = await this.init();
      if (!ok || !this.auth || !this.sdk) return;
      if (!this.isOnline()) {
        App.toast('warning', 'System Offline', 'Internet is required to sign in.');
        return;
      }
      try {
        await this.sdk.signInWithEmailAndPassword(this.auth, email.trim(), password);
        App.toast('success', 'Signed In', 'Store connected to Firebase Cloud.');
      } catch (err) {
        this.lastError = this.humanizeAuthError(err);
        App.toast('danger', 'Login Failed', this.lastError);
        this.notifyUI();
      }
    }

    async signUpEmail(email, password) {
      const ok = await this.init();
      if (!ok || !this.auth || !this.sdk) return;
      if (!this.isOnline()) {
        App.toast('warning', 'System Offline', 'Internet is required to create an account.');
        return;
      }
      try {
        await this.sdk.createUserWithEmailAndPassword(this.auth, email.trim(), password);
        App.toast('success', 'Account Created', 'Your store will now sync online & offline.');
      } catch (err) {
        this.lastError = this.humanizeAuthError(err);
        App.toast('danger', 'Signup Failed', this.lastError);
        this.notifyUI();
      }
    }

    async resetPassword(email) {
      const ok = await this.init();
      if (!ok || !this.auth || !this.sdk) return;
      const cleanEmail = (email || '').trim();
      if (!cleanEmail) {
        App.toast('warning', 'Enter Email', 'Enter your account email first.');
        return;
      }
      try {
        await this.sdk.sendPasswordResetEmail(this.auth, cleanEmail);
        App.toast('success', 'Reset Link Sent', `Password reset instructions sent to ${cleanEmail}`);
      } catch (err) {
        App.toast('danger', 'Reset Failed', this.humanizeAuthError(err));
      }
    }

    async signOutUser() {
      this.stopListeners();
      if (this.auth && this.sdk && this.sdk.signOut) {
        await this.sdk.signOut(this.auth);
      }
      this.user = null;
      this.syncState = 'signed-out';
      this.notifyUI();
      App.toast('info', 'Signed Out', 'Local offline database remains safely stored on this device.');
    }

    humanizeAuthError(err) {
      const code = (err && err.code) || '';
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
        return 'Incorrect email or password.';
      }
      if (code === 'auth/email-already-in-use') {
        return 'Account already exists. Please use Sign In instead.';
      }
      if (code === 'auth/weak-password') {
        return 'Password must be at least 6 characters long.';
      }
      if (code === 'auth/operation-not-allowed') {
        return 'Enable Email/Password & Google Sign-In in Firebase Console > Authentication > Sign-in method.';
      }
      return (err && err.message) || 'Authentication error.';
    }

    async onUserSignedIn(user) {
      this.syncState = 'syncing';
      this.lastError = '';
      this.notifyUI();

      try {
        await this.initialReconcile(user);
        this.startRealtimeListeners(user.uid);
      } catch (err) {
        console.error('[CloudSync] Sign-in reconciliation error:', err);
        this.lastError = err.message || 'Sync error';
        this.syncState = this.isOnline() ? 'error' : 'offline-queued';
        this.notifyUI();
      }
    }

    // Sanitize documents strictly to match firestore.rules schema
    sanitizeMeta(db, user) {
      const shop = db.shop || {};
      const cleanShop = {
        name: safeStr(shop.name, 180) || 'MyDukkan24 Mart',
        owner: safeStr(shop.owner, 140),
        phone: safeStr(shop.phone, 40),
        address: safeStr(shop.address, 300),
        gstin: safeStr(shop.gstin, 40),
        upiId: safeStr(shop.upiId, 120) || '6306437348@upi',
        currency: safeStr(shop.currency, 10) || '₹',
        taxRate: Math.min(100, safeNum(shop.taxRate, 5))
      };
      if (shop.rcptHeader !== undefined) cleanShop.rcptHeader = safeStr(shop.rcptHeader, 200);
      if (shop.rcptFooter !== undefined) cleanShop.rcptFooter = safeStr(shop.rcptFooter, 200);
      if (shop.rcptWidth !== undefined) cleanShop.rcptWidth = safeStr(shop.rcptWidth, 20) || '80mm';

      const theme = db.theme === 'light' ? 'light' : 'dark';
      const language = ['en', 'hi', 'hinglish'].includes(db.language) ? db.language : 'en';
      const rawAtt = (db.attendance && typeof db.attendance === 'object' && !Array.isArray(db.attendance)) ? db.attendance : {};
      const cleanAtt = {};
      Object.keys(rawAtt).slice(0, 200).forEach((k) => {
        cleanAtt[k] = rawAtt[k];
      });

      return {
        shop: cleanShop,
        shops: Array.isArray(db.shops) ? db.shops.slice(0, 50) : [],
        activeShopId: safeStr(db.activeShopId, 100) || 'SHOP-1',
        attendance: cleanAtt,
        theme,
        accent: safeStr(db.accent, 40) || 'blue',
        language,
        soundEnabled: db.soundEnabled !== false,
        updatedAt: Date.now(),
        updatedByDevice: safeStr(this.deviceId, 120),
        ownerEmail: safeStr(user && user.email, 200)
      };
    }

    sanitizeItem(cat, raw) {
      if (!raw || !raw.id) return null;
      const id = safeStr(raw.id, 100);
      if (!id) return null;
      const updatedAt = safeNum(raw.updatedAt, Date.now());

      switch (cat) {
        case 'products':
          return {
            id,
            name: safeStr(raw.name, 220) || `Item ${id}`,
            cat: safeStr(raw.cat, 80) || 'Grocery',
            barcode: safeStr(raw.barcode, 80),
            mrp: safeNum(raw.mrp, 0),
            price: safeNum(raw.price, 0),
            cost: safeNum(raw.cost, 0),
            stock: safeNum(raw.stock, 0),
            unit: safeStr(raw.unit, 40) || 'pack',
            minStock: safeNum(raw.minStock, 0),
            emoji: safeStr(raw.emoji, 20),
            shopId: safeStr(raw.shopId, 100),
            updatedAt
          };
        case 'customers':
          return {
            id,
            name: safeStr(raw.name, 180) || `Customer ${id}`,
            phone: safeStr(raw.phone, 40),
            email: safeStr(raw.email, 180),
            balanceDue: safeNum(raw.balanceDue, 0),
            totalSpent: safeNum(raw.totalSpent, 0),
            points: safeNum(raw.points, 0),
            tier: safeStr(raw.tier, 40) || 'Bronze',
            notes: safeStr(raw.notes, 1000),
            updatedAt
          };
        case 'invoices':
          return {
            id,
            date: safeStr(raw.date, 40) || new Date().toISOString().split('T')[0],
            time: safeStr(raw.time, 40),
            customerId: raw.customerId === null ? null : safeStr(raw.customerId, 100, 'WALKIN'),
            customerName: safeStr(raw.customerName, 180) || 'Walk-in Customer',
            customerPhone: safeStr(raw.customerPhone, 40),
            items: Array.isArray(raw.items) ? raw.items.slice(0, 500) : [],
            subtotal: safeNum(raw.subtotal, 0),
            tax: safeNum(raw.tax, 0),
            discount: safeNum(raw.discount, 0),
            total: safeNum(raw.total, 0),
            paid: safeNum(raw.paid, 0),
            due: safeNum(raw.due, 0),
            paymentMode: safeStr(raw.paymentMode, 40) || 'Cash',
            status: safeStr(raw.status, 40) || 'Paid',
            shopId: safeStr(raw.shopId, 100),
            updatedAt
          };
        case 'suppliers':
          return {
            id,
            name: safeStr(raw.name, 180) || `Supplier ${id}`,
            contactPerson: safeStr(raw.contactPerson, 180),
            phone: safeStr(raw.phone, 40),
            email: safeStr(raw.email, 180),
            gstin: safeStr(raw.gstin, 40),
            city: safeStr(raw.city, 100),
            balanceDue: safeNum(raw.balanceDue, 0),
            itemsSupplied: safeStr(raw.itemsSupplied, 400),
            updatedAt
          };
        case 'purchases':
          return {
            id,
            billNo: safeStr(raw.billNo, 100),
            date: safeStr(raw.date, 40) || new Date().toISOString().split('T')[0],
            supplierId: safeStr(raw.supplierId, 100),
            supplierName: safeStr(raw.supplierName, 180),
            items: Array.isArray(raw.items) ? raw.items.slice(0, 500) : [],
            totalAmount: safeNum(raw.totalAmount, 0),
            paidAmount: safeNum(raw.paidAmount, 0),
            dueAmount: safeNum(raw.dueAmount, 0),
            status: safeStr(raw.status, 40) || 'Paid',
            paymentMode: safeStr(raw.paymentMode, 40) || 'Cash',
            updatedAt
          };
        case 'expenses':
          return {
            id,
            desc: safeStr(raw.desc, 300) || 'Store Expense',
            cat: safeStr(raw.cat, 80) || 'Other',
            amount: safeNum(raw.amount, 0),
            date: safeStr(raw.date, 40) || new Date().toISOString().split('T')[0],
            status: safeStr(raw.status, 40) || 'Paid',
            updatedAt
          };
        case 'staff':
          return {
            id,
            name: safeStr(raw.name, 180) || `Staff ${id}`,
            role: safeStr(raw.role, 100),
            phone: safeStr(raw.phone, 40),
            salary: safeNum(raw.salary, 0),
            joinDate: safeStr(raw.joinDate, 40),
            status: safeStr(raw.status, 40) || 'Active',
            updatedAt
          };
        default:
          return null;
      }
    }

    async fetchCloudStore(uid) {
      const { doc, getDoc, collection, getDocs } = this.sdk;
      const metaRef = doc(this.db, 'users', uid, 'meta', 'store');
      const metaSnap = await withTimeout(getDoc(metaRef), 10000, 'Timed out reading store metadata');

      const result = {
        exists: metaSnap.exists(),
        meta: metaSnap.exists() ? metaSnap.data() : null,
        collections: {}
      };

      const colSnaps = await Promise.all(
        CATEGORIES.map(cat => withTimeout(getDocs(collection(this.db, 'users', uid, cat)), 12000, `Timed out loading ${cat}`))
      );

      CATEGORIES.forEach((cat, idx) => {
        const items = [];
        colSnaps[idx].forEach((d) => items.push(d.data()));
        result.collections[cat] = items;
        if (items.length > 0) result.exists = true;
      });

      return result;
    }

    async initialReconcile(user) {
      const uid = user.uid;
      const localDb = DB.getData();
      const syncMeta = DB.getSyncMeta();

      // If offline right now, stay cached locally and queue flush for reconnect
      if (!this.isOnline()) {
        this.syncState = 'offline-queued';
        this.notifyUI();
        return;
      }

      const cloud = await this.fetchCloudStore(uid);

      // CASE A: First time setting up Firebase cloud for this account -> Upload local store
      if (!cloud.exists) {
        const fullMeta = DB.getSyncMeta();
        fullMeta.metaDirty = true;
        CATEGORIES.forEach((cat) => {
          fullMeta.pendingUpserts[cat] = (localDb[cat] || []).filter(i => i && i.id).map(i => String(i.id));
          fullMeta.pendingDeletes[cat] = [];
        });
        DB.saveSyncMeta(fullMeta);
        await this.flushPending();
        App.toast('success', 'Cloud Initialized', 'Your store data has been backed up to Firebase.');
        return;
      }

      // CASE B: Existing Cloud Store -> Merge or adopt safely
      const merged = { ...localDb };
      const nextSyncMeta = {
        ...syncMeta,
        hasUserMutated: true,
        pendingUpserts: { ...syncMeta.pendingUpserts },
        pendingDeletes: { ...syncMeta.pendingDeletes }
      };

      // Adopt untouched demo device cleanly without merging sample demo IDs
      const cloudNewerMeta = !syncMeta.hasUserMutated ||
        (!syncMeta.metaDirty && cloud.meta && (safeNum(cloud.meta.updatedAt, 0) >= safeNum(syncMeta.lastLocalWriteAt, 0)));

      if (cloud.meta && cloudNewerMeta) {
        if (cloud.meta.shop) merged.shop = { ...cloud.meta.shop };
        if (Array.isArray(cloud.meta.shops)) merged.shops = cloud.meta.shops;
        if (cloud.meta.activeShopId) merged.activeShopId = cloud.meta.activeShopId;
        if (cloud.meta.attendance) merged.attendance = cloud.meta.attendance;
        if (cloud.meta.theme) merged.theme = cloud.meta.theme;
        if (cloud.meta.accent) merged.accent = cloud.meta.accent;
        if (cloud.meta.language) merged.language = cloud.meta.language;
        if (typeof cloud.meta.soundEnabled === 'boolean') merged.soundEnabled = cloud.meta.soundEnabled;
        nextSyncMeta.metaDirty = false;
      } else if (syncMeta.metaDirty) {
        nextSyncMeta.metaDirty = true;
      }

      CATEGORIES.forEach((cat) => {
        const cloudItems = cloud.collections[cat] || [];
        const localItems = Array.isArray(localDb[cat]) ? localDb[cat] : [];

        if (!syncMeta.hasUserMutated) {
          // Device never had custom local edits: take exact cloud truth
          merged[cat] = cloudItems;
          nextSyncMeta.pendingUpserts[cat] = [];
          nextSyncMeta.pendingDeletes[cat] = [];
          return;
        }

        const cloudMap = new Map(cloudItems.map(it => [String(it.id), it]));
        const localMap = new Map(localItems.map(it => [String(it.id), it]));
        const upsertSet = new Set((syncMeta.pendingUpserts[cat] || []).map(String));
        const deleteSet = new Set((syncMeta.pendingDeletes[cat] || []).map(String));

        const finalMap = new Map();

        // Start with cloud entries unless queued for offline deletion
        cloudMap.forEach((cItem, id) => {
          if (!deleteSet.has(id)) {
            finalMap.set(id, cItem);
          }
        });

        // Apply pending offline/local upserts, non-demo pre-existing items, or newer local items
        const defaultDemoPattern = /^(P10\d|P11[0-3]|C10[1-4]|E10[1-4]|S10[12]|SUP-10[1-3]|PUR-20[12]|INV-100[12])$/;
        localMap.forEach((lItem, id) => {
          const cItem = cloudMap.get(id);
          const lTime = safeNum(lItem.updatedAt, 0);
          const cTime = cItem ? safeNum(cItem.updatedAt, 0) : 0;
          const isUntouchedDemo = !upsertSet.has(id) && lTime === 0 && defaultDemoPattern.test(id);

          if (cItem) {
            if (upsertSet.has(id) || lTime > cTime) {
              finalMap.set(id, lItem);
              upsertSet.add(id);
            }
          } else if (!isUntouchedDemo && !deleteSet.has(id)) {
            finalMap.set(id, lItem);
            upsertSet.add(id);
          }
        });

        merged[cat] = Array.from(finalMap.values());
        nextSyncMeta.pendingUpserts[cat] = Array.from(upsertSet);
        nextSyncMeta.pendingDeletes[cat] = Array.from(deleteSet);
      });

      // Keep Gemini API key strictly local
      merged.geminiKey = localDb.geminiKey || '';
      localStorage.setItem('mydukaan24_p113_seeded', '1');

      DB.saveSyncMeta(nextSyncMeta);
      DB.saveData(merged, { fromCloud: true });

      if (window.App) {
        App.applyTheme();
        App.updateHeaderStoreName();
        App.updateNotificationBadge();
        if (window.I18n) I18n.setLanguage(merged.language || 'en', { fromCloud: true });
        App.refreshActiveViewFromCloud && App.refreshActiveViewFromCloud();
      }

      // Push any merged local offline delta to Firestore
      if (this.getPendingCount() > 0) {
        await this.flushPending();
      } else {
        this.lastSyncedAt = Date.now();
        const m = DB.getSyncMeta();
        m.lastSyncedAt = this.lastSyncedAt;
        DB.saveSyncMeta(m);
        this.syncState = 'synced';
        this.notifyUI();
      }
    }

    startRealtimeListeners(uid) {
      this.stopListeners();
      if (!this.db || !this.sdk) return;
      const { doc, collection, onSnapshot } = this.sdk;

      // 1. Store Meta Listener
      const metaRef = doc(this.db, 'users', uid, 'meta', 'store');
      const unsubMeta = onSnapshot(metaRef, (snap) => {
        if (!snap.exists() || snap.metadata.hasPendingWrites) return;
        const remote = snap.data();
        if (!remote || remote.updatedByDevice === this.deviceId) return;

        const syncMeta = DB.getSyncMeta();
        if (syncMeta.metaDirty) return; // Don't clobber queued offline meta edits

        const localDb = DB.getData();
        let changed = false;
        if (remote.shop && JSON.stringify(localDb.shop) !== JSON.stringify(remote.shop)) {
          localDb.shop = { ...remote.shop };
          changed = true;
        }
        if (Array.isArray(remote.shops) && JSON.stringify(localDb.shops) !== JSON.stringify(remote.shops)) {
          localDb.shops = remote.shops;
          changed = true;
        }
        if (remote.activeShopId && localDb.activeShopId !== remote.activeShopId) {
          localDb.activeShopId = remote.activeShopId;
          changed = true;
        }
        if (remote.attendance && JSON.stringify(localDb.attendance) !== JSON.stringify(remote.attendance)) {
          localDb.attendance = remote.attendance;
          changed = true;
        }
        if (remote.theme && localDb.theme !== remote.theme) {
          localDb.theme = remote.theme;
          changed = true;
        }
        if (remote.accent && localDb.accent !== remote.accent) {
          localDb.accent = remote.accent;
          changed = true;
        }
        if (remote.language && localDb.language !== remote.language) {
          localDb.language = remote.language;
          changed = true;
        }
        if (typeof remote.soundEnabled === 'boolean' && localDb.soundEnabled !== remote.soundEnabled) {
          localDb.soundEnabled = remote.soundEnabled;
          changed = true;
        }

        if (changed) {
          DB.saveData(localDb, { fromCloud: true });
          this.lastSyncedAt = Date.now();
          if (window.App) {
            App.applyTheme();
            App.updateHeaderStoreName();
            if (window.I18n && localDb.language) I18n.setLanguage(localDb.language, { fromCloud: true });
            App.refreshActiveViewFromCloud && App.refreshActiveViewFromCloud();
          }
          this.notifyUI();
        }
      }, (err) => {
        console.warn('[CloudSync] Meta snapshot notice:', err.message);
      });
      this.unsubscribers.push(unsubMeta);

      // 2. Entity Collections Listeners
      CATEGORIES.forEach((cat) => {
        const colRef = collection(this.db, 'users', uid, cat);
        const unsub = onSnapshot(colRef, (snapshot) => {
          if (snapshot.metadata.hasPendingWrites) return;
          const changes = snapshot.docChanges();
          if (!changes.length) return;

          const syncMeta = DB.getSyncMeta();
          const pendingUpserts = new Set((syncMeta.pendingUpserts[cat] || []).map(String));
          const pendingDeletes = new Set((syncMeta.pendingDeletes[cat] || []).map(String));

          const localDb = DB.getData();
          const list = Array.isArray(localDb[cat]) ? [...localDb[cat]] : [];
          const map = new Map(list.map(it => [String(it.id), it]));
          let didChange = false;

          changes.forEach((chg) => {
            const docId = String(chg.doc.id);
            if (chg.type === 'removed') {
              if (!pendingUpserts.has(docId) && map.has(docId)) {
                map.delete(docId);
                didChange = true;
              }
            } else {
              const rData = chg.doc.data();
              if (pendingDeletes.has(docId) || pendingUpserts.has(docId)) return;
              const existing = map.get(docId);
              if (!existing || safeNum(rData.updatedAt, 0) > safeNum(existing.updatedAt, 0)) {
                map.set(docId, rData);
                didChange = true;
              }
            }
          });

          if (didChange) {
            localDb[cat] = Array.from(map.values());
            // Keep recent items at top for invoices/purchases/expenses
            if (cat === 'invoices' || cat === 'purchases' || cat === 'expenses') {
              localDb[cat].sort((a, b) => safeNum(b.updatedAt, 0) - safeNum(a.updatedAt, 0));
            }
            DB.saveData(localDb, { fromCloud: true });
            this.lastSyncedAt = Date.now();
            if (window.App) {
              App.updateNotificationBadge();
              App.refreshActiveViewFromCloud && App.refreshActiveViewFromCloud();
            }
            this.notifyUI();
          }
        }, (err) => {
          console.warn(`[CloudSync] Snapshot notice for ${cat}:`, err.message);
        });
        this.unsubscribers.push(unsub);
      });
    }

    stopListeners() {
      this.unsubscribers.forEach(fn => {
        try { fn(); } catch (e) {}
      });
      this.unsubscribers = [];
    }

    onLocalChange() {
      if (!this.getSavedConfig() || !this.user) {
        this.notifyUI();
        return;
      }
      if (!this.isOnline()) {
        this.syncState = 'offline-queued';
        this.notifyUI();
        return;
      }

      clearTimeout(this._debounceTimer);
      this._debounceTimer = setTimeout(() => {
        this.flushPending();
      }, 350);
    }

    async flushPending(isManual = false) {
      if (!this.user || !this.db || !this.sdk) {
        if (isManual) App.toast('warning', 'Not Signed In', 'Sign in to Firebase first to sync with cloud.');
        return false;
      }

      if (!this.isOnline()) {
        this.syncState = 'offline-queued';
        this.notifyUI();
        if (isManual) App.toast('warning', 'Offline Mode', 'Changes saved locally and will auto-sync when online.');
        return false;
      }

      if (this._flushPromise) {
        return this._flushPromise;
      }

      this._flushPromise = this._executeFlush(isManual).finally(() => {
        this._flushPromise = null;
      });
      return this._flushPromise;
    }

    async _executeFlush(isManual) {
      const uid = this.user.uid;
      const syncMeta = DB.getSyncMeta();
      const localDb = DB.getData();
      const { doc, writeBatch } = this.sdk;

      const ops = [];

      if (syncMeta.metaDirty) {
        ops.push({
          type: 'set',
          ref: doc(this.db, 'users', uid, 'meta', 'store'),
          data: this.sanitizeMeta(localDb, this.user),
          cat: '_meta'
        });
      }

      CATEGORIES.forEach((cat) => {
        const itemsMap = new Map((localDb[cat] || []).filter(i => i && i.id).map(i => [String(i.id), i]));
        const upserts = syncMeta.pendingUpserts[cat] || [];
        const deletes = syncMeta.pendingDeletes[cat] || [];

        upserts.forEach((id) => {
          const item = itemsMap.get(String(id));
          if (item) {
            const sanitized = this.sanitizeItem(cat, item);
            if (sanitized) {
              ops.push({
                type: 'set',
                ref: doc(this.db, 'users', uid, cat, String(id)),
                data: sanitized,
                cat,
                id: String(id)
              });
            }
          }
        });

        deletes.forEach((id) => {
          ops.push({
            type: 'delete',
            ref: doc(this.db, 'users', uid, cat, String(id)),
            cat,
            id: String(id)
          });
        });
      });

      if (!ops.length) {
        this.lastSyncedAt = Date.now();
        syncMeta.lastSyncedAt = this.lastSyncedAt;
        DB.saveSyncMeta(syncMeta);
        this.syncState = 'synced';
        this.notifyUI();
        if (isManual) App.toast('success', 'Already Synced', 'All local & cloud records match.');
        return true;
      }

      this.syncState = 'syncing';
      this.notifyUI();

      try {
        const chunks = chunkArray(ops, 350);
        for (const chunk of chunks) {
          const batch = writeBatch(this.db);
          chunk.forEach((op) => {
            if (op.type === 'set') batch.set(op.ref, op.data);
            else batch.delete(op.ref);
          });
          await withTimeout(batch.commit(), 12000, 'Network timeout syncing batch to Firestore');
        }

        // Only clear successfully committed ops (respect newer writes made mid-flight)
        const latestMeta = DB.getSyncMeta();
        ops.forEach((op) => {
          if (op.cat === '_meta') {
            latestMeta.metaDirty = false;
          } else if (op.type === 'set') {
            latestMeta.pendingUpserts[op.cat] = (latestMeta.pendingUpserts[op.cat] || []).filter(x => String(x) !== op.id);
          } else if (op.type === 'delete') {
            latestMeta.pendingDeletes[op.cat] = (latestMeta.pendingDeletes[op.cat] || []).filter(x => String(x) !== op.id);
          }
        });
        this.lastSyncedAt = Date.now();
        latestMeta.lastSyncedAt = this.lastSyncedAt;
        DB.saveSyncMeta(latestMeta);

        this.lastError = '';
        this.syncState = this.getPendingCount() > 0 ? 'syncing' : 'synced';
        this.notifyUI();

        if (isManual) {
          App.toast('success', 'Cloud Synced ✓', `${ops.length} store change(s) pushed to Firebase.`);
        }
        return true;
      } catch (err) {
        console.warn('[CloudSync] Flush deferred:', err.message);
        this.lastError = err.message || 'Cloud sync paused (offline/timeout)';
        this.syncState = this.isOnline() ? 'error' : 'offline-queued';
        this.notifyUI();
        if (isManual) {
          App.toast('warning', 'Sync Queued Locally', this.lastError);
        }
        return false;
      }
    }

    async forceUploadAll() {
      if (!this.user) {
        App.toast('warning', 'Not Signed In', 'Sign in first before pushing full store backup.');
        return;
      }
      const localDb = DB.getData();
      const meta = DB.getSyncMeta();
      meta.metaDirty = true;
      CATEGORIES.forEach((cat) => {
        meta.pendingUpserts[cat] = (localDb[cat] || []).filter(i => i && i.id).map(i => String(i.id));
      });
      DB.saveSyncMeta(meta);
      await this.flushPending(true);
    }

    getStatusSummary() {
      const cfg = this.getSavedConfig();
      const pending = this.getPendingCount();
      const online = this.isOnline();

      if (!cfg) {
        return {
          configured: false,
          signedIn: false,
          online,
          pending,
          badgeClass: 'badge-muted',
          label: online ? 'Local Only (Firebase Not Linked)' : 'Offline • Local Only',
          shortLabel: online ? 'Online • Local DB' : 'Offline • Local Mode'
        };
      }

      if (!this.user) {
        return {
          configured: true,
          signedIn: false,
          online,
          pending,
          projectId: cfg.projectId,
          badgeClass: 'badge-warning',
          label: online ? 'Configured • Sign In to Sync' : 'Offline • Local Mode',
          shortLabel: online ? 'Online • Sign In to Sync' : 'Offline • Local Mode'
        };
      }

      if (!online || this.syncState === 'offline-queued') {
        return {
          configured: true,
          signedIn: true,
          online,
          pending,
          projectId: cfg.projectId,
          userEmail: this.user.email || this.user.displayName || 'Connected Owner',
          badgeClass: 'badge-warning',
          label: pending > 0 ? `Offline • ${pending} queued for Cloud` : 'Offline • Cached Ready',
          shortLabel: pending > 0 ? `Offline • ${pending} Queued` : 'Offline • Cloud Cached'
        };
      }

      if (this.syncState === 'syncing' || pending > 0) {
        return {
          configured: true,
          signedIn: true,
          online,
          pending,
          projectId: cfg.projectId,
          userEmail: this.user.email || this.user.displayName || 'Connected Owner',
          badgeClass: 'badge-primary',
          label: `Syncing (${pending} pending)...`,
          shortLabel: 'Online • Syncing...'
        };
      }

      if (this.syncState === 'error') {
        return {
          configured: true,
          signedIn: true,
          online,
          pending,
          projectId: cfg.projectId,
          userEmail: this.user.email || this.user.displayName || 'Connected Owner',
          badgeClass: 'badge-danger',
          label: this.lastError || 'Sync Retry Needed',
          shortLabel: 'Online • Sync Error'
        };
      }

      return {
        configured: true,
        signedIn: true,
        online,
        pending: 0,
        projectId: cfg.projectId,
        userEmail: this.user.email || this.user.displayName || 'Connected Owner',
        badgeClass: 'badge-success',
        label: 'Online + Offline Synced ✓',
        shortLabel: 'Online • Cloud Synced'
      };
    }

    notifyUI() {
      const s = this.getStatusSummary();
      const statusEl = document.getElementById('system-online-status');
      const dotEl = document.getElementById('system-status-dot');
      if (statusEl) {
        statusEl.textContent = s.shortLabel;
      }
      if (dotEl) {
        if (!s.online) {
          dotEl.style.backgroundColor = 'var(--warning)';
          dotEl.style.boxShadow = '0 0 8px rgba(245, 158, 11, 0.7)';
        } else if (this.syncState === 'error') {
          dotEl.style.backgroundColor = 'var(--danger)';
          dotEl.style.boxShadow = '0 0 8px rgba(239, 68, 68, 0.7)';
        } else {
          dotEl.style.backgroundColor = 'var(--success)';
          dotEl.style.boxShadow = '0 0 8px rgba(16, 185, 129, 0.7)';
        }
      }

      const cardBadge = document.getElementById('firebase-cloud-card-badge');
      if (cardBadge) {
        cardBadge.className = `badge ${s.badgeClass}`;
        cardBadge.textContent = s.label;
      }

      const kpiTrend = document.getElementById('settings-cloud-kpi-trend');
      if (kpiTrend) {
        const db = window.DB ? DB.getData() : { products: [], invoices: [] };
        const cloudLabel = s.signedIn
          ? (s.pending > 0 ? `${s.pending} queued for cloud` : 'Cloud Synced ✓')
          : (s.configured ? 'Sign In to Sync' : 'Offline Ready');
        kpiTrend.textContent = `${(db.products || []).length} SKUs • ${cloudLabel}`;
      }

      const mount = document.getElementById('firebase-cloud-card-body');
      if (mount && window.App && App.currentView === 'settings' && typeof App.renderFirebaseCloudBody === 'function') {
        const active = document.activeElement;
        const isTypingHere = active && mount.contains(active) && ['INPUT', 'TEXTAREA'].includes(active.tagName);
        const signedInChanged = this._lastUiSignedIn !== Boolean(this.user);
        if (!isTypingHere || signedInChanged) {
          this._lastUiSignedIn = Boolean(this.user);
          mount.innerHTML = App.renderFirebaseCloudBody();
        }
      }
    }
  }

  window.CloudSync = new FirebaseCloudSync();

  window.addEventListener('DOMContentLoaded', () => {
    window.CloudSync.init();
  });

  window.addEventListener('online', async () => {
    if (window.CloudSync) {
      await window.CloudSync.init();
      if (window.CloudSync.user) {
        window.CloudSync.flushPending();
      }
      window.CloudSync.notifyUI();
    }
  });

  window.addEventListener('offline', () => {
    if (window.CloudSync) {
      if (window.CloudSync.user) {
        window.CloudSync.syncState = 'offline-queued';
      }
      window.CloudSync.notifyUI();
    }
  });
})();
