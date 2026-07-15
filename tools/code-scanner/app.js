document.addEventListener("DOMContentLoaded", () => {
  // Local state
  let scanHistory = [];
  let html5QrCode = null;
  let isScanning = false;
  let activeCameraId = "";

  // DOM Selection
  const tabButtons = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");

  const cameraSelect = document.getElementById("camera-select");
  const toggleCameraBtn = document.getElementById("toggle-camera-btn");
  const readerElement = document.getElementById("reader");
  const viewfinderPlaceholder = document.getElementById("viewfinder-placeholder");

  const dropZone = document.getElementById("drop-zone");
  const fileInput = document.getElementById("file-input");
  const fileStatus = document.getElementById("file-status");
  const fileStatusText = document.getElementById("file-status-text");
  const imagePreviewContainer = document.getElementById("image-preview-container");
  const imagePreview = document.getElementById("image-preview");
  const clearImageBtn = document.getElementById("clear-image-btn");

  const outputBadge = document.getElementById("output-badge");
  const outputText = document.getElementById("output-text");
  const copyBtn = document.getElementById("copy-btn");
  const openLinkBtn = document.getElementById("open-link-btn");

  const historyEmpty = document.getElementById("history-empty");
  const historyList = document.getElementById("history-list");
  const clearHistoryBtn = document.getElementById("clear-history-btn");

  // Initialize Lucide Icons
  if (typeof lucide !== "undefined") {
    lucide.createIcons();
  }

  const isCameraSupported = () => {
    return window.isSecureContext &&
      !!navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === "function";
  };

  const setCameraSelectMessage = (message) => {
    cameraSelect.innerHTML = "";
    const option = document.createElement("option");
    option.value = "";
    option.textContent = message;
    cameraSelect.appendChild(option);
    activeCameraId = "";
  };

  const setStartButtonState = (icon, text, disabled = false) => {
    toggleCameraBtn.disabled = disabled;
    toggleCameraBtn.innerHTML = `<i data-lucide="${icon}"></i> ${text}`;
    if (typeof lucide !== "undefined") lucide.createIcons();
  };

  const getCameraErrorMessage = (err) => {
    const name = err && err.name ? err.name : "";
    if (name === "NotAllowedError" || name === "SecurityError") {
      return "Camera access was denied. Allow permission and try again.";
    }
    if (name === "NotFoundError" || name === "OverconstrainedError") {
      return "No usable camera was found on this device.";
    }
    if (name === "NotReadableError" || name === "AbortError") {
      return "Camera is already in use or could not be opened.";
    }
    if (name === "TypeError") {
      return "This browser does not support camera access in the current context.";
    }
    return "Could not open the camera stream.";
  };

  // ── Tab Management ───────────────────────────────────────────
  tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const targetTab = btn.getAttribute("data-tab");
      
      // Update tab buttons active state
      tabButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      // Toggle tab content visibility
      tabContents.forEach(content => {
        if (content.id === targetTab) {
          content.classList.remove("hidden");
        } else {
          content.classList.add("hidden");
        }
      });

      // Stop camera if switching away from camera tab
      if (targetTab !== "camera-tab" && isScanning) {
        stopCameraScanner();
      }
    });
  });

  // Helper to populate the cameras dropdown
  const populateCamerasDropdown = (devices) => {
    cameraSelect.innerHTML = "";
    let backCameraId = "";
    
    devices.forEach(device => {
      const option = document.createElement("option");
      option.value = device.id;
      option.textContent = device.label || `Camera ${cameraSelect.children.length + 1}`;
      cameraSelect.appendChild(option);

      const labelLower = (device.label || "").toLowerCase();
      if (labelLower.includes("back") || labelLower.includes("rear") || labelLower.includes("environment")) {
        backCameraId = device.id;
      }
    });

    if (backCameraId) {
      cameraSelect.value = backCameraId;
    } else {
      cameraSelect.value = devices[0].id;
    }
    activeCameraId = cameraSelect.value;
  };

  const initCameras = () => {
    if (typeof Html5Qrcode === "undefined") {
      setCameraSelectMessage("Scanner library not loaded");
      setStartButtonState("play", "Start Scanner", true);
      viewfinderPlaceholder.querySelector("p").textContent = "Camera scanning is unavailable right now.";
      return;
    }

    if (!isCameraSupported()) {
      setCameraSelectMessage("Camera access requires HTTPS");
      setStartButtonState("play", "Start Scanner", true);
      viewfinderPlaceholder.querySelector("p").textContent = "Open this tool over HTTPS to enable camera access.";
      return;
    }

    // Try to list cameras without triggering a prompt first.
    Html5Qrcode.getCameras()
      .then(devices => {
        if (devices && devices.length > 0) {
          populateCamerasDropdown(devices);
        } else {
          setCameraSelectMessage("Start scanner to request permission");
        }
      })
      .catch(err => {
        console.warn("Camera check on load:", err);
        setCameraSelectMessage("Start scanner to request permission");
      });
  };

  cameraSelect.addEventListener("change", () => {
    activeCameraId = cameraSelect.value;
    if (isScanning) {
      // Restart scanner with the new camera ID
      stopCameraScanner().then(() => startCameraScanner());
    }
  });

  const startScanningStream = () => {
    if (!html5QrCode) {
      html5QrCode = new Html5Qrcode("reader");
    }

    viewfinderPlaceholder.classList.add("hidden");
    readerElement.classList.remove("hidden");
    readerElement.parentElement.classList.add("scanning");

    toggleCameraBtn.disabled = true;
    toggleCameraBtn.innerHTML = `<i data-lucide="loader"></i> Connecting...`;
    if (typeof lucide !== "undefined") lucide.createIcons();

    const config = {
      fps: 10,
      qrbox: (width, height) => {
        const size = Math.min(width, height) * 0.65;
        return { width: size, height: size };
      }
    };

    html5QrCode.start(
      activeCameraId,
      config,
      (decodedText, decodedResult) => {
        handleScanSuccess(decodedText, decodedResult);
        stopCameraScanner();
      },
      (errorMessage) => {
        // ignore
      }
    )
    .then(() => {
      isScanning = true;
      toggleCameraBtn.disabled = false;
      toggleCameraBtn.innerHTML = `<i data-lucide="square"></i> Stop Scanner`;
      if (typeof lucide !== "undefined") lucide.createIcons();
    })
    .catch(err => {
      console.error("Failed to start camera scanner:", err);
      if (window.showToast) window.showToast("Could not open camera stream.", false);
      stopCameraScanner();
    });
  };

  const startCameraScanner = () => {
    if (!isCameraSupported()) {
      if (window.showToast) window.showToast("Camera access requires a secure HTTPS context.", false);
      setStartButtonState("play", "Start Scanner", true);
      return;
    }

    // If activeCameraId is empty, it means we don't have camera permission yet or devices weren't queried
    if (!activeCameraId) {
      setStartButtonState("loader", "Requesting access...", true);

      navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
        .then(stream => {
          // Stop stream immediately
          stream.getTracks().forEach(track => track.stop());
          // Query devices now that permission is granted
          return Html5Qrcode.getCameras();
        })
        .then(devices => {
          if (devices && devices.length > 0) {
            populateCamerasDropdown(devices);
            startScanningStream();
          } else {
            throw new Error("No cameras found");
          }
        })
        .catch(err => {
          console.error("Camera prompt error:", err);
          if (window.showToast) window.showToast(getCameraErrorMessage(err), false);
          setCameraSelectMessage("Access denied");
          setStartButtonState("play", "Start Scanner");
        });
      return;
    }

    startScanningStream();
  };

  const stopCameraScanner = () => {
    return new Promise((resolve) => {
      setStartButtonState("loader", "Closing...", true);

      if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop()
          .then(() => {
            isScanning = false;
            setStartButtonState("play", "Start Scanner");
            readerElement.classList.add("hidden");
            readerElement.parentElement.classList.remove("scanning");
            viewfinderPlaceholder.classList.remove("hidden");
            resolve();
          })
          .catch(err => {
            console.error("Error stopping scanner:", err);
            setStartButtonState("play", "Start Scanner");
            resolve();
          });
      } else {
        isScanning = false;
        setStartButtonState("play", "Start Scanner");
        readerElement.classList.add("hidden");
        readerElement.parentElement.classList.remove("scanning");
        viewfinderPlaceholder.classList.remove("hidden");
        resolve();
      }
    });
  };

  toggleCameraBtn.addEventListener("click", () => {
    if (isScanning) {
      stopCameraScanner();
    } else {
      startCameraScanner();
    }
  });

  // ── File Upload / Drag & Drop Decoder ─────────────────────────
  const processImageFile = (file) => {
    if (!file) return;

    // Display image preview
    const reader = new FileReader();
    reader.onload = (e) => {
      imagePreview.src = e.target.result;
      imagePreviewContainer.classList.remove("hidden");
    };
    reader.readAsDataURL(file);

    // Set decoding status
    fileStatus.className = "status-banner info";
    fileStatusText.textContent = "Decoding image code...";
    fileStatus.classList.remove("hidden");

    // Scan File using a temporary standalone Html5Qrcode instance
    const tempScanner = new Html5Qrcode("reader");
    tempScanner.scanFile(file, false)
      .then(decodedText => {
        // Success
        fileStatus.className = "status-banner success";
        fileStatusText.textContent = "Successfully decoded!";
        
        // Estimate format (fallback to QR if not explicitly known)
        const formatStr = "DECODED_FILE";
        handleDecodedResult(decodedText, formatStr);
      })
      .catch(err => {
        console.warn("File decode error:", err);
        fileStatus.className = "status-banner error";
        fileStatusText.textContent = "No readable QR/Barcode found. Try another or check resolution.";
      });
  };

  // Drag over handlers
  ["dragenter", "dragover"].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropZone.classList.add("dragover");
    }, false);
  });

  ["dragleave", "drop"].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropZone.classList.remove("dragover");
    }, false);
  });

  dropZone.addEventListener("drop", (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files && files.length > 0) {
      processImageFile(files[0]);
    }
  });

  fileInput.addEventListener("change", () => {
    if (fileInput.files && fileInput.files.length > 0) {
      processImageFile(fileInput.files[0]);
    }
  });

  clearImageBtn.addEventListener("click", (e) => {
    e.stopPropagation(); // Avoid triggering file selection window
    fileInput.value = "";
    imagePreview.src = "#";
    imagePreviewContainer.classList.add("hidden");
    fileStatus.classList.add("hidden");
  });

  // ── Clipboard Paste Support ────────────────────────────────────
  window.addEventListener("paste", (e) => {
    // Only intercept if we are on the File tab
    const fileTabActive = !document.getElementById("file-tab").classList.contains("hidden");
    if (!fileTabActive) return;

    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const blob = items[i].getAsFile();
        processImageFile(blob);
        break;
      }
    }
  });

  // ── Result Handling ──────────────────────────────────────────
  const handleScanSuccess = (decodedText, decodedResult) => {
    if (window.showToast) window.showToast("Code successfully scanned!");
    
    let formatStr = "QR_CODE";
    if (decodedResult && decodedResult.result && decodedResult.result.format) {
      formatStr = decodedResult.result.format.formatName || formatStr;
    }

    handleDecodedResult(decodedText, formatStr);
  };

  const handleDecodedResult = (text, format) => {
    // Populate raw result textarea
    outputText.value = text;
    
    // Set format badge
    outputBadge.textContent = format.replace(/_/g, " ");
    outputBadge.classList.remove("hidden");

    // Enable copy button
    copyBtn.disabled = false;

    // Check if the output is a valid URL
    const urlPattern = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([\/\w .-]*)*\/?(\?.*)?(#.*)?$/i;
    if (urlPattern.test(text.trim())) {
      let url = text.trim();
      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        url = "https://" + url;
      }
      openLinkBtn.href = url;
      openLinkBtn.classList.remove("disabled");
    } else {
      openLinkBtn.href = "#";
      openLinkBtn.classList.add("disabled");
    }

    // Add to history
    addHistoryItem(text, format);
  };

  copyBtn.addEventListener("click", () => {
    if (!outputText.value) return;
    navigator.clipboard.writeText(outputText.value)
      .then(() => {
        if (window.showToast) window.showToast("Data copied to clipboard!");
      })
      .catch(err => {
        alert("Failed to copy: " + err);
      });
  });

  // ── History Management ───────────────────────────────────────
  const addHistoryItem = (text, format) => {
    const newItem = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      format: format,
      text: text
    };

    // Prepend to history array
    scanHistory.unshift(newItem);
    
    // Keep max 50 items
    if (scanHistory.length > 50) {
      scanHistory.pop();
    }

    renderHistory();

    // Trigger change event to alert project manager auto-save
    document.dispatchEvent(new Event("change", { bubbles: true }));
  };

  const renderHistory = () => {
    historyList.innerHTML = "";

    if (scanHistory.length === 0) {
      historyEmpty.classList.remove("hidden");
      clearHistoryBtn.disabled = true;
      return;
    }

    historyEmpty.classList.add("hidden");
    clearHistoryBtn.disabled = false;

    scanHistory.forEach(item => {
      const li = document.createElement("li");
      li.className = "history-item";

      const timeStr = new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      li.innerHTML = `
        <div class="history-item-left">
          <div class="history-item-meta">
            <span class="badge secondary">${item.format.replace(/_/g, " ")}</span>
            <span class="history-time">${timeStr}</span>
          </div>
          <div class="history-text">${escapeHtml(item.text)}</div>
        </div>
        <div class="history-item-right">
          <button class="icon-btn secondary-btn copy-item-btn" title="Copy text">
            <i data-lucide="copy" style="width: 14px; height: 14px;"></i>
          </button>
        </div>
      `;

      // Copy specific history item
      li.querySelector(".copy-item-btn").addEventListener("click", () => {
        navigator.clipboard.writeText(item.text)
          .then(() => {
            if (window.showToast) window.showToast("Copied history value!");
          });
      });

      historyList.appendChild(li);
    });

    if (typeof lucide !== "undefined") {
      lucide.createIcons();
    }
  };

  clearHistoryBtn.addEventListener("click", () => {
    if (confirm("Are you sure you want to clear your scan history?")) {
      scanHistory = [];
      renderHistory();
      document.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });

  const escapeHtml = (text) => {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  // ── Import / Export Logic ────────────────────────────────────
  window.exportJSON = function() {
    if (scanHistory.length === 0) {
      if (window.showToast) window.showToast("No history items to export.", false);
      return;
    }
    const blob = new Blob([JSON.stringify({ history: scanHistory }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `code-scanner-history-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  window.importJSON = function(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(evt) {
      try {
        const data = JSON.parse(evt.target.result);
        if (data && Array.isArray(data.history)) {
          scanHistory = data.history;
          renderHistory();
          document.dispatchEvent(new Event("change", { bubbles: true }));
          if (window.showToast) window.showToast("Scan history imported successfully!");
        } else {
          alert("Invalid import format. JSON must contain a history list.");
        }
      } catch (err) {
        alert("Failed to parse JSON file: " + err.message);
      }
    };
    reader.readAsText(file);
    // Reset file selector input value so the same file can be imported again
    e.target.value = "";
  };

  window.shareLink = function() {
    try {
      const state = { history: scanHistory };
      const serialized = (window.encodeShareState ? window.encodeShareState(state) : btoa(unescape(encodeURIComponent(JSON.stringify(state)))));
      const url = new URL(window.location.href);
      url.searchParams.set("design", serialized);
      
      navigator.clipboard.writeText(url.toString()).then(() => {
        if (window.showToast) window.showToast("Sharing link copied to clipboard!");
      });
    } catch (err) {
      console.error(err);
      if (window.showToast) window.showToast("Failed to create sharing link.", false);
    }
  };

  // ── Project Manager Integration ──────────────────────────────
  window.projectManagerConfig = {
    toolId: "code-scanner",
    getInputs: () => {
      return { history: scanHistory };
    },
    setInputs: (data) => {
      if (data && Array.isArray(data.history)) {
        scanHistory = data.history;
        renderHistory();
      }
    }
  };

  // Run initializations
  initCameras();
  
  // Parse shared URL design if present
  const urlParams = new URLSearchParams(window.location.search);
  const designParam = urlParams.get("design");
  let loadedFromUrl = false;
  if (designParam) {
    try {
      const decoded = (window.decodeShareState ? window.decodeShareState(designParam) : JSON.parse(decodeURIComponent(escape(atob(designParam)))));
      window.projectManagerConfig.setInputs(decoded);
      loadedFromUrl = true;
    } catch (err) {
      console.error("Failed to parse design from URL:", err);
    }
  }
  
  if (!loadedFromUrl) {
    renderHistory();
  }
});
