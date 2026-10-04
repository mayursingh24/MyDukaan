/**
 * MyDukaan Pro — High-Speed Camera & Hardware Barcode Scanner Engine
 * Features:
 * 1. Native BarcodeDetector + Html5Qrcode Universal Camera Scanning
 * 2. USB / Bluetooth Hardware Barcode Gun Instant Interceptor
 * 3. Real-Time Google Grounding & Web EAN-13 Barcode Fetcher
 * Created & Deployed by Mayur Singh (Lucknow, India)
 */

class BarcodeScannerEngine {
  constructor() {
    this.videoStream = null;
    this.isScanning = false;
    this.scanInterval = null;
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
        console.log('[Scanner] Native BarcodeDetector initialized ✓');
      } catch (e) {
        console.warn('[Scanner] Native BarcodeDetector error:', e);
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
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="font-size:20px;">📷</span>
              <div>
                <div style="font-weight:700;font-size:15px;color:var(--text-primary);display:flex;align-items:center;gap:6px;">
                  <span>Barcode & QR Scanner</span>
                  <span class="badge" style="background:rgba(66,133,244,0.15);color:#60A5FA;font-size:9px;padding:2px 6px;">Google AI Enabled</span>
                </div>
                <div style="font-size:11px;color:var(--text-muted);">Point camera at product barcode or scan with gun</div>
              </div>
            </div>
            <button class="topbar-icon-btn" onclick="BarcodeScanner.closeScannerModal()">✕</button>
          </div>

          <div class="scanner-viewport-wrap">
            <video id="scanner-video-preview" autoplay playsinline muted></video>
            <div class="scanner-target-reticle">
              <div class="scanner-laser"></div>
            </div>
            <div id="scanner-status-pill" style="position:absolute;bottom:12px;background:rgba(0,0,0,0.7);color:#fff;font-size:11px;padding:3px 10px;border-radius:100px;font-family:var(--font-mono);">
              Aim camera at barcode...
            </div>
          </div>

          <!-- Manual / Quick Barcode Simulation -->
          <div style="padding:12px 18px;background:var(--bg-input);border-bottom:1px solid var(--border-subtle);display:flex;gap:8px;">
            <input type="text" id="manual-barcode-input" class="form-input" style="padding:6px 10px;font-size:12px;font-family:var(--font-mono);" placeholder="Enter barcode (e.g. 8901058852336)" onkeydown="if(event.key==='Enter') BarcodeScanner.handleManualSubmit()" />
            <button class="btn btn-primary btn-sm" style="white-space:nowrap;" onclick="BarcodeScanner.handleManualSubmit()">🔍 Google Search</button>
          </div>

          <!-- Detection Result Card Area -->
          <div id="scanned-detection-area" style="display:none;" class="scanned-detection-card"></div>

          <div style="padding:12px 18px;display:flex;align-items:center;justify-content:space-between;background:var(--bg-surface);flex-wrap:wrap;gap:8px;">
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
              <button class="btn btn-secondary btn-sm" onclick="BarcodeScanner.switchCamera()">🔄 Flip Camera</button>
              <button class="btn btn-secondary btn-sm" onclick="BarcodeScanner.simulateSampleScan()">⚡ Demo Barcode</button>
              <button class="btn btn-primary btn-sm" style="background:linear-gradient(135deg, #4285F4, #34A853);font-size:11px;" onclick="BarcodeScanner.testGoogleFetchDemo()">🌐 Test Google Fetch</button>
            </div>
            <button class="btn btn-secondary btn-sm" onclick="BarcodeScanner.closeScannerModal()">Close</button>
          </div>
        </div>
      </div>
    `;

    // Append to body
    const existing = document.getElementById('scanner-modal');
    if (existing) existing.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Start video stream
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
            <div id="scanner-status-pill" style="position: absolute; bottom: 12px; background: rgba(0,0,0,0.7); color: #fff; font-size: 11px; padding: 3px 10px; border-radius: 100px; font-family: var(--font-mono); pointer-events: none;">
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
          { fps: 15, qrbox: { width: 240, height: 150 } },
          (decodedText) => {
            const now = Date.now();
            if (decodedText && (decodedText !== this.lastScannedCode || now - this.lastScanTime > 2500)) {
              this.lastScannedCode = decodedText;
              this.lastScanTime = now;
              this.onBarcodeDetected(decodedText, 'camera');
            }
          },
          (errorMessage) => {}
        );
        this.isScanning = true;
        return;
      } catch (e) {
        console.warn('[Scanner] Html5Qrcode error, falling back to native stream:', e);
      }
    }

    // 2. Native getUserMedia + BarcodeDetector fallback
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
      console.warn('[Scanner] Camera access failed or denied:', err);
      const statusPill = document.getElementById('scanner-status-pill');
      if (statusPill) {
        statusPill.textContent = 'Camera unavailable. Use manual lookup or Demo button.';
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

    const db = DB.getData();
    const product = db.products.find(p => p.barcode === cleanCode || p.id === cleanCode);

    let resultArea = document.getElementById('scanned-detection-area');

    if (product) {
      if (!resultArea) {
        // Hardware scan in POS billing view without open modal
        if (window.POS) POS.addItemToCart(product);
        App.toast('success', `Scanned: ${product.name}`, `Added to bill (₹${product.price})`);
        return;
      }

      resultArea.style.display = 'block';
      const discount = product.mrp > product.price ? product.mrp - product.price : 0;
      const discountPct = product.mrp > 0 ? Math.round((discount / product.mrp) * 100) : 0;

      resultArea.innerHTML = `
        <div class="scanned-item-match">
          <div style="display:flex;align-items:center;gap:12px;">
            <div style="font-size:26px;">${product.emoji || '📦'}</div>
            <div>
              <div style="font-weight:700;font-size:14px;color:var(--text-primary);">${product.name}</div>
              <div style="font-size:12px;color:var(--text-secondary);display:flex;align-items:center;gap:8px;margin-top:2px;">
                <span style="font-family:var(--font-mono);color:var(--text-muted);">${product.barcode}</span>
                <span style="text-decoration:line-through;color:var(--text-muted);">MRP: ₹${product.mrp}</span>
                <span style="font-weight:700;color:var(--success);">₹${product.price}</span>
              </div>
            </div>
          </div>
          <div style="text-align:right;">
            <div class="badge badge-success">In Stock (${product.stock} ${product.unit})</div>
            ${discount > 0 ? `<div style="font-size:10px;color:var(--success);font-weight:700;margin-top:4px;">Save ₹${discount} (${discountPct}%)</div>` : ''}
          </div>
        </div>
        <div style="display:flex;gap:10px;margin-top:8px;">
          <button class="btn btn-primary w100" style="flex:1;" onclick="BarcodeScanner.addToCartFromScanner('${product.id}')">
            🛒 Add to Cart (₹${product.price})
          </button>
          <button class="btn btn-secondary" onclick="BarcodeScanner.closeScannerModal(); App.navigate('inventory'); Inventory.openEditProductModal('${product.id}')">
            ✏️ Edit Product
          </button>
        </div>
      `;
    } else {
      // Unregistered barcode: Open modal if not open, and fetch from Google!
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

  // Real-Time Google & Web Barcode Fetcher
  async fetchAndRenderGoogleBarcode(barcode) {
    const resultArea = document.getElementById('scanned-detection-area');
    if (!resultArea) return;

    // 1. Animated Google Search Radar Indicator
    resultArea.innerHTML = `
      <div style="padding:14px 16px; background:linear-gradient(135deg, rgba(66, 133, 244, 0.08), rgba(52, 168, 83, 0.08)); border:1px solid rgba(66, 133, 244, 0.3); border-radius:var(--radius-md);">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:20px;">🌐</span>
            <div>
              <div style="font-weight:700; font-size:13.5px; color:#fff; display:flex; align-items:center; gap:6px;">
                <span>Google se product fetch ho raha hai...</span>
                <span class="badge" style="background:#4285F4; color:#fff; font-size:9px; padding:1px 6px;">Live Grounding</span>
              </div>
              <div style="font-size:11.5px; color:var(--text-muted); margin-top:2px;">
                Barcode: <strong style="font-family:var(--font-mono); color:#93C5FD;">${barcode}</strong>
              </div>
            </div>
          </div>
          <div class="typing-dots-spinner">
            <span></span><span></span><span></span>
          </div>
        </div>
        <div style="height:3px; background:rgba(255,255,255,0.08); border-radius:99px; overflow:hidden; margin-top:10px;">
          <div class="google-rainbow-bar"></div>
        </div>
      </div>
    `;

    let fetchedProduct = null;

    // 2. Query Gemini via Netlify / Direct Client
    try {
      if (window.DukaanAI && typeof DukaanAI.lookupBarcodeOnline === 'function') {
        const geminiResult = await DukaanAI.lookupBarcodeOnline(barcode);
        if (geminiResult && geminiResult.name) {
          fetchedProduct = geminiResult;
        }
      }
    } catch (err) {
      console.warn('[Barcode Scanner] Gemini online lookup failed:', err);
    }

    // 3. Fallback / Augment via OpenFoodFacts
    if (!fetchedProduct || !fetchedProduct.name) {
      try {
        const offRes = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`).then(r => r.json());
        if (offRes && offRes.status === 1 && offRes.product) {
          const offProd = offRes.product;
          const offName = offProd.product_name || offProd.product_name_en || offProd.generic_name || '';
          const offBrand = offProd.brands || '';
          const offQuantity = offProd.quantity || '';
          const fullTitle = [offBrand, offName, offQuantity].filter(Boolean).join(' ');

          if (fullTitle.trim()) {
            fetchedProduct = {
              barcode: barcode,
              name: fullTitle.trim(),
              brand: offBrand,
              cat: 'Grocery',
              mrp: 30,
              price: 30,
              cost: 25,
              stock: 25,
              unit: 'pack',
              emoji: '📦'
            };
          }
        }
      } catch (offErr) {
        console.warn('[Barcode Scanner] OpenFoodFacts fallback error:', offErr);
      }
    }

    // Verify modal is still active
    const freshArea = document.getElementById('scanned-detection-area');
    if (!freshArea) return;

    if (fetchedProduct && fetchedProduct.name) {
      // 4. Render Google Found Card with 1-Tap Action
      const cleanName = fetchedProduct.name.replace(/"/g, '&quot;');
      const cleanPrice = Number(fetchedProduct.price) || 20;
      const cleanMrp = Number(fetchedProduct.mrp) || cleanPrice;
      const cleanCat = fetchedProduct.cat || 'Grocery';
      const cleanEmoji = fetchedProduct.emoji || '📦';
      const brandStr = fetchedProduct.brand ? `Brand: <strong style="color:var(--text-primary);">${fetchedProduct.brand}</strong> • ` : '';

      freshArea.innerHTML = `
        <div style="padding:14px; background:linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(59, 130, 246, 0.08)); border:1px solid rgba(16, 185, 129, 0.35); border-radius:var(--radius-md);">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="background:linear-gradient(135deg, #4285F4, #34A853); color:#fff; font-size:10.5px; font-weight:700; padding:2px 8px; border-radius:6px; display:inline-flex; align-items:center; gap:4px;">
                <span>🌐</span> Google Verified
              </span>
              <span style="font-family:var(--font-mono); font-size:11px; color:var(--text-muted);">${barcode}</span>
            </div>
            <span class="badge badge-success" style="font-size:10px; font-weight:700;">✓ Auto-Fetched</span>
          </div>

          <div style="display:flex; align-items:center; gap:10px; margin-bottom:12px; background:var(--bg-surface); padding:8px 12px; border-radius:8px; border:1px solid var(--border-subtle);">
            <div style="font-size:28px; width:44px; height:44px; display:flex; align-items:center; justify-content:center; background:var(--bg-input); border-radius:8px;">
              ${cleanEmoji}
            </div>
            <div style="flex:1; min-width:0;">
              <div style="font-weight:700; font-size:13.5px; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                ${cleanName}
              </div>
              <div style="font-size:11.5px; color:var(--text-secondary); margin-top:2px;">
                ${brandStr}Category: <strong style="color:var(--text-primary);">${cleanCat}</strong>
              </div>
            </div>
          </div>

          <div style="display:grid; grid-template-columns:2fr 1fr 1fr; gap:8px; margin-bottom:12px;">
            <div>
              <label style="font-size:10px; color:var(--text-muted); font-weight:700; text-transform:uppercase;">Product Name</label>
              <input type="text" id="google-edit-name" class="form-input" style="padding:6px 8px; font-size:12px; margin-top:2px;" value="${cleanName}" />
            </div>
            <div>
              <label style="font-size:10px; color:var(--text-muted); font-weight:700; text-transform:uppercase;">Price (₹)</label>
              <input type="number" id="google-edit-price" class="form-input" style="padding:6px 8px; font-size:12px; font-family:var(--font-mono); margin-top:2px;" value="${cleanPrice}" oninput="const b=document.getElementById('google-btn-price'); if(b) b.textContent=this.value;" />
            </div>
            <div>
              <label style="font-size:10px; color:var(--text-muted); font-weight:700; text-transform:uppercase;">MRP (₹)</label>
              <input type="number" id="google-edit-mrp" class="form-input" style="padding:6px 8px; font-size:12px; font-family:var(--font-mono); margin-top:2px;" value="${cleanMrp}" />
            </div>
          </div>

          <div style="display:flex; gap:8px;">
            <button class="btn btn-primary" style="flex:1; justify-content:center; font-weight:800; background:linear-gradient(135deg, #10B981, #059669); box-shadow:0 4px 14px rgba(16,185,129,0.35); padding:9px 12px; font-size:13px;" onclick="BarcodeScanner.confirmAndSaveProduct('${barcode}', '${cleanCat}', '${cleanEmoji}')">
              ⚡ Save & Add to Bill (₹<span id="google-btn-price">${cleanPrice}</span>)
            </button>
            <button class="btn btn-secondary btn-sm" onclick="BarcodeScanner.closeScannerModal(); App.navigate('inventory'); Inventory.openAddProductWithBarcode('${barcode}')">
              Edit Form
            </button>
          </div>
        </div>
      `;
    } else {
      // 5. Friendly Manual Fallback if not found on Google / offline
      freshArea.innerHTML = `
        <div style="padding:14px; background:rgba(245, 158, 11, 0.08); border:1px solid rgba(245, 158, 11, 0.3); border-radius:var(--radius-md);">
          <div style="font-weight:700; color:var(--warning); font-size:13px; display:flex; align-items:center; justify-content:space-between;">
            <div style="display:flex; align-items:center; gap:6px;">
              <span>⚠️</span>
              <span>Google par barcode nahi mila: <strong style="font-family:var(--font-mono); color:#fff;">${barcode}</strong></span>
            </div>
            <span class="badge badge-warning" style="font-size:10px;">Manual Entry</span>
          </div>
          <p style="font-size:11.5px; color:var(--text-secondary); margin:6px 0 10px;">
            Product catalog me nahi hai. Name aur Price daal kar turant bill me add karein:
          </p>
          
          <div style="display:grid; grid-template-columns:2fr 1fr 1fr; gap:8px; margin-bottom:10px;">
            <input type="text" id="quick-add-name" class="form-input" style="padding:6px 10px; font-size:12px;" placeholder="Product Name (e.g. Parle Biscuit)" onkeydown="if(event.key==='Enter') BarcodeScanner.quickRegisterAndAddToCart('${barcode}')" />
            <input type="number" id="quick-add-price" class="form-input" style="padding:6px 10px; font-size:12px; font-family:var(--font-mono);" placeholder="Price (₹)" onkeydown="if(event.key==='Enter') BarcodeScanner.quickRegisterAndAddToCart('${barcode}')" />
            <input type="number" id="quick-add-stock" class="form-input" style="padding:6px 10px; font-size:12px; font-family:var(--font-mono);" placeholder="Stock" value="20" onkeydown="if(event.key==='Enter') BarcodeScanner.quickRegisterAndAddToCart('${barcode}')" />
          </div>

          <div style="display:flex; gap:8px;">
            <button class="btn btn-primary btn-sm" style="flex:1; justify-content:center;" onclick="BarcodeScanner.quickRegisterAndAddToCart('${barcode}')">
              ⚡ Quick Save & Add to Bill
            </button>
            <button class="btn btn-secondary btn-sm" onclick="BarcodeScanner.closeScannerModal(); App.navigate('inventory'); Inventory.openAddProductWithBarcode('${barcode}')">
              Full Form
            </button>
          </div>
        </div>
      `;

      setTimeout(() => {
        const nameIn = document.getElementById('quick-add-name');
        if (nameIn) nameIn.focus();
      }, 100);
    }
  }

  // 1-Tap Confirm and Save Google Fetched Product
  confirmAndSaveProduct(barcode, cat = 'Grocery', emoji = '📦') {
    const nameIn = document.getElementById('google-edit-name');
    const priceIn = document.getElementById('google-edit-price');
    const mrpIn = document.getElementById('google-edit-mrp');

    const name = nameIn && nameIn.value.trim() ? nameIn.value.trim() : `Product ${barcode.slice(-4)}`;
    const price = priceIn && parseFloat(priceIn.value) > 0 ? parseFloat(priceIn.value) : 20;
    const mrp = mrpIn && parseFloat(mrpIn.value) > 0 ? parseFloat(mrpIn.value) : Math.round(price * 1.15);
    const cost = Math.round(price * 0.85);

    const newProduct = {
      id: `P${Date.now().toString().slice(-4)}`,
      name: name,
      cat: cat || 'Grocery',
      barcode: barcode,
      mrp: mrp,
      price: price,
      cost: cost,
      stock: 25,
      unit: 'pack',
      minStock: 5,
      emoji: emoji || '📦'
    };

    DB.updateItem('products', newProduct);
    if (window.POS) POS.addItemToCart(newProduct);
    if (window.Inventory) Inventory.render();

    App.toast('success', 'Google Product Saved & Billed! 🎉', `${name} added at ₹${price}`);
    this.closeScannerModal();
  }

  // 1-Click Fast Register & Add to Active Cart for Manual Fallback
  quickRegisterAndAddToCart(barcode) {
    const nameInput = document.getElementById('quick-add-name');
    const priceInput = document.getElementById('quick-add-price');
    const stockInput = document.getElementById('quick-add-stock');

    const name = nameInput && nameInput.value.trim() ? nameInput.value.trim() : `Product ${barcode.slice(-4)}`;
    const price = priceInput && parseFloat(priceInput.value) > 0 ? parseFloat(priceInput.value) : 20;
    const stock = stockInput && parseInt(stockInput.value) > 0 ? parseInt(stockInput.value) : 25;
    const mrp = Math.round(price * 1.15);
    const cost = Math.round(price * 0.85);

    const newProduct = {
      id: `P${Date.now().toString().slice(-4)}`,
      name: name,
      cat: "Grocery",
      barcode: barcode,
      mrp: mrp,
      price: price,
      cost: cost,
      stock: stock,
      unit: "pack",
      minStock: 5,
      emoji: "📦"
    };

    DB.updateItem('products', newProduct);
    if (window.POS) POS.addItemToCart(newProduct);
    if (window.Inventory) Inventory.render();

    App.toast('success', 'Product Registered & Billed! 🎉', `${name} added at ₹${price}`);
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
    if (input && input.value.trim()) {
      this.onBarcodeDetected(input.value.trim(), 'manual');
    }
  }

  simulateSampleScan() {
    const sampleBarcodes = [
      '8901058852336', // Britannia Bourbon
      '8901725131235', // Maggi 2-Minute Masala Noodles
      '8901030366881', // Surf Excel
      '8901491101837', // Dettol Original Soap
      '8904258116198', // Parle-G Gold
      '8901262010053', // Amul Pure Ghee
      '7622201738210'  // Cadbury Dairy Milk Silk
    ];
    const randomCode = sampleBarcodes[Math.floor(Math.random() * sampleBarcodes.length)];
    const manualInput = document.getElementById('manual-barcode-input');
    if (manualInput) manualInput.value = randomCode;
    this.onBarcodeDetected(randomCode, 'demo');
  }

  testGoogleFetchDemo() {
    const demoGoogleBarcodes = [
      '8901058852336', // Britannia Bourbon Biscuit
      '8901725131235', // Maggi 2-Minute Masala Noodles
      '8901030366881', // Surf Excel Detergent Bar
      '8901491101837'  // Dettol Bathing Soap
    ];
    const code = demoGoogleBarcodes[Math.floor(Math.random() * demoGoogleBarcodes.length)];
    const manualInput = document.getElementById('manual-barcode-input');
    if (manualInput) manualInput.value = code;
    this.onBarcodeDetected(code, 'google-demo');
  }

  switchCamera() {
    const nextMode = this.currentFacingMode === 'environment' ? 'user' : 'environment';
    this.startCamera(nextMode);
  }

  closeScannerModal() {
    this.isScanning = false;
    if (this.html5QrCode) {
      try {
        this.html5QrCode.stop().then(() => this.html5QrCode.clear()).catch(() => {});
      } catch (e) {}
      this.html5QrCode = null;
    }
    if (this.videoStream) {
      this.videoStream.getTracks().forEach(track => track.stop());
      this.videoStream = null;
    }
    const modal = document.getElementById('scanner-modal');
    if (modal) modal.remove();
  }
}

window.BarcodeScanner = new BarcodeScannerEngine();
