class CountdownScreensaver {
  constructor() {
    this.isActive = false;
    this.container = null;
    this.countdownInterval = null;
    this.cleanup = null;
    this.fontsLoaded = false;
    this.wakeLock = null;
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
      )}</div><div class="esc-hint">Presiona ESC o haz clic para salir</div></div>`;
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

    setTimeout(() => this.requestFullscreen(), 200);
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
      if (e.key === "Escape" && this.isActive) {
        e.preventDefault();
        e.stopPropagation();
        this.close();
      }
    };

    const clickHandler = (e) => {
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

  async requestFullscreen() {
    try {
      if (this.container?.requestFullscreen) {
        await this.container.requestFullscreen();
      }
    } catch (err) {
      console.log("Fullscreen not available:", err.message);
    }
  }

  async close() {
    if (!this.isActive) return;

    await this.releaseWakeLock();

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
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
  }
}

const screensaver = new CountdownScreensaver();

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