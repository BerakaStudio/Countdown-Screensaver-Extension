class CountdownScreensaver {
  constructor() {
    this.isActive = false;
    this.container = null;
    this.countdownInterval = null;
    this.cleanup = null;
    this.fontsLoaded = false;
    this.wakeLock = null;
    this.fullscreenAttempted = false;
    this.template = `<div class="screensaver-overlay active"><div class="countdown">${[
      "days",
      "hours",
      "minutes",
      "seconds",
    ]
      .map(
        (unit) =>
          `<div class="time-block" data-unit="${unit}"><div class="time">00</div><div class="label">${this.getLabel(
            unit
          )}</div></div>${
            unit !== "seconds" ? '<div class="separator">:</div>' : ""
          }`
      )
      .join(
        ""
      )}</div><div class="esc-hint">Presiona ESC, F11 o haz clic para salir</div></div>`;
    
    // Configurar hotkey global para Ctrl+Shift+S
    this.setupGlobalHotkey();
  }

  setupGlobalHotkey() {
    document.addEventListener('keydown', async (e) => {
      // Detectar Ctrl+Shift+S
      if (e.ctrlKey && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        e.stopPropagation();
        
        // No lanzar si ya está activo
        if (this.isActive) return;
        
        // Verificar que no estemos en páginas restringidas
        const restrictedUrls = [
          'chrome://',
          'chrome-extension://',
          'edge://',
          'about:'
        ];
        
        if (restrictedUrls.some(url => window.location.href.startsWith(url))) {
          console.warn('Cannot execute screensaver on system pages');
          return;
        }
        
        try {
          // Cargar configuración guardada
          const settings = await this.loadSettings();
          
          // Lanzar screensaver directamente
          console.log('Launching screensaver with Ctrl+Shift+S');
          await this.launch(settings);
        } catch (error) {
          console.error('Error launching screensaver with hotkey:', error);
        }
      }
    }, true);
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.sync.get('countdownSettings');
      return result.countdownSettings || {
        targetDate: "2025-12-31T23:59:59",
        fontSize: "small",
        fontFamily: "moderna",
        showLabels: true,
        showBlocks: true,
        darkMode: true,
      };
    } catch (error) {
      console.error('Error loading settings:', error);
      // Retornar configuración por defecto
      return {
        targetDate: "2025-12-31T23:59:59",
        fontSize: "small",
        fontFamily: "moderna",
        showLabels: true,
        showBlocks: true,
        darkMode: true,
      };
    }
  }

  getLabel(unit) {
    const labels = {
      days: "Días",
      hours: "Horas",
      minutes: "Minutos",
      seconds: "Segundos",
    };
    return labels[unit];
  }

  async requestWakeLock() {
    try {
      if ("wakeLock" in navigator) {
        this.wakeLock = await navigator.wakeLock.request("screen");
        console.log(
          "Wake Lock activado - protector de pantalla del sistema bloqueado"
        );

        this.wakeLock.addEventListener("release", () => {
          console.log("Wake Lock liberado");
          this.wakeLock = null;
        });

        return true;
      } else {
        console.warn("Wake Lock API no disponible en este navegador");
        return false;
      }
    } catch (err) {
      console.error("Error al solicitar Wake Lock:", err);
      return false;
    }
  }

  async releaseWakeLock() {
    if (this.wakeLock) {
      try {
        await this.wakeLock.release();
        this.wakeLock = null;
        console.log("Wake Lock liberado exitosamente");
      } catch (err) {
        console.error("Error al liberar Wake Lock:", err);
      }
    }
  }

  async reactivateWakeLockIfNeeded() {
    if (this.isActive && !this.wakeLock) {
      console.log("Reactivando Wake Lock...");
      await this.requestWakeLock();
    }
  }

  async loadFonts() {
    if (this.fontsLoaded) return;

    const extensionId = chrome.runtime.id;
    const fonts = [
      {
        family: "Inter Tight",
        url: `chrome-extension://${extensionId}/fonts/InterTight-VariableFont_wght.ttf`,
      },
      {
        family: "Oxanium",
        url: `chrome-extension://${extensionId}/fonts/Oxanium-VariableFont_wght.ttf`,
      },
      {
        family: "Lora",
        url: `chrome-extension://${extensionId}/fonts/Lora-VariableFont_wght.ttf`,
      },
      {
        family: "Antonio",
        url: `chrome-extension://${extensionId}/fonts/Antonio-VariableFont_wght.ttf`,
      },
      {
        family: "Chewy",
        url: `chrome-extension://${extensionId}/fonts/Chewy-Regular.ttf`,
      },
      {
        family: "Doto",
        url: `chrome-extension://${extensionId}/fonts/Doto-VariableFont_ROND,wght.ttf`,
      },
    ];

    try {
      const fontPromises = fonts.map(async (font) => {
        try {
          const fontFace = new FontFace(font.family, `url(${font.url})`, {
            display: "swap",
            weight: "100 900",
          });

          await fontFace.load();
          document.fonts.add(fontFace);

          return { family: font.family, loaded: true };
        } catch (error) {
          console.warn(`Error loading font ${font.family}:`, error);
          return { family: font.family, loaded: false };
        }
      });

      const results = await Promise.allSettled(fontPromises);
      const loadedFonts = results
        .filter(
          (result) => result.status === "fulfilled" && result.value.loaded
        )
        .map((result) => result.value.family);

      console.log("Fonts loaded successfully:", loadedFonts);
      this.fontsLoaded = true;

      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (error) {
      console.error("Error in font loading process:", error);
    }
  }

  async launch(settings) {
    if (this.isActive) return false;

    await this.loadFonts();

    this.container = document.createElement("div");
    this.container.id = "countdown-screensaver-overlay";
    this.container.innerHTML = this.template;
    document.body.appendChild(this.container);

    this.applySettings(settings);
    this.setupEvents();
    this.startCountdown(settings.targetDate);
    this.isActive = true;

    this.container.offsetHeight;

    await this.requestWakeLock();

    // Intentar fullscreen con manejo mejorado de errores
    this.attemptFullscreen();
    return true;
  }

  applySettings(settings) {
    const overlay = this.container.querySelector(".screensaver-overlay");

    overlay.className = [
      "screensaver-overlay",
      "active",
      `size-${settings.fontSize}`,
      `font-${settings.fontFamily}`,
      !settings.darkMode ? "light-mode" : "",
    ]
      .filter(Boolean)
      .join(" ");

    this.toggleElements(".time-block", settings.showBlocks, "hidden");
    this.toggleElements(".label", settings.showLabels, "hidden");

    if (settings.customTheme) {
      overlay.style.setProperty("--bg-dark", settings.customTheme.background);
      overlay.style.setProperty("--text-dark", settings.customTheme.text);
    }

    this.forceFont(settings.fontFamily);
  }

  forceFont(fontFamily) {
    const fontMap = {
      moderna: "Inter Tight",
      futurista: "Oxanium",
      clasica: "Lora",
      condensada: "Antonio",
      casual: "Chewy",
      digital: "Doto",
    };

    const fontName = fontMap[fontFamily];
    if (fontName) {
      const elements = this.container.querySelectorAll(
        ".time, .label, .separator, .esc-hint"
      );
      elements.forEach((el) => {
        el.style.fontFamily = `"${fontName}", sans-serif`;
        el.style.fontDisplay = "swap";
      });
    }
  }

  toggleElements(selector, show, hiddenClass) {
    this.container.querySelectorAll(selector).forEach((el) => {
      el.classList.toggle(hiddenClass, !show);
    });
  }

  calculateTimeRemaining(targetDate) {
    const diff = targetDate - new Date();
    if (diff <= 0)
      return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
    const totalSeconds = Math.floor(diff / 1000);
    return {
      days: Math.floor(totalSeconds / 86400),
      hours: Math.floor((totalSeconds % 86400) / 3600),
      minutes: Math.floor((totalSeconds % 3600) / 60),
      seconds: totalSeconds % 60,
      expired: false,
    };
  }

  updateCountdown(targetDate) {
    if (!this.container) return;
    const timeData = this.calculateTimeRemaining(targetDate);
    ["days", "hours", "minutes", "seconds"].forEach((unit) => {
      const element = this.container.querySelector(
        `[data-unit="${unit}"] .time`
      );
      if (element) {
        element.textContent = String(timeData[unit]).padStart(2, "0");
        element.classList.toggle("expired", timeData.expired);
      }
    });
  }

  startCountdown(targetDate) {
    const target = new Date(targetDate);
    this.updateCountdown(target);
    this.countdownInterval = setInterval(
      () => this.updateCountdown(target),
      1000
    );
  }

  setupEvents() {
    const keyHandler = (e) => {
      if (this.isActive && (e.key === "Escape" || e.key === "F11")) {
        e.preventDefault();
        e.stopPropagation();
        this.close();
      }
    };

    const clickHandler = (e) => {
      // Permitir hacer clic para activar fullscreen si no se ha intentado
      if (!this.fullscreenAttempted && !document.fullscreenElement) {
        this.attemptFullscreen();
        return;
      }
      
      if (e.target.closest("#countdown-screensaver-overlay")) {
        this.close();
      }
    };

    const fullscreenHandler = () => {
      if (!document.fullscreenElement && this.isActive) {
        setTimeout(() => this.isActive && this.close(), 100);
      }
    };

    const visibilityHandler = async () => {
      if (this.isActive) {
        if (document.hidden) {
          await this.releaseWakeLock();
        } else {
          await this.reactivateWakeLockIfNeeded();
        }
      }
    };

    document.addEventListener("keydown", keyHandler, true);
    document.addEventListener("fullscreenchange", fullscreenHandler);
    document.addEventListener("visibilitychange", visibilityHandler);
    this.container.addEventListener("click", clickHandler);

    this.cleanup = () => {
      document.removeEventListener("keydown", keyHandler, true);
      document.removeEventListener("fullscreenchange", fullscreenHandler);
      document.removeEventListener("visibilitychange", visibilityHandler);
      this.container?.removeEventListener("click", clickHandler);
    };
  }

  attemptFullscreen() {
    if (this.fullscreenAttempted) return;
    
    this.fullscreenAttempted = true;
    
    // Método mejorado para solicitar fullscreen
    this.requestFullscreen()
      .then(() => {
        console.log("Fullscreen activado correctamente");
      })
      .catch((err) => {
        console.log("Fullscreen no disponible:", err.message);
        // Mostrar hint adicional si fullscreen no está disponible
        this.showFullscreenHint();
      });
  }

  async requestFullscreen() {
    // Verificar que no estemos ya en fullscreen
    if (document.fullscreenElement) {
      return Promise.resolve();
    }

    const element = document.documentElement;
    
    try {
      // Intentar con el método estándar primero
      if (element.requestFullscreen) {
        await element.requestFullscreen();
      } else if (element.webkitRequestFullscreen) {
        // Safari
        await element.webkitRequestFullscreen();
      } else if (element.mozRequestFullScreen) {
        // Firefox
        await element.mozRequestFullScreen();
      } else if (element.msRequestFullscreen) {
        // IE/Edge
        await element.msRequestFullscreen();
      } else {
        throw new Error("Fullscreen API no soportada");
      }
    } catch (error) {
      // Re-throw para manejar en attemptFullscreen
      throw error;
    }
  }

  showFullscreenHint() {
    const hint = this.container.querySelector(".esc-hint");
    if (hint) {
      hint.textContent = "Presiona F11 para pantalla completa - ESC o clic para salir";
      hint.style.animation = "pulse 2s infinite";
    }
  }

  async close() {
    if (!this.isActive) return;

    await this.releaseWakeLock();

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (document.webkitFullscreenElement) {
        await document.webkitExitFullscreen();
      } else if (document.mozFullScreenElement) {
        await document.mozCancelFullScreen();
      } else if (document.msFullscreenElement) {
        await document.msExitFullscreen();
      }
    } catch (err) {
      console.log("Exit fullscreen error:", err.message);
    }

    clearInterval(this.countdownInterval);
    this.cleanup?.();
    this.container?.remove();
    this.container = null;
    this.countdownInterval = null;
    this.cleanup = null;
    this.isActive = false;
    this.fullscreenAttempted = false;
  }
}

const screensaver = new CountdownScreensaver();

// Mantener compatibilidad con el popup (para el botón "Lanzar Protector")
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "ping") {
    sendResponse({ available: true });
  } else if (request.action === "launch_screensaver") {
    screensaver.launch(request.settings).then((success) => {
      sendResponse({ success });
    });
    return true;
  }
});