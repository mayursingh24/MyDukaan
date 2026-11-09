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

  async fetchAndRenderGoogleBarcode(barcode) {
    const resultArea = document.getElementById('scanned-detection-area');
    if (!resultArea) return;

    resultArea.innerHTML = `
      <div style="padding: 12px; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-md);">
        <div style="font-size: 12.5px; font-weight: 600; color: var(--text-primary); margin-bottom: 4px;">
          Querying online registry for barcode ${barcode}...
        </div>
        <div style="font-size: 11.5px; color: var(--text-muted);">Checking FMCG product catalog</div>
      </div>
    `;

    let fetchedProduct = null;

    try {
      if (window.DukaanAI && typeof DukaanAI.lookupBarcodeOnline === 'function') {
        const geminiResult = await DukaanAI.lookupBarcodeOnline(barcode);
        if (geminiResult && geminiResult.name) {
          fetchedProduct = geminiResult;
        }
      }
    } catch (err) {
      console.warn('[Barcode Scanner] Online lookup fallback:', err);
    }

    const freshArea = document.getElementById('scanned-detection-area');
    if (!freshArea) return;

    if (fetchedProduct && fetchedProduct.name) {
      const cleanName = fetchedProduct.name;
      const cleanPrice = Number(fetchedProduct.price) || 20;
      const cleanMrp = Number(fetchedProduct.mrp) || cleanPrice;
      const cleanCat = fetchedProduct.category || 'Grocery';

      freshArea.innerHTML = `
        <div style="background: var(--bg-surface); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
          <div style="font-size: 11px; text-transform: uppercase; color: var(--primary); font-weight: 700; margin-bottom: 4px;">Online Match Found</div>
          <div style="font-size: 13.5px; font-weight: 700; color: var(--text-primary); margin-bottom: 6px;">${cleanName}</div>
          <div class="scanner-form-grid" style="margin-bottom: 10px;">
            <input type="text" id="google-edit-name" class="form-input" style="font-size: 12px;" value="${cleanName}" />
            <input type="number" id="google-edit-price" class="form-input" style="font-size: 12px;" value="${cleanPrice}" />
            <input type="number" id="google-edit-mrp" class="form-input" style="font-size: 12px;" value="${cleanMrp}" />
          </div>
          <button class="btn btn-primary w100" onclick="BarcodeScanner.confirmAndSaveProduct('${barcode}', '${cleanCat}')">
            ${Icons.check(14)} Save Product & Add to Bill (₹${cleanPrice})
          </button>
        </div>
      `;
    } else {
      freshArea.innerHTML = `
        <div style="background: var(--bg-surface); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
          <div style="font-size: 12.5px; font-weight: 600; color: var(--warning); margin-bottom: 4px;">
            Unregistered Barcode: ${barcode}
          </div>
          <p style="font-size: 11.5px; color: var(--text-muted); margin-bottom: 8px;">
            Enter product name and price to immediately register and bill:
          </p>
          <div class="scanner-form-grid" style="margin-bottom: 8px;">
            <input type="text" id="quick-add-name" class="form-input" placeholder="Product Name" />
            <input type="number" id="quick-add-price" class="form-input" placeholder="Price (₹)" />
          </div>
          <button class="btn btn-primary w100 btn-sm" onclick="BarcodeScanner.quickRegisterAndAddToCart('${barcode}')">
            ${Icons.check(14)} Save & Add to Bill
          </button>
        </div>
      `;
    }
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

    const name = nameInput && nameInput.value.trim() ? nameInput.value.trim() : `Product ${barcode.slice(-4)}`;
    const price = priceInput && parseFloat(priceInput.value) > 0 ? parseFloat(priceInput.value) : 20;
    const mrp = Math.round(price * 1.15);
    const cost = Math.round(price * 0.85);

    const newProduct = {
      id: `P${Date.now().toString().slice(-4)}`,
      name,
      cat: "Grocery",
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
