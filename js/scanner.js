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
                <div style="font-size: 11px; color: var(--text-muted);">Point camera at barcode, paste digits, or upload photo</div>
              </div>
            </div>
            <button class="topbar-icon-btn" onclick="BarcodeScanner.closeScannerModal()">✕</button>
          </div>

          <div class="scanner-viewport-wrap">
            <div id="html5-qr-reader" style="width: 100%; height: 100%; min-height: 240px;"></div>
            <div class="scanner-target-reticle" style="pointer-events: none;">
              <div class="scanner-laser"></div>
            </div>
            <div id="scanner-status-pill" style="position: absolute; bottom: 12px; background: rgba(0,0,0,0.8); color: #fff; font-size: 11px; padding: 5px 14px; border-radius: 100px; font-family: var(--font-mono); pointer-events: none; border: 1px solid rgba(255,255,255,0.15);">
              Starting scanner vision engine...
            </div>
          </div>

          <!-- Manual / Quick Barcode Search Bar with Live Auto-Trigger -->
          <div style="padding: 10px 14px; background: var(--bg-input); border-bottom: 1px solid var(--border-subtle); display: flex; gap: 8px; align-items: center;">
            <input type="text" id="manual-barcode-input" class="form-input" style="padding: 8px 10px; font-size: 13px; font-family: var(--font-mono); flex: 1; min-width: 0;" placeholder="Enter barcode (e.g. 8901719908262)" oninput="BarcodeScanner.handleInputLive(this.value)" onkeydown="if(event.key==='Enter') BarcodeScanner.handleManualSubmit()" autofocus />
            <button class="btn btn-primary btn-sm" style="white-space: nowrap; flex-shrink: 0; padding: 8px 14px;" onclick="BarcodeScanner.handleManualSubmit()">
              ${Icons.search(13)} Lookup
            </button>
          </div>

          <!-- Detection Result Card Area -->
          <div id="scanned-detection-area" style="display: none;" class="scanned-detection-card"></div>

          <!-- Multi-action Control Bar -->
          <div style="padding: 10px 14px; display: flex; align-items: center; justify-content: space-between; background: var(--bg-surface); flex-wrap: wrap; gap: 8px;">
            <div style="display: flex; gap: 6px; flex-wrap: wrap; align-items: center;">
              <label class="btn btn-secondary btn-sm" style="cursor: pointer; display: inline-flex; align-items: center; gap: 5px; margin: 0;">
                <input type="file" accept="image/*" style="display: none;" onchange="if(this.files && this.files[0]) BarcodeScanner.scanImageFile(this.files[0])" />
                <span>📷 Upload Photo</span>
              </label>
              <button class="btn btn-secondary btn-sm" onclick="BarcodeScanner.simulateSampleScan()" title="Simulate Parle-G 8901719908262">
                🍪 Demo Parle-G
              </button>
              <button class="btn btn-secondary btn-sm" onclick="BarcodeScanner.switchCamera()">
                🔄 Flip Cam
              </button>
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

  // Live auto-trigger when merchant types or pastes barcode
  handleInputLive(val) {
    const clean = String(val || '').trim();
    if (/^\d{8,14}$/.test(clean)) {
      clearTimeout(this._liveInputTimer);
      this._liveInputTimer = setTimeout(() => {
        this.onBarcodeDetected(clean, 'live_input');
      }, 250);
    }
  }

  // Scan directly from uploaded barcode image/photo
  async scanImageFile(file) {
    if (!file) return;
    const statusPill = document.getElementById('scanner-status-pill');
    if (statusPill) statusPill.textContent = 'Analyzing image for 1D barcode...';

    try {
      if (!this.html5QrCode) {
        this.html5QrCode = new Html5Qrcode("html5-qr-reader", { verbose: false });
      }
      const decodedResult = await this.html5QrCode.scanFileV2(file, true);
      if (decodedResult && decodedResult.decodedText) {
        this.onBarcodeDetected(decodedResult.decodedText, 'image_file');
      } else {
        App.toast('warning', 'Barcode Not Detected', 'Could not detect barcode in that image. Try typing the barcode numbers.');
      }
    } catch (err) {
      console.warn('[BarcodeScanner] scanFile error:', err);
      App.toast('warning', 'Detection Issue', 'No clear barcode recognized in photo. You can type the numbers manually.');
    }
  }

  async startCamera(facingMode = 'environment') {
    this.currentFacingMode = facingMode;

    const statusPill = document.getElementById('scanner-status-pill');

    // 1. Preferred High-Performance ZXing Engine via Html5Qrcode
    if (window.Html5Qrcode) {
      try {
        if (this.html5QrCode) {
          try { await this.html5QrCode.stop(); } catch(e){}
        }

        let formats = undefined;
        if (window.Html5QrcodeSupportedFormats) {
          formats = [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.QR_CODE
          ];
        }

        this.html5QrCode = new Html5Qrcode("html5-qr-reader", {
          formatsToSupport: formats,
          verbose: false,
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: ('BarcodeDetector' in window)
          }
        });

        // Smart camera resolution
        let cameraToUse = { facingMode: { ideal: facingMode } };
        try {
          const cameras = await Html5Qrcode.getCameras();
          if (cameras && cameras.length > 0) {
            const backCam = cameras.find(c => {
              const label = (c.label || '').toLowerCase();
              return label.includes('back') || label.includes('rear') || label.includes('environment');
            });
            cameraToUse = (facingMode === 'environment' && backCam) ? backCam.id : cameras[0].id;
          }
        } catch (camErr) {}

        const scanConfig = {
          fps: 20,
          qrbox: (viewfinderWidth, viewfinderHeight) => ({
            width: Math.max(180, Math.min(Math.round(viewfinderWidth * 0.88), 380)),
            height: Math.max(95, Math.min(Math.round(viewfinderHeight * 0.65), 185))
          }),
          aspectRatio: 1.777778
        };

        const onScanSuccess = (decodedText) => {
          const now = Date.now();
          if (decodedText && (decodedText !== this.lastScannedCode || now - this.lastScanTime > 1800)) {
            this.lastScannedCode = decodedText;
            this.lastScanTime = now;
            this.onBarcodeDetected(decodedText, 'camera');
          }
        };

        try {
          await this.html5QrCode.start(cameraToUse, scanConfig, onScanSuccess, () => {});
        } catch (primaryStartErr) {
          // Fallback: try starting with generic constraint { facingMode: facingMode }
          await this.html5QrCode.start({ facingMode: facingMode }, scanConfig, onScanSuccess, () => {});
        }

        this.isScanning = true;
        if (statusPill) {
          statusPill.textContent = '🟢 Auto-Vision Active • Hold barcode steady';
          statusPill.style.color = '#34D399';
        }
        return;
      } catch (e) {
        console.warn('[Scanner] Html5Qrcode camera error:', e);
      }
    }

    // 2. Native WebRTC fallback
    const viewportWrap = document.querySelector('.scanner-viewport-wrap');
    if (viewportWrap) {
      viewportWrap.innerHTML = `
        <video id="scanner-video-preview" autoplay playsinline muted style="width: 100%; height: 100%; object-fit: cover;"></video>
        <div class="scanner-target-reticle" style="pointer-events: none;">
          <div class="scanner-laser"></div>
        </div>
        <div id="scanner-status-pill" style="position: absolute; bottom: 12px; background: rgba(0,0,0,0.8); color: #fff; font-size: 11px; padding: 5px 14px; border-radius: 100px; font-family: var(--font-mono);">
          Aim camera at barcode...
        </div>
      `;
    }

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
      const pill = document.getElementById('scanner-status-pill');
      if (pill) {
        pill.textContent = 'Camera unavailable. Use manual lookup or Upload Photo button.';
        pill.style.color = '#EF4444';
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
      resultArea.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      const discount = product.mrp > product.price ? product.mrp - product.price : 0;

      resultArea.innerHTML = `
        <div style="background: var(--bg-surface); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
          <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 6px;">
            <div style="font-weight: 700; font-size: 14px; color: var(--text-primary); word-break: break-word;">${this.escapeHtml(product.name)}</div>
            <span class="badge badge-success">In Stock (${product.stock} ${this.escapeHtml(product.unit || 'unit')})</span>
          </div>
          <div style="font-size: 12px; color: var(--text-muted); display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
            <span>Barcode: ${this.escapeHtml(product.barcode)}</span>
            <span>MRP: ₹${product.mrp}</span>
            <span style="font-weight: 700; color: var(--text-primary);">Price: ₹${product.price}</span>
            ${discount > 0 ? `<span style="color: var(--success); font-weight: 600;">Save ₹${discount}</span>` : ''}
          </div>
          <div style="display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap;">
            <button class="btn btn-primary" style="flex: 1 1 180px;" onclick="BarcodeScanner.addToCartFromScanner('${this.escapeHtml(product.id)}')">
              ${Icons.plus(14)} Add to Bill Cart (₹${product.price})
            </button>
            ${(window.App && typeof App.isCashierMode === 'function' && App.isCashierMode()) ? '' : `
              <button class="btn btn-secondary btn-sm" onclick="BarcodeScanner.closeScannerModal(); App.navigate('inventory'); Inventory.openEditProductModal('${this.escapeHtml(product.id)}')">
                ${Icons.edit(13)} Edit
              </button>
            `}
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
      "8901058852336": { name: "Maggi 2-Minute Masala Noodles 140g", brand: "Nestlé", cat: "Snacks", mrp: 28, price: 28, cost: 23, unit: "pack", emoji: "🍜" },
      "8901058852233": { name: "Maggi 2-Minute Masala Noodles 70g", brand: "Nestlé", cat: "Snacks", mrp: 14, price: 14, cost: 11.5, unit: "pack", emoji: "🍜" },
      "8901058853876": { name: "Maggi Special Masala Noodles 70g", brand: "Nestlé", cat: "Snacks", mrp: 18, price: 18, cost: 15, unit: "pack", emoji: "🍜" },
      "8901058000000": { name: "KitKat 4-Finger Wafer Bar 38g", brand: "Nestlé", cat: "Chocolates", mrp: 30, price: 30, cost: 25, unit: "bar", emoji: "🍫" },
      "8901058836540": { name: "Nestlé Munch Crisp Wafer 18g", brand: "Nestlé", cat: "Chocolates", mrp: 10, price: 10, cost: 8, unit: "pack", emoji: "🍫" },
      "8901058863455": { name: "Nescafé Classic Instant Coffee 50g", brand: "Nestlé", cat: "Beverages", mrp: 185, price: 175, cost: 148, unit: "jar", emoji: "☕" },
      "8901058861208": { name: "Nestlé Everyday Dairy Whitener 200g", brand: "Nestlé", cat: "Dairy", mrp: 120, price: 110, cost: 95, unit: "pouch", emoji: "🥛" },
      "8901719101053": { name: "Parle-G Gold Biscuits 100g", brand: "Parle", cat: "Snacks", mrp: 15, price: 15, cost: 12, unit: "pack", emoji: "🍪" },
      "8901719101015": { name: "Parle-G Glucose Biscuits 250g", brand: "Parle", cat: "Snacks", mrp: 25, price: 25, cost: 21, unit: "pack", emoji: "🍪" },
      "8901719908262": { name: "Parle-G Original Gluco Biscuits 382.5g", brand: "Parle", cat: "Snacks", mrp: 35, price: 35, cost: 28, unit: "pack", emoji: "🍪" },
      "8901719104030": { name: "Parle Monaco Salted Crackers 75g", brand: "Parle", cat: "Snacks", mrp: 10, price: 10, cost: 8, unit: "pack", emoji: "🍪" },
      "8901719103026": { name: "Parle Krackjack Sweet & Salty 60g", brand: "Parle", cat: "Snacks", mrp: 10, price: 10, cost: 8, unit: "pack", emoji: "🍪" },
      "8901719112028": { name: "Parle Hide & Seek Choco Chip 120g", brand: "Parle", cat: "Snacks", mrp: 35, price: 35, cost: 29, unit: "pack", emoji: "🍪" },
      "8901719114015": { name: "Parle 20-20 Butter Cookies 100g", brand: "Parle", cat: "Snacks", mrp: 10, price: 10, cost: 8, unit: "pack", emoji: "🍪" },
      "8901719001018": { name: "Frooti Mango Drink 160ml", brand: "Parle Agro", cat: "Beverages", mrp: 12, price: 12, cost: 9.5, unit: "tetra", emoji: "🧃" },
      "8901233010012": { name: "Britannia Good Day Butter Cookies 100g", brand: "Britannia", cat: "Snacks", mrp: 20, price: 20, cost: 16.5, unit: "pack", emoji: "🍪" },
      "8901233010050": { name: "Britannia Good Day Cashew Cookies 100g", brand: "Britannia", cat: "Snacks", mrp: 25, price: 25, cost: 21, unit: "pack", emoji: "🍪" },
      "8901233020011": { name: "Britannia Marie Gold Biscuits 120g", brand: "Britannia", cat: "Snacks", mrp: 15, price: 15, cost: 12, unit: "pack", emoji: "🍪" },
      "8901233020059": { name: "Britannia Marie Gold Biscuits 250g", brand: "Britannia", cat: "Snacks", mrp: 30, price: 30, cost: 25, unit: "pack", emoji: "🍪" },
      "8901233030010": { name: "Britannia Bourbon Chocolate Cream 120g", brand: "Britannia", cat: "Snacks", mrp: 25, price: 25, cost: 20, unit: "pack", emoji: "🍪" },
      "8901233040019": { name: "Britannia Little Hearts Biscuits 75g", brand: "Britannia", cat: "Snacks", mrp: 10, price: 10, cost: 8, unit: "pack", emoji: "🍪" },
      "8901233050018": { name: "Britannia 50-50 Maska Chaska 50g", brand: "Britannia", cat: "Snacks", mrp: 10, price: 10, cost: 8, unit: "pack", emoji: "🍪" },
      "8901233060017": { name: "Britannia Milk Bikis Biscuits 90g", brand: "Britannia", cat: "Snacks", mrp: 10, price: 10, cost: 8, unit: "pack", emoji: "🍪" },
      "8901262010057": { name: "Amul Butter 500g", brand: "Amul", cat: "Dairy", mrp: 290, price: 275, cost: 240, unit: "pack", emoji: "🧈" },
      "8901262010053": { name: "Amul Butter 100g", brand: "Amul", cat: "Dairy", mrp: 58, price: 55, cost: 48, unit: "pack", emoji: "🧈" },
      "8901262020018": { name: "Amul Taaza Toned Milk 1L", brand: "Amul", cat: "Dairy", mrp: 74, price: 72, cost: 65, unit: "tetra", emoji: "🥛" },
      "8901262020056": { name: "Amul Gold Full Cream Milk 1L", brand: "Amul", cat: "Dairy", mrp: 80, price: 78, cost: 70, unit: "tetra", emoji: "🥛" },
      "8901262040016": { name: "Amul Processed Cheese Cubes 200g", brand: "Amul", cat: "Dairy", mrp: 140, price: 135, cost: 118, unit: "pack", emoji: "🧀" },
      "8901262040054": { name: "Amul Cheese Slices 200g", brand: "Amul", cat: "Dairy", mrp: 150, price: 145, cost: 126, unit: "pack", emoji: "🧀" },
      "8901262030017": { name: "Amul Pure Ghee 1L Tin", brand: "Amul", cat: "Dairy", mrp: 630, price: 610, cost: 550, unit: "tin", emoji: "🧈" },
      "8901262060014": { name: "Amul Malai Fresh Paneer 200g", brand: "Amul", cat: "Dairy", mrp: 95, price: 90, cost: 78, unit: "pack", emoji: "🧀" },
      "8901262070013": { name: "Amul Kool Elaichi Can 200ml", brand: "Amul", cat: "Dairy", mrp: 30, price: 30, cost: 24, unit: "can", emoji: "🥛" },
      "8901725131235": { name: "Aashirvaad Superior MP Chakki Atta 10kg", brand: "ITC", cat: "Grocery", mrp: 490, price: 445, cost: 385, unit: "bag", emoji: "🌾" },
      "8901030383847": { name: "Aashirvaad Shudh Chakki Atta 5kg", brand: "ITC", cat: "Grocery", mrp: 270, price: 235, cost: 198, unit: "bag", emoji: "🌾" },
      "8901725131211": { name: "Aashirvaad Select Sharbati Atta 5kg", brand: "ITC", cat: "Grocery", mrp: 330, price: 310, cost: 265, unit: "bag", emoji: "🌾" },
      "8901725141012": { name: "Sunfeast Dark Fantasy Choco Fills 75g", brand: "ITC", cat: "Snacks", mrp: 35, price: 30, cost: 25, unit: "pack", emoji: "🍪" },
      "8901725142019": { name: "Sunfeast Mom's Magic Cashew 100g", brand: "ITC", cat: "Snacks", mrp: 15, price: 15, cost: 12, unit: "pack", emoji: "🍪" },
      "8901725151011": { name: "Bingo! Tedhe Medhe Masala 50g", brand: "ITC", cat: "Snacks", mrp: 10, price: 10, cost: 8, unit: "pack", emoji: "🍿" },
      "8901725161010": { name: "Sunfeast YiPPee! Magic Masala 70g", brand: "ITC", cat: "Snacks", mrp: 14, price: 14, cost: 11.5, unit: "pack", emoji: "🍜" },
      "8906007280014": { name: "Fortune Sunlite Sunflower Oil 1L", brand: "Adani Wilmar", cat: "Oils", mrp: 180, price: 155, cost: 130, unit: "pouch", emoji: "🫙" },
      "8906007280145": { name: "Fortune Soya Health Oil 1L", brand: "Adani Wilmar", cat: "Oils", mrp: 160, price: 138, cost: 118, unit: "pouch", emoji: "🫙" },
      "8906007280206": { name: "Fortune Kachi Ghani Mustard Oil 1L", brand: "Adani Wilmar", cat: "Oils", mrp: 185, price: 165, cost: 140, unit: "pouch", emoji: "🫙" },
      "8906007280312": { name: "Fortune Fine Besan 500g", brand: "Adani Wilmar", cat: "Grocery", mrp: 65, price: 55, cost: 44, unit: "pack", emoji: "🌾" },
      "8901052002139": { name: "Tata Tea Gold 500g", brand: "Tata Consumer", cat: "Beverages", mrp: 350, price: 310, cost: 265, unit: "box", emoji: "☕" },
      "8901052003888": { name: "Tata Tea Gold 250g", brand: "Tata Consumer", cat: "Beverages", mrp: 160, price: 140, cost: 115, unit: "box", emoji: "☕" },
      "8901052001019": { name: "Tata Tea Premium Desh Ki Chai 500g", brand: "Tata Consumer", cat: "Beverages", mrp: 280, price: 260, cost: 220, unit: "box", emoji: "☕" },
      "8901052004014": { name: "Tata Salt Vacuum Evaporated 1kg", brand: "Tata Consumer", cat: "Grocery", mrp: 28, price: 28, cost: 22, unit: "pack", emoji: "🧂" },
      "8901030383858": { name: "Tata Sampann Toor Dal 1kg", brand: "Tata Consumer", cat: "Grocery", mrp: 200, price: 175, cost: 145, unit: "kg", emoji: "🫘" },
      "8901030383865": { name: "Tata Sampann Chana Dal 1kg", brand: "Tata Consumer", cat: "Grocery", mrp: 130, price: 115, cost: 95, unit: "kg", emoji: "🫘" },
      "8901030383841": { name: "India Gate Basmati Rice Rozzana 1kg", brand: "KRBL", cat: "Grocery", mrp: 140, price: 120, cost: 95, unit: "kg", emoji: "🍚" },
      "8901491101830": { name: "Lay's India's Magic Masala Chips 50g", brand: "PepsiCo", cat: "Snacks", mrp: 20, price: 20, cost: 16.5, unit: "pack", emoji: "🥔" },
      "8901491101816": { name: "Lay's Spanish Tomato Tango 50g", brand: "PepsiCo", cat: "Snacks", mrp: 20, price: 20, cost: 16.5, unit: "pack", emoji: "🥔" },
      "8901491101823": { name: "Lay's American Cream & Onion 50g", brand: "PepsiCo", cat: "Snacks", mrp: 20, price: 20, cost: 16.5, unit: "pack", emoji: "🥔" },
      "8901491102011": { name: "Kurkure Masala Munch 45g", brand: "PepsiCo", cat: "Snacks", mrp: 10, price: 10, cost: 8, unit: "pack", emoji: "🍿" },
      "8901491102028": { name: "Kurkure Solid Masti Twistee 45g", brand: "PepsiCo", cat: "Snacks", mrp: 10, price: 10, cost: 8, unit: "pack", emoji: "🍿" },
      "8901491001017": { name: "Pepsi Carbonated Soft Drink 250ml", brand: "PepsiCo", cat: "Beverages", mrp: 20, price: 20, cost: 15.5, unit: "can", emoji: "🥤" },
      "8901491002014": { name: "Mountain Dew Soft Drink 250ml", brand: "PepsiCo", cat: "Beverages", mrp: 20, price: 20, cost: 15.5, unit: "can", emoji: "🥤" },
      "8901030004926": { name: "Surf Excel Quick Wash 1kg", brand: "HUL", cat: "Household", mrp: 160, price: 140, cost: 118, unit: "pack", emoji: "🧼" },
      "8901030015520": { name: "Surf Excel Easy Wash 500g", brand: "HUL", cat: "Household", mrp: 78, price: 70, cost: 58, unit: "pack", emoji: "🧼" },
      "8901030026618": { name: "Rin Detergent Bar 250g", brand: "HUL", cat: "Household", mrp: 20, price: 20, cost: 16, unit: "bar", emoji: "🧼" },
      "8901030037713": { name: "Vim Dishwash Bar 135g", brand: "HUL", cat: "Household", mrp: 10, price: 10, cost: 8, unit: "bar", emoji: "🧼" },
      "8901030048818": { name: "Vim Dishwash Gel Lemon 250ml", brand: "HUL", cat: "Household", mrp: 65, price: 60, cost: 48, unit: "bottle", emoji: "🧴" },
      "8901030059913": { name: "Lifebuoy Total Soap 125g", brand: "HUL", cat: "Personal Care", mrp: 38, price: 35, cost: 28, unit: "bar", emoji: "🧼" },
      "8901030061015": { name: "Lux Velvet Glow Soap 100g", brand: "HUL", cat: "Personal Care", mrp: 40, price: 38, cost: 30, unit: "bar", emoji: "🧼" },
      "8901030072011": { name: "Dove Beauty Bathing Bar 100g", brand: "HUL", cat: "Personal Care", mrp: 70, price: 65, cost: 52, unit: "bar", emoji: "🧼" },
      "8901030083017": { name: "Clinic Plus Strong & Long Shampoo 175ml", brand: "HUL", cat: "Personal Care", mrp: 120, price: 110, cost: 88, unit: "bottle", emoji: "🧴" },
      "8901030094013": { name: "Sunsilk Black Shine Shampoo 180ml", brand: "HUL", cat: "Personal Care", mrp: 130, price: 120, cost: 96, unit: "bottle", emoji: "🧴" },
      "8901030105016": { name: "Brooke Bond Red Label Tea 250g", brand: "HUL", cat: "Beverages", mrp: 140, price: 130, cost: 108, unit: "box", emoji: "☕" },
      "8901030116012": { name: "Bru Instant Coffee 50g", brand: "HUL", cat: "Beverages", mrp: 105, price: 98, cost: 82, unit: "pouch", emoji: "☕" },
      "8901030127018": { name: "Knorr Mixed Vegetable Soup 43g", brand: "HUL", cat: "Grocery", mrp: 40, price: 40, cost: 32, unit: "pack", emoji: "🍲" },
      "8901314010529": { name: "Colgate Total Advanced Health 120g", brand: "Colgate", cat: "Personal Care", mrp: 110, price: 95, cost: 75, unit: "tube", emoji: "🪥" },
      "8901314010116": { name: "Colgate Strong Teeth 200g", brand: "Colgate", cat: "Personal Care", mrp: 115, price: 105, cost: 84, unit: "tube", emoji: "🪥" },
      "8901314010215": { name: "Colgate MaxFresh Spicy Fresh 150g", brand: "Colgate", cat: "Personal Care", mrp: 125, price: 115, cost: 92, unit: "tube", emoji: "🪥" },
      "8901396112104": { name: "Dettol Antiseptic Liquid 250ml", brand: "Reckitt", cat: "Healthcare", mrp: 145, price: 130, cost: 105, unit: "bottle", emoji: "🧴" },
      "8901396111015": { name: "Dettol Original Bathing Soap 75g", brand: "Reckitt", cat: "Personal Care", mrp: 40, price: 36, cost: 29, unit: "bar", emoji: "🧼" },
      "8901396121013": { name: "Harpic Power Plus 500ml", brand: "Reckitt", cat: "Household", mrp: 105, price: 95, cost: 76, unit: "bottle", emoji: "🧴" },
      "8901396131012": { name: "Lizol Disinfectant Citrus 500ml", brand: "Reckitt", cat: "Household", mrp: 115, price: 105, cost: 84, unit: "bottle", emoji: "🧴" },
      "8901396141011": { name: "Colin Glass Cleaner 500ml", brand: "Reckitt", cat: "Household", mrp: 110, price: 98, cost: 78, unit: "spray", emoji: "🧴" },
      "8901512001018": { name: "Dabur Red Toothpaste 200g", brand: "Dabur", cat: "Personal Care", mrp: 120, price: 110, cost: 88, unit: "tube", emoji: "🪥" },
      "8901512002015": { name: "Dabur 100% Pure Honey 500g", brand: "Dabur", cat: "Grocery", mrp: 230, price: 210, cost: 168, unit: "bottle", emoji: "🍯" },
      "8901512003012": { name: "Dabur Chyawanprash 500g", brand: "Dabur", cat: "Healthcare", mrp: 245, price: 225, cost: 180, unit: "jar", emoji: "🍯" },
      "8901512004019": { name: "Real Fruit Power Mixed Fruit 1L", brand: "Dabur", cat: "Beverages", mrp: 130, price: 120, cost: 96, unit: "tetra", emoji: "🧃" },
      "8904004001013": { name: "Patanjali Dant Kanti 200g", brand: "Patanjali", cat: "Personal Care", mrp: 105, price: 95, cost: 76, unit: "tube", emoji: "🪥" },
      "8904004002010": { name: "Patanjali Pure Cow Ghee 1L", brand: "Patanjali", cat: "Dairy", mrp: 650, price: 620, cost: 560, unit: "carton", emoji: "🧈" },
      "8906010001014": { name: "Parachute Pure Coconut Oil 200ml", brand: "Marico", cat: "Personal Care", mrp: 95, price: 85, cost: 68, unit: "bottle", emoji: "🥥" },
      "8906010002011": { name: "Saffola Gold Pro Healthy Oil 1L", brand: "Marico", cat: "Oils", mrp: 190, price: 170, cost: 142, unit: "pouch", emoji: "🫙" },
      "8908000001017": { name: "Haldiram's Aloo Bhujia 200g", brand: "Haldiram", cat: "Snacks", mrp: 60, price: 55, cost: 44, unit: "pack", emoji: "🍿" },
      "8908000002014": { name: "Haldiram's Moong Dal 200g", brand: "Haldiram", cat: "Snacks", mrp: 65, price: 60, cost: 48, unit: "pack", emoji: "🍿" },
      "8908000003011": { name: "Haldiram's Khatta Meetha 200g", brand: "Haldiram", cat: "Snacks", mrp: 60, price: 55, cost: 44, unit: "pack", emoji: "🍿" },
      "8901808001015": { name: "Everest Garam Masala 100g", brand: "Everest", cat: "Spices", mrp: 85, price: 78, cost: 62, unit: "box", emoji: "🌶️" },
      "8901808002012": { name: "Everest Chana Masala 100g", brand: "Everest", cat: "Spices", mrp: 82, price: 75, cost: 60, unit: "box", emoji: "🌶️" },
      "8901402001014": { name: "MDH Deggi Mirch 100g", brand: "MDH", cat: "Spices", mrp: 98, price: 92, cost: 74, unit: "box", emoji: "🌶️" },
      "8901402002011": { name: "MDH Garam Masala 100g", brand: "MDH", cat: "Spices", mrp: 96, price: 90, cost: 72, unit: "box", emoji: "🌶️" },
      "7622201438902": { name: "Cadbury Dairy Milk Silk 60g", brand: "Mondelez", cat: "Chocolates", mrp: 105, price: 90, cost: 75, unit: "bar", emoji: "🍫" },
      "7622201411011": { name: "Cadbury 5 Star Bar 40g", brand: "Mondelez", cat: "Chocolates", mrp: 20, price: 20, cost: 16, unit: "bar", emoji: "🍫" },
      "7622201422017": { name: "Cadbury Perk Double 28g", brand: "Mondelez", cat: "Chocolates", mrp: 10, price: 10, cost: 8, unit: "bar", emoji: "🍫" },
      "5449000000996": { name: "Coca-Cola Original 330ml Can", brand: "Coca-Cola", cat: "Beverages", mrp: 40, price: 40, cost: 32, unit: "can", emoji: "🥤" },
      "5449000001016": { name: "Thums Up Charged 330ml Can", brand: "Coca-Cola", cat: "Beverages", mrp: 40, price: 40, cost: 32, unit: "can", emoji: "🥤" },
      "5449000002013": { name: "Sprite Lemon-Lime 250ml", brand: "Coca-Cola", cat: "Beverages", mrp: 20, price: 20, cost: 15.5, unit: "bottle", emoji: "🥤" },
      "5449000003010": { name: "Maaza Mango Drink 250ml", brand: "Coca-Cola", cat: "Beverages", mrp: 20, price: 20, cost: 15.5, unit: "bottle", emoji: "🧃" },
      "5449000004017": { name: "Limca Fresh Lemon 250ml", brand: "Coca-Cola", cat: "Beverages", mrp: 20, price: 20, cost: 15.5, unit: "bottle", emoji: "🥤" }
    };
  }

  // GS1 India & Global Company Prefix Resolution (Instant Offline)
  static resolveGS1Company(barcode) {
    const code = String(barcode || '').trim();
    if (!code) return null;

    const PREFIX_MAP = [
      { prefix: "8901030", brand: "Hindustan Unilever", cat: "Household", emoji: "🧼", typicalMrp: 45 },
      { prefix: "8901058", brand: "Nestlé India", cat: "Snacks", emoji: "🍜", typicalMrp: 25 },
      { prefix: "8901052", brand: "Tata Consumer", cat: "Beverages", emoji: "☕", typicalMrp: 85 },
      { prefix: "8901262", brand: "Amul (GCMMF)", cat: "Dairy", emoji: "🧈", typicalMrp: 75 },
      { prefix: "8901719", brand: "Parle Products", cat: "Snacks", emoji: "🍪", typicalMrp: 15 },
      { prefix: "8901233", brand: "Britannia Industries", cat: "Snacks", emoji: "🍪", typicalMrp: 25 },
      { prefix: "8901725", brand: "ITC Ltd", cat: "Grocery", emoji: "🌾", typicalMrp: 120 },
      { prefix: "8901491", brand: "PepsiCo India", cat: "Snacks", emoji: "🥔", typicalMrp: 20 },
      { prefix: "8906007", brand: "Adani Wilmar (Fortune)", cat: "Oils", emoji: "🫙", typicalMrp: 160 },
      { prefix: "8901314", brand: "Colgate-Palmolive", cat: "Personal Care", emoji: "🪥", typicalMrp: 95 },
      { prefix: "8901396", brand: "Reckitt Benckiser (Dettol)", cat: "Healthcare", emoji: "🧴", typicalMrp: 110 },
      { prefix: "8901512", brand: "Dabur India", cat: "Healthcare", emoji: "🍯", typicalMrp: 90 },
      { prefix: "8904004", brand: "Patanjali Ayurved", cat: "Personal Care", emoji: "🌿", typicalMrp: 85 },
      { prefix: "8906010", brand: "Marico (Parachute/Saffola)", cat: "Oils", emoji: "🥥", typicalMrp: 125 },
      { prefix: "8908000", brand: "Haldiram's", cat: "Snacks", emoji: "🍿", typicalMrp: 55 },
      { prefix: "8904258", brand: "Bikaji Foods", cat: "Snacks", emoji: "🍿", typicalMrp: 50 },
      { prefix: "8901808", brand: "Everest Spices", cat: "Spices", emoji: "🌶️", typicalMrp: 78 },
      { prefix: "8901402", brand: "MDH Spices", cat: "Spices", emoji: "🌶️", typicalMrp: 82 },
      { prefix: "7622201", brand: "Cadbury / Mondelez", cat: "Chocolates", emoji: "🍫", typicalMrp: 45 },
      { prefix: "5449000", brand: "Coca-Cola Company", cat: "Beverages", emoji: "🥤", typicalMrp: 35 },
      { prefix: "8901138", brand: "Cadbury India", cat: "Chocolates", emoji: "🍫", typicalMrp: 40 },
      { prefix: "8901450", brand: "Wipro Consumer (Santoor)", cat: "Personal Care", emoji: "🧼", typicalMrp: 38 },
      { prefix: "8902579", brand: "Godrej Consumer", cat: "Household", emoji: "🧴", typicalMrp: 65 },
      { prefix: "8906014", brand: "Emami", cat: "Personal Care", emoji: "🧴", typicalMrp: 55 },
      { prefix: "8901177", brand: "Balaji Wafers", cat: "Snacks", emoji: "🥔", typicalMrp: 15 },
      { prefix: "8901063", brand: "Mother Dairy", cat: "Dairy", emoji: "🥛", typicalMrp: 60 }
    ];

    for (const item of PREFIX_MAP) {
      if (code.startsWith(item.prefix)) {
        return item;
      }
    }

    if (code.startsWith("890")) {
      return { brand: "GS1 Indian FMCG", cat: "Grocery", emoji: "📦", typicalMrp: 35 };
    }

    return null;
  }

  escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, function(m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }

  getLocalOfflineHint(barcode) {
    const cleanCode = String(barcode || '').trim();
    if (!cleanCode) return null;

    if (BarcodeScanner.FMCG_MASTER_DB[cleanCode]) {
      return {
        item: { ...BarcodeScanner.FMCG_MASTER_DB[cleanCode], barcode: cleanCode },
        sourceLabel: '🟠 Offline • Kirana Master DB'
      };
    }

    try {
      const cached = JSON.parse(localStorage.getItem('mydukaan24_barcode_cache') || '{}');
      if (cached[cleanCode] && cached[cleanCode].name) {
        return {
          item: { ...cached[cleanCode], barcode: cleanCode },
          sourceLabel: '🟠 Offline • Local Saved Cache'
        };
      }
    } catch (e) {}

    const gs1 = BarcodeScannerEngine.resolveGS1Company(cleanCode);
    if (gs1) {
      const estPrice = Math.round(gs1.typicalMrp * 0.9);
      return {
        item: {
          barcode: cleanCode,
          name: `${gs1.brand} Product (${cleanCode.slice(-4)})`,
          brand: gs1.brand,
          cat: gs1.cat || 'Grocery',
          mrp: gs1.typicalMrp,
          price: estPrice,
          cost: Math.round(estPrice * 0.82),
          unit: 'pack',
          emoji: gs1.emoji || '📦'
        },
        sourceLabel: `🟠 Offline • GS1 Prefix (${gs1.brand})`
      };
    }

    return null;
  }

  renderMatchedBarcodeCard(matchedItem, sourceLabel, barcode) {
    const freshArea = document.getElementById('scanned-detection-area');
    if (!freshArea || !matchedItem || !matchedItem.name) return;

    const cleanName = matchedItem.name;
    const cleanPrice = Number(matchedItem.price) || 20;
    const cleanMrp = Number(matchedItem.mrp) || Math.round(cleanPrice * 1.15);
    const cleanCost = Number(matchedItem.cost) || Math.round(cleanPrice * 0.85);
    const cleanCat = matchedItem.cat || 'Grocery';
    const cleanBrand = matchedItem.brand || '';
    const cleanImg = matchedItem.imageUrl || null;
    const isOnlineTag = sourceLabel.includes('Online');

    freshArea.innerHTML = `
      <div style="background: var(--bg-surface); padding: 14px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 8px;">
          <span class="badge ${isOnlineTag ? 'badge-success' : 'badge-warning'}">${this.escapeHtml(sourceLabel)}</span>
          <span style="font-size: 11px; font-family: var(--font-mono); color: var(--text-muted);">EAN: ${this.escapeHtml(barcode)}</span>
        </div>

        <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-bottom: 12px;">
          ${cleanImg ? `
            <img src="${this.escapeHtml(cleanImg)}" alt="Product" style="width: 48px; height: 48px; border-radius: 8px; object-fit: contain; background: #fff; padding: 2px; flex-shrink: 0;" onerror="this.style.display='none'" />
          ` : `<div style="font-size: 30px; flex-shrink: 0;">${this.escapeHtml(matchedItem.emoji || '📦')}</div>`}
          <div style="flex: 1; min-width: 0;">
            <div style="font-size: 14px; font-weight: 800; color: var(--text-primary); word-break: break-word;">${this.escapeHtml(cleanName)}</div>
            <div style="font-size: 11.5px; color: var(--text-secondary); margin-top: 2px;">
              ${cleanBrand ? `Brand: <strong>${this.escapeHtml(cleanBrand)}</strong> • ` : ''}Category: <strong>${this.escapeHtml(cleanCat)}</strong>
            </div>
          </div>
        </div>

        <div class="scanner-form-grid" style="margin-bottom: 10px;">
          <div>
            <label class="form-label" style="font-size: 10.5px;">Product Name</label>
            <input type="text" id="google-edit-name" class="form-input" style="font-size: 12px;" value="${this.escapeHtml(cleanName)}" />
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

        <button class="btn btn-primary" style="width: 100%; justify-content: center;" data-barcode="${this.escapeHtml(barcode)}" data-cat="${this.escapeHtml(cleanCat)}" data-cost="${cleanCost}" onclick="BarcodeScanner.confirmAndSaveProduct(this.dataset.barcode, this.dataset.cat, Number(this.dataset.cost))">
          ${Icons.check(14)} Save into Inventory & Add to Bill (₹${cleanPrice})
        </button>
      </div>
    `;
    freshArea.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  applyLocalHint(barcode) {
    const localHint = this.getLocalOfflineHint(barcode);
    if (localHint && localHint.item) {
      this.renderMatchedBarcodeCard(localHint.item, localHint.sourceLabel, barcode);
    }
  }

  async fetchAndRenderGoogleBarcode(barcode) {
    const resultArea = document.getElementById('scanned-detection-area');
    if (!resultArea) return;

    const isOnline = typeof navigator === 'undefined' ? true : navigator.onLine !== false;

    resultArea.innerHTML = `
      <div style="padding: 14px; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); text-align: center;">
        <div style="display: inline-block; width: 18px; height: 18px; border: 2px solid var(--primary); border-top-color: transparent; border-radius: 50%; animation: spin 0.6s linear infinite; margin-bottom: 6px;"></div>
        <div style="font-size: 13px; font-weight: 700; color: var(--text-primary);">
          Identifying Barcode ${this.escapeHtml(barcode)}...
        </div>
        <div style="font-size: 11.5px; color: var(--text-muted); margin-top: 2px;">
          ${isOnline
            ? '🟢 Online Mode: Checking Open Food Facts & Gemini Search Grounding'
            : '🟠 Offline Mode: Checking Local Kirana Registry & Saved Cache'}
        </div>
      </div>
    `;

    let matchedItem = null;
    let sourceLabel = '';
    let onlineApiError = null;
    let onlineApiStatus = 0;

    if (isOnline) {
      // STRICT ONLINE PATH: Query live Open Food Facts API & Gemini Grounding ONLY
      // Step 1: Open Food Facts v2 API
      try {
        const controller = new AbortController();
        const tid = setTimeout(() => controller.abort(), 3500);
        const offRes = await fetch(
          `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=product_name,brands,categories,quantity,image_front_url`,
          { signal: controller.signal }
        );
        clearTimeout(tid);
        if (offRes.ok) {
          const offData = await offRes.json();
          if (offData && offData.status === 1 && offData.product) {
            const p = offData.product;
            const name = p.product_name ? `${p.product_name} ${p.quantity || ''}`.trim() : '';
            if (name) {
              matchedItem = {
                barcode,
                name,
                brand: p.brands || 'Packaged Brand',
                cat: this.normalizeCategory(p.categories || 'Grocery'),
                mrp: 30,
                price: 28,
                cost: 23,
                unit: p.quantity ? 'unit' : 'pack',
                imageUrl: p.image_front_url || null,
                emoji: '📦'
              };
              sourceLabel = '🟢 Online • Open Food Facts';
            }
          }
        }
      } catch (e) {}

      // Step 2: Gemini Grounding via /api/gemini
      if (!matchedItem && window.DukaanAI && typeof DukaanAI.lookupBarcodeOnline === 'function') {
        const geminiRes = await DukaanAI.lookupBarcodeOnline(barcode);
        if (geminiRes && geminiRes.ok && geminiRes.found && geminiRes.product && geminiRes.product.name) {
          matchedItem = geminiRes.product;
          sourceLabel = `🟢 Online • Gemini (${geminiRes.model || 'Search Grounding'})`;
        } else if (geminiRes && !geminiRes.ok && !geminiRes.offline) {
          onlineApiError = geminiRes.error || 'Gemini barcode lookup failed';
          onlineApiStatus = geminiRes.status || 0;
        }
      }

      // Persist online match to cache for future offline scans
      if (matchedItem && matchedItem.name) {
        try {
          const cache = JSON.parse(localStorage.getItem('mydukaan24_barcode_cache') || '{}');
          cache[barcode] = matchedItem;
          localStorage.setItem('mydukaan24_barcode_cache', JSON.stringify(cache));
        } catch (e) {}
      }
    } else {
      // STRICT OFFLINE PATH: System is offline -> use local FMCG catalog / cache / GS1 prefix
      const offlineHit = this.getLocalOfflineHint(barcode);
      if (offlineHit) {
        matchedItem = offlineHit.item;
        sourceLabel = offlineHit.sourceLabel;
      }
    }

    const freshArea = document.getElementById('scanned-detection-area');
    if (!freshArea) return;

    if (matchedItem && matchedItem.name) {
      this.renderMatchedBarcodeCard(matchedItem, sourceLabel, barcode);
      return;
    }

    // No match: render clean manual form + explicit opt-in local hint button (never mix silently while online!)
    const localHint = isOnline ? this.getLocalOfflineHint(barcode) : null;
    const statusBadge = isOnline
      ? `<span class="badge ${onlineApiError ? 'badge-danger' : 'badge-warning'}">${onlineApiError ? `Online API Error (${onlineApiStatus || 'Err'})` : 'Online: Not Found'}</span>`
      : `<span class="badge badge-warning">Offline: New Item</span>`;

    freshArea.innerHTML = `
      <div style="background: var(--bg-surface); padding: 14px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 8px;">
          <div style="font-size: 12.5px; font-weight: 700; color: var(--warning);">
            Barcode: ${this.escapeHtml(barcode)}
          </div>
          ${statusBadge}
        </div>
        ${onlineApiError ? `
          <div style="background: var(--danger-light); border: 1px solid var(--danger-border); border-radius: var(--radius-sm); padding: 8px 10px; margin-bottom: 10px; font-size: 11.5px; color: var(--text-primary); word-break: break-word;">
            <strong style="color: var(--danger);">Live Gemini Lookup Failed:</strong> ${this.escapeHtml(onlineApiError)}
            <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px;">
              <button class="btn btn-primary btn-sm" data-barcode="${this.escapeHtml(barcode)}" onclick="BarcodeScanner.fetchAndRenderGoogleBarcode(this.dataset.barcode)">↻ Retry Online</button>
            </div>
          </div>
        ` : `
          <p style="font-size: 11.5px; color: var(--text-muted); margin-bottom: 10px;">
            ${isOnline
              ? 'Live APIs did not return an exact match for this barcode. Enter product details once to register locally:'
              : 'System is offline and barcode is not cached yet. Enter details below to register:'}
          </p>
        `}
        ${localHint ? `
          <div style="margin-bottom: 10px;">
            <button class="btn btn-secondary btn-sm" style="width: 100%; justify-content: center; border-style: dashed;" data-barcode="${this.escapeHtml(barcode)}" onclick="BarcodeScanner.applyLocalHint(this.dataset.barcode)">
              📦 Use Local Catalog Hint: ${this.escapeHtml(localHint.item.name)}
            </button>
          </div>
        ` : ''}
        <div class="scanner-form-grid" style="margin-bottom: 10px;">
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
        <button class="btn btn-primary" style="width: 100%; justify-content: center;" data-barcode="${this.escapeHtml(barcode)}" onclick="BarcodeScanner.quickRegisterAndAddToCart(this.dataset.barcode)">
          ${Icons.check(14)} Save to Inventory & Add to Bill
        </button>
      </div>
    `;

    freshArea.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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

  confirmAndSaveProduct(barcode, cat = 'Grocery', estimatedCost = null) {
    if (window.App && typeof App.isCashierMode === 'function' && App.isCashierMode()) {
      App.requireOwner('register new catalog SKUs');
      return;
    }
    const nameIn = document.getElementById('google-edit-name');
    const priceIn = document.getElementById('google-edit-price');
    const mrpIn = document.getElementById('google-edit-mrp');

    const name = nameIn && nameIn.value.trim() ? nameIn.value.trim() : `Product ${barcode.slice(-4)}`;
    const price = priceIn && parseFloat(priceIn.value) > 0 ? parseFloat(priceIn.value) : 20;
    const mrp = mrpIn && parseFloat(mrpIn.value) > 0 ? parseFloat(mrpIn.value) : Math.round(price * 1.15);
    const cost = Number(estimatedCost) > 0 ? Number(estimatedCost) : Math.round(price * 0.85);

    const newProduct = {
      id: DB.uid('P'),
      name,
      cat,
      barcode,
      mrp,
      price,
      cost,
      stock: 25,
      unit: 'pack',
      minStock: 5,
      gstRate: DB.inferDefaultGstRate(cat, name),
      expiryDate: ''
    };

    DB.updateItem('products', newProduct);
    if (window.POS) POS.addItemToCart(newProduct);
    if (window.Inventory) Inventory.render();

    App.toast('success', 'Product Saved', `${name} added at ₹${price}`);
    this.closeScannerModal();
  }

  quickRegisterAndAddToCart(barcode) {
    if (window.App && typeof App.isCashierMode === 'function' && App.isCashierMode()) {
      App.requireOwner('register new catalog SKUs');
      return;
    }
    const nameInput = document.getElementById('quick-add-name');
    const priceInput = document.getElementById('quick-add-price');
    const catInput = document.getElementById('quick-add-cat');

    const name = nameInput && nameInput.value.trim() ? nameInput.value.trim() : `Product ${barcode.slice(-4)}`;
    const price = priceInput && parseFloat(priceInput.value) > 0 ? parseFloat(priceInput.value) : 20;
    const cat = catInput ? catInput.value : 'Grocery';
    const mrp = Math.round(price * 1.15);
    const cost = Math.round(price * 0.85);

    const newProduct = {
      id: DB.uid('P'),
      name,
      cat,
      barcode,
      mrp,
      price,
      cost,
      stock: 25,
      unit: "pack",
      minStock: 5,
      gstRate: DB.inferDefaultGstRate(cat, name),
      expiryDate: ''
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

  simulateSampleScan(targetCode = "8901719908262") {
    const input = document.getElementById('manual-barcode-input');
    if (input) input.value = targetCode;
    this.onBarcodeDetected(targetCode, 'demo');
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
