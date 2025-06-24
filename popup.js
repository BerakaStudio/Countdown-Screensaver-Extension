class CountdownPopup {
  constructor() {
    this.defaultSettings = {
      targetDate: "2025-12-31T23:59:59",
      fontSize: "small",
      fontFamily: "moderna",
      showLabels: true,
      showBlocks: true,
      darkMode: true,
    };
    this.currentSettings = { ...this.defaultSettings };
    this.elements = {};
    this.init();
  }
  async init() {
    this.bindElements();
    await this.loadSettings();
    this.setupEvents();
    this.updateUI();
  }
  bindElements() {
    const elementIds = [
      "target-date",
      "size-select",
      "font-select",
      "show-blocks",
      "show-labels",
      "dark-mode",
      "light-mode",
      "launch-screensaver",
    ];
    elementIds.forEach((id) => {
      this.elements[id.replace("-", "_")] = document.getElementById(id);
    });
  }
  async loadSettings() {
    try {
      const result = await chrome.storage.sync.get("countdownSettings");
      if (result.countdownSettings) {
        this.currentSettings = {
          ...this.defaultSettings,
          ...result.countdownSettings,
        };
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  }
  async saveSettings() {
    try {
      await chrome.storage.sync.set({
        countdownSettings: this.currentSettings,
      });
    } catch (error) {
      console.error("Error saving settings:", error);
    }
  }
  updateUI() {
    const { elements } = this;
    const settings = this.currentSettings;
    elements.target_date.value = settings.targetDate;
    elements.size_select.value = settings.fontSize;
    elements.font_select.value = settings.fontFamily;
    elements.show_blocks.checked = settings.showBlocks;
    elements.show_labels.checked = settings.showLabels;
    elements.dark_mode.classList.toggle("selected", settings.darkMode);
    elements.light_mode.classList.toggle("selected", !settings.darkMode);
  }
  async handleSettingChange(key, value) {
    this.currentSettings[key] = value;
    await this.saveSettings();
    this.updateUI();
  }
  async isContentScriptReady(tabId) {
    try {
      const response = await chrome.tabs.sendMessage(tabId, { action: "ping" });
      return response?.available || false;
    } catch {
      return false;
    }
  }
  async injectContentScript(tabId) {
    try {
      await chrome.scripting.insertCSS({
        target: { tabId },
        files: ["screensaver.css"],
      });
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["content.js"],
      });
      await new Promise((resolve) => setTimeout(resolve, 200));
      return true;
    } catch (error) {
      throw new Error(`No se pudo cargar el protector: ${error.message}`);
    }
  }
  async launchScreensaver() {
    const launchBtn = this.elements.launch_screensaver;
    try {
      launchBtn.disabled = true;
      launchBtn.textContent = "Cargando...";
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tab) {
        throw new Error("No se pudo obtener la pestaña activa");
      }
      const restrictedUrls = [
        "chrome://",
        "chrome-extension://",
        "edge://",
        "about:",
      ];
      if (restrictedUrls.some((url) => tab.url.startsWith(url))) {
        throw new Error("No se puede ejecutar en páginas del sistema");
      }
      const isReady = await this.isContentScriptReady(tab.id);
      if (!isReady) {
        await this.injectContentScript(tab.id);
      }
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: "launch_screensaver",
        settings: this.currentSettings,
      });
      if (response?.success) {
        window.close();
      } else {
        throw new Error("Error al iniciar el protector");
      }
    } catch (error) {
      alert(`Error: ${error.message}`);
    } finally {
      launchBtn.disabled = false;
      launchBtn.textContent = "Lanzar Protector";
    }
  }
  setupEvents() {
    const { elements } = this;
    const settingsMap = {
      target_date: "targetDate",
      size_select: "fontSize",
      font_select: "fontFamily",
    };
    Object.entries(settingsMap).forEach(([elementKey, settingKey]) => {
      elements[elementKey].addEventListener("change", (e) => {
        this.handleSettingChange(settingKey, e.target.value);
      });
    });
    elements.show_blocks.addEventListener("change", (e) => {
      this.handleSettingChange("showBlocks", e.target.checked);
    });
    elements.show_labels.addEventListener("change", (e) => {
      this.handleSettingChange("showLabels", e.target.checked);
    });
    elements.dark_mode.addEventListener("click", () => {
      this.handleSettingChange("darkMode", true);
    });
    elements.light_mode.addEventListener("click", () => {
      this.handleSettingChange("darkMode", false);
    });
    elements.launch_screensaver.addEventListener("click", () => {
      this.launchScreensaver();
    });
  }
}
document.addEventListener("DOMContentLoaded", () => {
  new CountdownPopup();
});