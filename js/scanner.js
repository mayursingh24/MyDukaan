/**
 * MyDukaan Pro — High-Speed Camera & Hardware Barcode Scanner Engine
 * Created & Deployed by Mayur Singh
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
      // Don't intercept normal typing in regular form inputs unless it's very fast
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
                <div style="font-weight:700;font-size:15px;color:var(--text-primary);">Barcode & QR Scanner</div>
                <div style="font-size:11px;color:var(--text-muted);">Point camera at product barcode</div>
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
            <input type="text" id="manual-barcode-input" class="form-input" style="padding:6px 10px;font-size:12px;font-family:var(--font-mono);" placeholder="Or enter barcode manually (e.g. 8901058852336)" />
            <button class="btn btn-primary btn-sm" onclick="BarcodeScanner.handleManualSubmit()">Lookup</button>
          </div>

          <!-- Detection Result Card Area -->
          <div id="scanned-detection-area" style="display:none;" class="scanned-detection-card"></div>

          <div style="padding:12px 18px;display:flex;align-items:center;justify-content:space-between;background:var(--bg-surface);">
            <div style="display:flex;gap:8px;">
              <button class="btn btn-secondary btn-sm" onclick="BarcodeScanner.switchCamera()">🔄 Flip Camera</button>
              <button class="btn btn-secondary btn-sm" onclick="BarcodeScanner.simulateSampleScan()">⚡ Demo Barcode</button>
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
    const video = document.getElementById('scanner-video-preview');
    if (!video) return;

    this.currentFacingMode = facingMode;

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
        statusPill.textContent = 'Camera not available. Use manual entry or Demo scan.';
        statusPill.style.color = '#EF4444';
      }
    }
  }

  startScanningLoop(video) {
    if (!this.barcodeDetector) {
      // Fallback: Check if canvas-based scanning is needed or user uses manual barcode
      return;
    }

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
    const cleanCode = barcode.trim();
    const db = DB.getData();
    const product = db.products.find(p => p.barcode === cleanCode || p.id === cleanCode);

    const resultArea = document.getElementById('scanned-detection-area');
    if (!resultArea) {
      // Modal wasn't open, e.g. hardware scan fired in POS billing view
      if (product) {
        if (window.POS) POS.addItemToCart(product);
        App.toast('success', `Scanned: ${product.name}`, `Added to bill (₹${product.price})`);
      } else {
        App.toast('warning', `Barcode ${cleanCode}`, 'Product not found in inventory');
      }
      return;
    }

    resultArea.style.display = 'block';

    if (product) {
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
      resultArea.innerHTML = `
        <div style="padding:12px;background:var(--warning-light);border:1px solid var(--warning-border);border-radius:var(--radius-md);">
          <div style="font-weight:700;color:var(--warning);font-size:13px;display:flex;align-items:center;gap:6px;">
            ⚠️ Barcode Not Found: <span style="font-family:var(--font-mono);">${cleanCode}</span>
          </div>
          <p style="font-size:12px;color:var(--text-secondary);margin-top:4px;">This barcode is not yet registered in your store catalog.</p>
          <button class="btn btn-primary btn-sm" style="margin-top:8px;" onclick="BarcodeScanner.closeScannerModal(); Inventory.openAddProductWithBarcode('${cleanCode}')">
            ➕ Register New Product with Barcode ${cleanCode}
          </button>
        </div>
      `;
    }
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
    const sampleBarcodes = ['8901058852336', '8901725131235', '8901262010053', '8906007280145', '7622201738210'];
    const randomCode = sampleBarcodes[Math.floor(Math.random() * sampleBarcodes.length)];
    const manualInput = document.getElementById('manual-barcode-input');
    if (manualInput) manualInput.value = randomCode;
    this.onBarcodeDetected(randomCode, 'demo');
  }

  switchCamera() {
    const nextMode = this.currentFacingMode === 'environment' ? 'user' : 'environment';
    this.startCamera(nextMode);
  }

  closeScannerModal() {
    this.isScanning = false;
    if (this.videoStream) {
      this.videoStream.getTracks().forEach(track => track.stop());
      this.videoStream = null;
    }
    const modal = document.getElementById('scanner-modal');
    if (modal) modal.remove();
  }
}

window.BarcodeScanner = new BarcodeScannerEngine();
