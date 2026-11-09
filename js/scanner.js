/**
 * MyDukkan24 — Universal Camera & Hardware Barcode Scanner Engine
 * Native BarcodeDetector + Html5Qrcode + USB/Bluetooth Barcode Gun integration.
 */

class BarcodeScannerEngine {
  constructor() {
    this.videoStream = null;
    this.isScanning = false;
    this.barcodeDetector = null;
    this.lastScannedCode = null;
    this.lastScanTime = 0;
    this.hardwareBuffer = '';
    this.hardwareLastKeyTime = 0;

    this.initBarcodeDetector();
    this.initHardwareScannerListener();
  }

  async initBarcodeDetector() {
    if ('BarcodeDetector' in window) {
      try {
        const formats = await BarcodeDetector.getSupportedFormats();
        this.barcodeDetector = new BarcodeDetector({
          formats: formats.length ? formats : ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'qr_code']
        });
      } catch (e) {
        console.warn('[Scanner] BarcodeDetector error:', e);
      }
    }
  }

  // Listen to USB/Bluetooth hardware barcode scanner guns
  initHardwareScannerListener() {
    window.addEventListener('keydown', (e) => {
      const now = Date.now();
      const diff = now - this.hardwareLastKeyTime;
      this.hardwareLastKeyTime = now;

      if (e.key === 'Enter') {
        if (this.hardwareBuffer.length >= 4 && diff < 80) {
          e.preventDefault();
          const scannedCode = this.hardwareBuffer.trim();
          this.hardwareBuffer = '';
          this.onBarcodeDetected(scannedCode, 'hardware');
        } else {
          this.hardwareBuffer = '';
        }
      } else if (e.key.length === 1) {
        if (diff > 120) {
          this.hardwareBuffer = e.key;
        } else {
          this.hardwareBuffer += e.key;
        }
      }
    });
  }

  // Open Camera Scanner Modal
  openScannerModal(onDetectedCallback = null) {
    this.customCallback = onDetectedCallback;
    this.lastScannedCode = null;

    const modalHtml = `
      <div class="scanner-modal-backdrop" id="scanner-modal" onclick="if(event.target === this) BarcodeScanner.closeScannerModal()">
        <div class="scanner-box">
          <div class="scanner-header">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="color: var(--primary); display: flex;">${Icons.camera(18)}</span>
              <div>
                <div style="font-weight: 700; font-size: 14.5px; color: var(--text-primary); display: flex; align-items: center; gap: 6px;">
                  <span>Barcode & QR Scanner</span>
                  <span class="badge badge-primary">Auto-Vision</span>
                </div>
                <div style="font-size: 11px; color: var(--text-muted);">Point camera at product barcode or scan with gun</div>
              </div>
            </div>
            <button class="topbar-icon-btn" onclick="BarcodeScanner.closeScannerModal()">✕</button>
          </div>

          <div class="scanner-viewport-wrap">
            <video id="scanner-video-preview" autoplay playsinline muted></video>
            <div class="scanner-target-reticle">
              <div class="scanner-laser"></div>
            </div>
            <div id="scanner-status-pill" style="position: absolute; bottom: 12px; background: rgba(0,0,0,0.75); color: #fff; font-size: 11px; padding: 4px 12px; border-radius: 100px; font-family: var(--font-mono);">
              Aim camera at barcode...
            </div>
          </div>

          <!-- Manual / Quick Barcode Search Bar -->
          <div style="padding: 10px 16px; background: var(--bg-input); border-bottom: 1px solid var(--border-subtle); display: flex; gap: 8px;">
            <input type="text" id="manual-barcode-input" class="form-input" style="padding: 6px 10px; font-size: 12.5px; font-family: var(--font-mono);" placeholder="Enter barcode (e.g. 8901058852336)" onkeydown="if(event.key==='Enter') BarcodeScanner.handleManualSubmit()" />
            <button class="btn btn-primary btn-sm" style="white-space: nowrap;" onclick="BarcodeScanner.handleManualSubmit()">
              ${Icons.search(13)} Lookup
            </button>
          </div>

          <!-- Detection Result Card Area -->
          <div id="scanned-detection-area" style="display: none;" class="scanned-detection-card"></div>

          <div style="padding: 10px 16px; display: flex; align-items: center; justify-content: space-between; background: var(--bg-surface); flex-wrap: wrap; gap: 8px;">
            <div style="display: flex; gap: 6px; flex-wrap: wrap;">
              <button class="btn btn-secondary btn-sm" onclick="BarcodeScanner.switchCamera()">Flip Camera</button>
              <button class="btn btn-secondary btn-sm" onclick="BarcodeScanner.simulateSampleScan()">Demo Barcode</button>
            </div>
            <button class="btn btn-secondary btn-sm" onclick="BarcodeScanner.closeScannerModal()">Close</button>
          </div>
        </div>
      </div>
    `;

    const existing = document.getElementById('scanner-modal');
    if (existing) existing.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    this.startCamera();
  }

  async startCamera(facingMode = 'environment') {
    this.currentFacingMode = facingMode;

    // 1. Try universal Html5Qrcode if loaded
    if (window.Html5Qrcode) {
      try {
        const viewportWrap = document.querySelector('.scanner-viewport-wrap');
        if (viewportWrap) {
          viewportWrap.innerHTML = `
            <div id="html5-qr-reader" style="width: 100%; height: 100%;"></div>
            <div class="scanner-target-reticle" style="pointer-events: none;">
              <div class="scanner-laser"></div>
            </div>
            <div id="scanner-status-pill" style="position: absolute; bottom: 12px; background: rgba(0,0,0,0.75); color: #fff; font-size: 11px; padding: 4px 12px; border-radius: 100px; font-family: var(--font-mono); pointer-events: none;">
              Aim camera at barcode...
            </div>
          `;
        }

        if (this.html5QrCode) {
          try { await this.html5QrCode.stop(); } catch(e){}
        }

        this.html5QrCode = new Html5Qrcode("html5-qr-reader");
        await this.html5QrCode.start(
          { facingMode: facingMode },
          { fps: 15, qrbox: { width: 240, height: 140 } },
          (decodedText) => {
            const now = Date.now();
            if (decodedText && (decodedText !== this.lastScannedCode || now - this.lastScanTime > 2500)) {
              this.lastScannedCode = decodedText;
              this.lastScanTime = now;
              this.onBarcodeDetected(decodedText, 'camera');
            }
          },
          () => {}
        );
        this.isScanning = true;
        return;
      } catch (e) {
        console.warn('[Scanner] Html5Qrcode fallback to native:', e);
      }
    }

    // 2. Native getUserMedia fallback
    const video = document.getElementById('scanner-video-preview');
    if (!video) return;

    try {
      if (this.videoStream) {
        this.videoStream.getTracks().forEach(track => track.stop());
      }

      this.videoStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facingMode }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });

      video.srcObject = this.videoStream;
      video.setAttribute('playsinline', true);
      await video.play();

      this.isScanning = true;
      this.startScanningLoop(video);
    } catch (err) {
      console.warn('[Scanner] Camera access unavailable:', err);
      const statusPill = document.getElementById('scanner-status-pill');
      if (statusPill) {
        statusPill.textContent = 'Camera unavailable. Use manual lookup or Demo Barcode button.';
        statusPill.style.color = '#EF4444';
      }
    }
  }

  startScanningLoop(video) {
    if (!this.barcodeDetector) return;

    const checkFrame = async () => {
      if (!this.isScanning || !video || video.readyState < 2) {
        if (this.isScanning) requestAnimationFrame(checkFrame);
        return;
      }

      try {
        const barcodes = await this.barcodeDetector.detect(video);
        if (barcodes && barcodes.length > 0) {
          const rawCode = barcodes[0].rawValue;
          const now = Date.now();
          if (rawCode && (rawCode !== this.lastScannedCode || now - this.lastScanTime > 2500)) {
            this.lastScannedCode = rawCode;
            this.lastScanTime = now;
            this.onBarcodeDetected(rawCode, 'camera');
          }
        }
      } catch (e) {}

      if (this.isScanning) {
        requestAnimationFrame(checkFrame);
      }
    };

    requestAnimationFrame(checkFrame);
  }

  // Handle detected barcode
  onBarcodeDetected(barcode, source = 'camera') {
    DB.playScanBeep();
    const cleanCode = String(barcode || '').trim();
    if (!cleanCode) return;

    if (this.customCallback) {
      this.customCallback(cleanCode);
      this.closeScannerModal();
      return;
    }

    const db = DB.getData();
    const product = db.products.find(p => p.barcode === cleanCode || p.id === cleanCode);

    let resultArea = document.getElementById('scanned-detection-area');

    if (product) {
      if (!resultArea) {
        if (window.POS) POS.addItemToCart(product);
        App.toast('success', `Scanned: ${product.name}`, `Added to bill (₹${product.price})`);
        return;
      }

      resultArea.style.display = 'block';
      const discount = product.mrp > product.price ? product.mrp - product.price : 0;

      resultArea.innerHTML = `
        <div style="background: var(--bg-surface); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <div style="font-weight: 700; font-size: 14px; color: var(--text-primary);">${product.name}</div>
            <span class="badge badge-success">In Stock (${product.stock} ${product.unit})</span>
          </div>
          <div style="font-size: 12px; color: var(--text-muted); display: flex; gap: 8px;">
            <span>Barcode: ${product.barcode}</span>
            <span>MRP: ₹${product.mrp}</span>
            <span style="font-weight: 700; color: var(--text-primary);">Price: ₹${product.price}</span>
            ${discount > 0 ? `<span style="color: var(--success); font-weight: 600;">Save ₹${discount}</span>` : ''}
          </div>
          <div style="display: flex; gap: 8px; margin-top: 10px;">
            <button class="btn btn-primary" style="flex: 1;" onclick="BarcodeScanner.addToCartFromScanner('${product.id}')">
              ${Icons.plus(14)} Add to Bill Cart (₹${product.price})
            </button>
            <button class="btn btn-secondary btn-sm" onclick="BarcodeScanner.closeScannerModal(); App.navigate('inventory'); Inventory.openEditProductModal('${product.id}')">
              ${Icons.edit(13)} Edit
            </button>
          </div>
        </div>
      `;
    } else {
      if (!resultArea) {
        this.openScannerModal();
        resultArea = document.getElementById('scanned-detection-area');
      }

      if (resultArea) {
        resultArea.style.display = 'block';
        this.fetchAndRenderGoogleBarcode(cleanCode);
      }
    }
  }

  // Indian Kirana & FMCG Master Catalog (Instant Offline 0ms Resolution)
  static get FMCG_MASTER_DB() {
    return {
      "8901030383847": { name: "Aashirvaad Shudh Chakki Atta 5kg", brand: "ITC", cat: "Grocery", mrp: 270, price: 235, cost: 198, unit: "bag", emoji: "🌾" },
      "8906007280014": { name: "Fortune Sunlite Refined Sunflower Oil 1L", brand: "Adani Wilmar", cat: "Oils", mrp: 180, price: 155, cost: 130, unit: "pouch", emoji: "🫙" },
      "8901262010057": { name: "Amul Butter 500g", brand: "Amul", cat: "Dairy", mrp: 290, price: 275, cost: 240, unit: "pack", emoji: "🧈" },
      "8901052002139": { name: "Tata Tea Gold 500g", brand: "Tata Consumer", cat: "Beverages", mrp: 350, price: 310, cost: 265, unit: "box", emoji: "☕" },
      "8901058852233": { name: "Maggi 2-Minute Masala Noodles 70g", brand: "Nestlé", cat: "Snacks", mrp: 14, price: 14, cost: 11.5, unit: "pack", emoji: "🍜" },
      "8901058852336": { name: "Maggi 2-Minute Masala Noodles 140g", brand: "Nestlé", cat: "Snacks", mrp: 28, price: 28, cost: 23, unit: "pack", emoji: "🍜" },
      "8901030004926": { name: "Surf Excel Quick Wash Detergent Powder 1kg", brand: "HUL", cat: "Household", mrp: 160, price: 140, cost: 118, unit: "pack", emoji: "🧼" },
      "7622201438902": { name: "Cadbury Dairy Milk Silk Chocolate 60g", brand: "Mondelez", cat: "Chocolates", mrp: 105, price: 90, cost: 75, unit: "bar", emoji: "🍫" },
      "8901719101053": { name: "Parle-G Gold Biscuits 100g", brand: "Parle", cat: "Snacks", mrp: 15, price: 15, cost: 12, unit: "pack", emoji: "🍪" },
      "8901314010529": { name: "Colgate Total Advanced Health Toothpaste 120g", brand: "Colgate", cat: "Personal Care", mrp: 110, price: 95, cost: 75, unit: "tube", emoji: "🪥" },
      "8901396112104": { name: "Dettol Antiseptic Liquid 250ml", brand: "Reckitt", cat: "Healthcare", mrp: 145, price: 130, cost: 105, unit: "bottle", emoji: "🧴" },
      "8901030383841": { name: "India Gate Basmati Rice Feast Rozzana 1kg", brand: "KRBL", cat: "Grocery", mrp: 140, price: 120, cost: 95, unit: "kg", emoji: "🍚" },
      "8901030383858": { name: "Tata Sampann Unpolished Toor Dal 1kg", brand: "Tata", cat: "Grocery", mrp: 200, price: 175, cost: 145, unit: "kg", emoji: "🫘" },
      "8901491101830": { name: "Lay's India's Magic Masala Chips 50g", brand: "PepsiCo", cat: "Snacks", mrp: 20, price: 20, cost: 16.5, unit: "pack", emoji: "🥔" },
      "8901725131235": { name: "Aashirvaad Superior MP Atta 10kg", brand: "ITC", cat: "Grocery", mrp: 490, price: 445, cost: 385, unit: "bag", emoji: "🌾" },
      "8904258116198": { name: "Indian Retail FMCG Pack", brand: "Retail", cat: "Grocery", mrp: 30, price: 25, cost: 20, unit: "pack", emoji: "🍿" },
      "5449000000996": { name: "Coca-Cola Original Can 330ml", brand: "Coca-Cola", cat: "Beverages", mrp: 40, price: 40, cost: 32, unit: "can", emoji: "🥤" }
    };
  }

  async fetchAndRenderGoogleBarcode(barcode) {
    const resultArea = document.getElementById('scanned-detection-area');
    if (!resultArea) return;

    resultArea.innerHTML = `
      <div style="padding: 14px; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); text-align: center;">
        <div style="display: inline-block; width: 18px; height: 18px; border: 2px solid var(--primary); border-top-color: transparent; border-radius: 50%; animation: spin 0.6s linear infinite; margin-bottom: 6px;"></div>
        <div style="font-size: 13px; font-weight: 700; color: var(--text-primary);">
          Identifying Barcode ${barcode}...
        </div>
        <div style="font-size: 11.5px; color: var(--text-muted); margin-top: 2px;">
          Checking Open Food Facts & FMCG Master Registry
        </div>
      </div>
    `;

    let matchedItem = null;
    let sourceLabel = '';

    // Step 1: Check Local Master FMCG Dictionary (0ms offline)
    if (BarcodeScanner.FMCG_MASTER_DB[barcode]) {
      matchedItem = { ...BarcodeScanner.FMCG_MASTER_DB[barcode], barcode };
      sourceLabel = 'Verified Kirana Master DB';
    }

    // Step 2: Check Local Scanned Product Cache
    if (!matchedItem) {
      try {
        const cached = JSON.parse(localStorage.getItem('mydukaan24_barcode_cache') || '{}');
        if (cached[barcode]) {
          matchedItem = cached[barcode];
          sourceLabel = 'Local Barcode Cache';
        }
      } catch(e){}
    }

    // Step 3: Check Open Food Facts Global API
    if (!matchedItem) {
      try {
        const offRes = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=product_name,brands,categories,quantity,image_front_url`, {
          signal: AbortSignal.timeout(3500)
        });
        if (offRes.ok) {
          const offData = await offRes.json();
          if (offData && offData.status === 1 && offData.product) {
            const p = offData.product;
            const name = p.product_name ? `${p.product_name} ${p.quantity || ''}`.trim() : '';
            if (name) {
              matchedItem = {
                barcode,
                name: name,
                brand: p.brands || 'Packaged Brand',
                cat: this.normalizeCategory(p.categories || 'Grocery'),
                mrp: 30,
                price: 28,
                cost: 23,
                unit: p.quantity ? 'unit' : 'pack',
                imageUrl: p.image_front_url || null,
                emoji: '📦'
              };
              sourceLabel = 'Open Food Facts Registry';
            }
          }
        }
      } catch(e) {}
    }

    // Step 4: AI Grounding Lookup (Netlify / Gemini)
    if (!matchedItem && window.DukaanAI && typeof DukaanAI.lookupBarcodeOnline === 'function') {
      try {
        const geminiResult = await DukaanAI.lookupBarcodeOnline(barcode);
        if (geminiResult && geminiResult.name) {
          matchedItem = geminiResult;
          sourceLabel = 'Google Gemini Grounding';
        }
      } catch (err) {}
    }

    const freshArea = document.getElementById('scanned-detection-area');
    if (!freshArea) return;

    if (matchedItem && matchedItem.name) {
      const cleanName = matchedItem.name;
      const cleanPrice = Number(matchedItem.price) || 20;
      const cleanMrp = Number(matchedItem.mrp) || Math.round(cleanPrice * 1.15);
      const cleanCost = Number(matchedItem.cost) || Math.round(cleanPrice * 0.85);
      const cleanCat = matchedItem.cat || 'Grocery';
      const cleanBrand = matchedItem.brand || '';
      const cleanImg = matchedItem.imageUrl || null;

      // Cache this barcode locally for instant future scans
      try {
        const cache = JSON.parse(localStorage.getItem('mydukaan24_barcode_cache') || '{}');
        cache[barcode] = matchedItem;
        localStorage.setItem('mydukaan24_barcode_cache', JSON.stringify(cache));
      } catch(e){}

      freshArea.innerHTML = `
        <div style="background: var(--bg-surface); padding: 14px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span class="badge badge-primary">⚡ ${sourceLabel}</span>
            <span style="font-size: 11px; font-family: var(--font-mono); color: var(--text-muted);">EAN: ${barcode}</span>
          </div>

          <div style="display: flex; gap: 12px; align-items: center; margin-bottom: 12px;">
            ${cleanImg ? `
              <img src="${cleanImg}" alt="Product" style="width: 50px; height: 50px; border-radius: 8px; object-fit: contain; background: #fff; padding: 2px;" onerror="this.style.display='none'" />
            ` : `<div style="font-size: 32px;">${matchedItem.emoji || '📦'}</div>`}
            <div style="flex: 1;">
              <div style="font-size: 14px; font-weight: 800; color: var(--text-primary);">${cleanName}</div>
              <div style="font-size: 11.5px; color: var(--text-secondary); margin-top: 2px;">
                ${cleanBrand ? `Brand: <strong>${cleanBrand}</strong> • ` : ''}Category: <strong>${cleanCat}</strong>
              </div>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 8px; margin-bottom: 10px;">
            <div>
              <label class="form-label" style="font-size: 10.5px;">Product Name</label>
              <input type="text" id="google-edit-name" class="form-input" style="font-size: 12px;" value="${cleanName}" />
            </div>
            <div>
              <label class="form-label" style="font-size: 10.5px;">Sell Price (₹)</label>
              <input type="number" id="google-edit-price" class="form-input" style="font-size: 12px;" value="${cleanPrice}" />
            </div>
            <div>
              <label class="form-label" style="font-size: 10.5px;">MRP (₹)</label>
              <input type="number" id="google-edit-mrp" class="form-input" style="font-size: 12px;" value="${cleanMrp}" />
            </div>
          </div>

          <button class="btn btn-primary" style="width: 100%; justify-content: center;" onclick="BarcodeScanner.confirmAndSaveProduct('${barcode}', '${cleanCat}', '${cleanCost}')">
            ${Icons.check(14)} Save into Inventory & Add to Bill (₹${cleanPrice})
          </button>
        </div>
      `;
    } else {
      // Clean fallback: Allow merchant to type once and save permanently
      freshArea.innerHTML = `
        <div style="background: var(--bg-surface); padding: 14px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <div style="font-size: 12.5px; font-weight: 700; color: var(--warning);">
              Unregistered Barcode: ${barcode}
            </div>
            <span class="badge badge-warning">New Item</span>
          </div>
          <p style="font-size: 11.5px; color: var(--text-muted); margin-bottom: 10px;">
            This barcode is not in public databases yet. Enter details below to register once — it will be remembered permanently:
          </p>
          <div style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 8px; margin-bottom: 10px;">
            <div>
              <label class="form-label" style="font-size: 10.5px;">Product Name *</label>
              <input type="text" id="quick-add-name" class="form-input" placeholder="e.g. Parle Hide & Seek 120g" required />
            </div>
            <div>
              <label class="form-label" style="font-size: 10.5px;">Selling Price *</label>
              <input type="number" id="quick-add-price" class="form-input" placeholder="₹ Price" required />
            </div>
            <div>
              <label class="form-label" style="font-size: 10.5px;">Category</label>
              <select id="quick-add-cat" class="form-select" style="font-size: 11.5px;">
                <option value="Grocery">Grocery</option>
                <option value="Snacks">Snacks</option>
                <option value="Beverages">Beverages</option>
                <option value="Dairy">Dairy</option>
                <option value="Personal Care">Personal Care</option>
                <option value="Household">Household</option>
              </select>
            </div>
          </div>
          <button class="btn btn-primary" style="width: 100%; justify-content: center;" onclick="BarcodeScanner.quickRegisterAndAddToCart('${barcode}')">
            ${Icons.check(14)} Save to Inventory & Add to Bill
          </button>
        </div>
      `;
    }
  }

  normalizeCategory(catStr) {
    if (!catStr) return 'Grocery';
    const c = String(catStr).toLowerCase();
    if (c.includes('beverage') || c.includes('drink') || c.includes('tea') || c.includes('coffee') || c.includes('cola')) return 'Beverages';
    if (c.includes('dairy') || c.includes('milk') || c.includes('cheese') || c.includes('butter')) return 'Dairy';
    if (c.includes('snack') || c.includes('biscuit') || c.includes('chip') || c.includes('cookie')) return 'Snacks';
    if (c.includes('oil') || c.includes('ghee') || c.includes('fat')) return 'Oils';
    if (c.includes('soap') || c.includes('clean') || c.includes('detergent')) return 'Household';
    if (c.includes('personal') || c.includes('hygiene') || c.includes('cosmetic')) return 'Personal Care';
    return 'Grocery';
  }

  confirmAndSaveProduct(barcode, cat = 'Grocery') {
    const nameIn = document.getElementById('google-edit-name');
    const priceIn = document.getElementById('google-edit-price');
    const mrpIn = document.getElementById('google-edit-mrp');

    const name = nameIn && nameIn.value.trim() ? nameIn.value.trim() : `Product ${barcode.slice(-4)}`;
    const price = priceIn && parseFloat(priceIn.value) > 0 ? parseFloat(priceIn.value) : 20;
    const mrp = mrpIn && parseFloat(mrpIn.value) > 0 ? parseFloat(mrpIn.value) : Math.round(price * 1.15);
    const cost = Math.round(price * 0.85);

    const newProduct = {
      id: `P${Date.now().toString().slice(-4)}`,
      name,
      cat,
      barcode,
      mrp,
      price,
      cost,
      stock: 25,
      unit: 'pack',
      minStock: 5
    };

    DB.updateItem('products', newProduct);
    if (window.POS) POS.addItemToCart(newProduct);
    if (window.Inventory) Inventory.render();

    App.toast('success', 'Product Saved', `${name} added at ₹${price}`);
    this.closeScannerModal();
  }

  quickRegisterAndAddToCart(barcode) {
    const nameInput = document.getElementById('quick-add-name');
    const priceInput = document.getElementById('quick-add-price');
    const catInput = document.getElementById('quick-add-cat');

    const name = nameInput && nameInput.value.trim() ? nameInput.value.trim() : `Product ${barcode.slice(-4)}`;
    const price = priceInput && parseFloat(priceInput.value) > 0 ? parseFloat(priceInput.value) : 20;
    const cat = catInput ? catInput.value : 'Grocery';
    const mrp = Math.round(price * 1.15);
    const cost = Math.round(price * 0.85);

    const newProduct = {
      id: `P${Date.now().toString().slice(-4)}`,
      name,
      cat,
      barcode,
      mrp,
      price,
      cost,
      stock: 25,
      unit: "pack",
      minStock: 5
    };

    DB.updateItem('products', newProduct);
    if (window.POS) POS.addItemToCart(newProduct);
    if (window.Inventory) Inventory.render();

    App.toast('success', 'Product Saved', `${name} added at ₹${price}`);
    this.closeScannerModal();
  }

  addToCartFromScanner(productId) {
    const db = DB.getData();
    const product = db.products.find(p => p.id === productId);
    if (product) {
      if (window.POS) POS.addItemToCart(product);
      App.toast('success', 'Added to Cart', `${product.name} (₹${product.price})`);
      this.closeScannerModal();
    }
  }

  handleManualSubmit() {
    const input = document.getElementById('manual-barcode-input');
    if (!input || !input.value.trim()) return;
    const code = input.value.trim();
    this.onBarcodeDetected(code, 'manual');
  }

  simulateSampleScan() {
    const sampleBarcodes = ["8901058852336", "8901725131235", "8901262010053", "8901030015520"];
    const randomCode = sampleBarcodes[Math.floor(Math.random() * sampleBarcodes.length)];
    const input = document.getElementById('manual-barcode-input');
    if (input) input.value = randomCode;
    this.onBarcodeDetected(randomCode, 'demo');
  }

  switchCamera() {
    const nextMode = this.currentFacingMode === 'environment' ? 'user' : 'environment';
    this.startCamera(nextMode);
  }

  closeScannerModal() {
    this.isScanning = false;
    if (this.html5QrCode) {
      try { this.html5QrCode.stop(); } catch(e){}
    }
    if (this.videoStream) {
      this.videoStream.getTracks().forEach(t => t.stop());
      this.videoStream = null;
    }
    const modal = document.getElementById('scanner-modal');
    if (modal) modal.remove();
  }
}

window.BarcodeScanner = new BarcodeScannerEngine();
