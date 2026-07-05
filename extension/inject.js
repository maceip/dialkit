// src/store/DialStore.ts
var EMPTY_VALUES = Object.freeze({});
var DialStoreClass = class {
  constructor() {
    this.panels = /* @__PURE__ */ new Map();
    this.panelsSnapshot = [];
    this.listeners = /* @__PURE__ */ new Map();
    this.globalListeners = /* @__PURE__ */ new Set();
    this.snapshots = /* @__PURE__ */ new Map();
    this.actionListeners = /* @__PURE__ */ new Map();
    this.presets = /* @__PURE__ */ new Map();
    this.activePreset = /* @__PURE__ */ new Map();
    this.baseValues = /* @__PURE__ */ new Map();
    this.defaultValues = /* @__PURE__ */ new Map();
    this.registrationCounts = /* @__PURE__ */ new Map();
    this.retainedPanels = /* @__PURE__ */ new Set();
    this.persistConfigs = /* @__PURE__ */ new Map();
    this.changeListeners = /* @__PURE__ */ new Set();
  }
  registerPanel(id, name, config, shortcuts, options = {}) {
    this.configurePanelRetention(id, options);
    this.registrationCounts.set(id, (this.registrationCounts.get(id) ?? 0) + 1);
    const controls = this.parseConfig(config, "", shortcuts);
    const controlsByPath = this.mapControlsByPath(controls);
    const defaultValues = this.flattenValues(config, "");
    this.initTransitionModes(config, "", defaultValues);
    const persisted = this.loadPersistedPanel(id);
    const previousValues = this.panels.get(id)?.values ?? this.snapshots.get(id) ?? persisted?.values ?? {};
    const values = this.reconcileValues(defaultValues, previousValues, controlsByPath);
    const previousBaseValues = this.baseValues.get(id) ?? persisted?.baseValues ?? persisted?.values ?? {};
    const baseValues = this.reconcileValues(defaultValues, previousBaseValues, controlsByPath);
    this.panels.set(id, {
      id,
      name,
      componentName: options.componentName ?? this.panels.get(id)?.componentName,
      controls,
      values,
      shortcuts: shortcuts ?? {}
    });
    this.snapshots.set(id, { ...values });
    this.baseValues.set(id, baseValues);
    this.defaultValues.set(id, { ...defaultValues });
    const existingPresets = this.presets.get(id) ?? persisted?.presets;
    if (existingPresets) {
      this.presets.set(id, this.reconcilePresets(existingPresets, defaultValues, controlsByPath));
    }
    if (!this.activePreset.has(id) && persisted?.activePresetId !== void 0) {
      this.activePreset.set(id, persisted.activePresetId);
    }
    this.persistPanel(id);
    this.notify(id);
    this.notifyGlobal();
  }
  updatePanel(id, name, config, shortcuts, options = {}) {
    this.configurePanelRetention(id, options);
    const existing = this.panels.get(id);
    if (!existing) {
      this.registerPanel(id, name, config, shortcuts, options);
      return;
    }
    const controls = this.parseConfig(config, "", shortcuts);
    const controlsByPath = this.mapControlsByPath(controls);
    const defaultValues = this.flattenValues(config, "");
    this.initTransitionModes(config, "", defaultValues);
    const nextValues = this.reconcileValues(defaultValues, existing.values, controlsByPath);
    const nextPanel = {
      id,
      name,
      componentName: options.componentName ?? existing.componentName,
      controls,
      values: nextValues,
      shortcuts: shortcuts ?? existing.shortcuts
    };
    this.panels.set(id, nextPanel);
    this.snapshots.set(id, { ...nextValues });
    const previousBaseValues = this.baseValues.get(id) ?? {};
    const nextBaseValues = this.reconcileValues(defaultValues, previousBaseValues, controlsByPath);
    for (const [path, value] of Object.entries(nextValues)) {
      if (path.endsWith(".__mode")) {
        nextBaseValues[path] = value;
      }
    }
    this.baseValues.set(id, nextBaseValues);
    this.defaultValues.set(id, { ...defaultValues });
    this.presets.set(id, this.reconcilePresets(this.presets.get(id) ?? [], defaultValues, controlsByPath));
    this.persistPanel(id);
    this.notify(id);
    this.notifyGlobal();
  }
  unregisterPanel(id) {
    const nextCount = (this.registrationCounts.get(id) ?? 1) - 1;
    if (nextCount > 0) {
      this.registrationCounts.set(id, nextCount);
      return;
    }
    this.registrationCounts.delete(id);
    this.panels.delete(id);
    this.listeners.delete(id);
    this.actionListeners.delete(id);
    if (!this.retainedPanels.has(id)) {
      this.snapshots.delete(id);
      this.baseValues.delete(id);
      this.defaultValues.delete(id);
      this.presets.delete(id);
      this.activePreset.delete(id);
      this.persistConfigs.delete(id);
    }
    this.notifyGlobal();
  }
  updateValue(panelId, path, value) {
    this.updateValues(panelId, { [path]: value });
  }
  updateValues(panelId, updates) {
    const panel = this.panels.get(panelId);
    if (!panel) return;
    const validUpdates = {};
    for (const [path, value] of Object.entries(updates)) {
      if (!Object.prototype.hasOwnProperty.call(panel.values, path)) {
        continue;
      }
      const control = this.findControlByPath(panel.controls, path);
      if (control?.type === "action") {
        continue;
      }
      panel.values[path] = value;
      validUpdates[path] = value;
    }
    if (Object.keys(validUpdates).length === 0) {
      return;
    }
    const activeId = this.activePreset.get(panelId);
    if (activeId) {
      const presets = this.presets.get(panelId) ?? [];
      const preset = presets.find((p) => p.id === activeId);
      if (preset) {
        for (const [path, value] of Object.entries(validUpdates)) {
          preset.values[path] = value;
        }
      }
    } else {
      const base = this.baseValues.get(panelId);
      if (base) {
        for (const [path, value] of Object.entries(validUpdates)) {
          base[path] = value;
        }
      }
    }
    this.snapshots.set(panelId, { ...panel.values });
    this.persistPanel(panelId);
    for (const [path, value] of Object.entries(validUpdates)) {
      this.changeListeners.forEach((fn) => fn({ panelId, path, value }));
    }
    this.notify(panelId);
  }
  subscribeChanges(listener) {
    this.changeListeners.add(listener);
    return () => this.changeListeners.delete(listener);
  }
  resetValues(panelId) {
    const panel = this.panels.get(panelId);
    const defaults = this.defaultValues.get(panelId);
    if (!panel || !defaults) return;
    panel.values = { ...defaults };
    this.snapshots.set(panelId, { ...panel.values });
    this.baseValues.set(panelId, { ...defaults });
    this.activePreset.set(panelId, null);
    this.persistPanel(panelId);
    this.notify(panelId);
  }
  updateSpringMode(panelId, path, mode) {
    this.updateTransitionMode(panelId, path, mode);
  }
  getSpringMode(panelId, path) {
    const mode = this.getTransitionMode(panelId, path);
    if (mode === "easing") return "simple";
    return mode;
  }
  updateTransitionMode(panelId, path, mode) {
    const panel = this.panels.get(panelId);
    if (!panel) return;
    panel.values[`${path}.__mode`] = mode;
    this.snapshots.set(panelId, { ...panel.values });
    this.persistPanel(panelId);
    this.notify(panelId);
  }
  getTransitionMode(panelId, path) {
    const panel = this.panels.get(panelId);
    if (!panel) return "simple";
    return panel.values[`${path}.__mode`] || "simple";
  }
  getValue(panelId, path) {
    const panel = this.panels.get(panelId);
    return panel?.values[path];
  }
  getValues(panelId) {
    return this.snapshots.get(panelId) ?? EMPTY_VALUES;
  }
  getPanels() {
    return this.panelsSnapshot;
  }
  getPanel(id) {
    return this.panels.get(id);
  }
  subscribe(panelId, listener) {
    if (!this.listeners.has(panelId)) {
      this.listeners.set(panelId, /* @__PURE__ */ new Set());
    }
    this.listeners.get(panelId).add(listener);
    return () => {
      this.listeners.get(panelId)?.delete(listener);
    };
  }
  subscribeGlobal(listener) {
    this.globalListeners.add(listener);
    return () => this.globalListeners.delete(listener);
  }
  subscribeActions(panelId, listener) {
    if (!this.actionListeners.has(panelId)) {
      this.actionListeners.set(panelId, /* @__PURE__ */ new Set());
    }
    this.actionListeners.get(panelId).add(listener);
    return () => {
      this.actionListeners.get(panelId)?.delete(listener);
    };
  }
  triggerAction(panelId, path) {
    this.actionListeners.get(panelId)?.forEach((fn) => fn(path));
  }
  savePreset(panelId, name) {
    const panel = this.panels.get(panelId);
    if (!panel) throw new Error(`Panel ${panelId} not found`);
    const id = `preset-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const preset = {
      id,
      name,
      values: { ...panel.values }
    };
    const existing = this.presets.get(panelId) ?? [];
    this.presets.set(panelId, [...existing, preset]);
    this.activePreset.set(panelId, id);
    this.snapshots.set(panelId, { ...panel.values });
    this.persistPanel(panelId);
    this.notify(panelId);
    return id;
  }
  loadPreset(panelId, presetId) {
    const panel = this.panels.get(panelId);
    if (!panel) return;
    const presets = this.presets.get(panelId) ?? [];
    const preset = presets.find((p) => p.id === presetId);
    if (!preset) return;
    panel.values = { ...preset.values };
    this.snapshots.set(panelId, { ...panel.values });
    this.activePreset.set(panelId, presetId);
    this.persistPanel(panelId);
    this.notify(panelId);
  }
  deletePreset(panelId, presetId) {
    const presets = this.presets.get(panelId) ?? [];
    this.presets.set(panelId, presets.filter((p) => p.id !== presetId));
    if (this.activePreset.get(panelId) === presetId) {
      this.activePreset.set(panelId, null);
    }
    const panel = this.panels.get(panelId);
    if (panel) {
      this.snapshots.set(panelId, { ...panel.values });
    }
    this.persistPanel(panelId);
    this.notify(panelId);
  }
  getPresets(panelId) {
    return this.presets.get(panelId) ?? [];
  }
  getActivePresetId(panelId) {
    return this.activePreset.get(panelId) ?? null;
  }
  clearActivePreset(panelId) {
    const panel = this.panels.get(panelId);
    const base = this.baseValues.get(panelId);
    if (panel && base) {
      panel.values = { ...base };
      this.snapshots.set(panelId, { ...panel.values });
    }
    this.activePreset.set(panelId, null);
    this.persistPanel(panelId);
    this.notify(panelId);
  }
  resolveShortcutTarget(key, modifier) {
    for (const panel of this.panels.values()) {
      for (const [path, shortcut] of Object.entries(panel.shortcuts)) {
        if (!shortcut.key) continue;
        if (shortcut.key.toLowerCase() !== key.toLowerCase()) continue;
        const scMod = shortcut.modifier ?? void 0;
        if (scMod !== modifier) continue;
        const control = this.findControlByPath(panel.controls, path);
        if (control) {
          return { panelId: panel.id, path, control };
        }
      }
    }
    return null;
  }
  resolveScrollOnlyTargets() {
    const results = [];
    for (const panel of this.panels.values()) {
      for (const [path, shortcut] of Object.entries(panel.shortcuts)) {
        if ((shortcut.interaction ?? "scroll") !== "scroll-only") continue;
        const control = this.findControlByPath(panel.controls, path);
        if (control) {
          results.push({ panelId: panel.id, path, control, shortcut });
        }
      }
    }
    return results;
  }
  configurePanelRetention(id, options) {
    if (options.retainOnUnmount) {
      this.retainedPanels.add(id);
    }
    const persistConfig = this.normalizePersistConfig(id, options.persist);
    if (persistConfig) {
      this.persistConfigs.set(id, persistConfig);
      this.retainedPanels.add(id);
    }
  }
  reconcileValues(defaultValues, previousValues, controlsByPath) {
    const nextValues = {};
    for (const [path, defaultValue] of Object.entries(defaultValues)) {
      if (path.endsWith(".__mode")) {
        const transitionPath = path.slice(0, -".__mode".length);
        const transitionControl = controlsByPath.get(transitionPath);
        nextValues[path] = transitionControl?.type === "transition" && previousValues[path] !== void 0 ? previousValues[path] : defaultValue;
        continue;
      }
      nextValues[path] = this.normalizePreservedValue(
        previousValues[path],
        defaultValue,
        controlsByPath.get(path)
      );
    }
    return nextValues;
  }
  reconcilePresets(presets, defaultValues, controlsByPath) {
    return presets.map((preset) => ({
      ...preset,
      values: this.reconcileValues(defaultValues, preset.values, controlsByPath)
    }));
  }
  normalizePersistConfig(id, persist) {
    if (!persist) return null;
    const options = typeof persist === "object" ? persist : {};
    return {
      key: options.key ?? `dialkit:${id}`,
      storage: options.storage ?? "localStorage",
      presets: options.presets ?? true
    };
  }
  loadPersistedPanel(id) {
    const config = this.persistConfigs.get(id);
    if (!config) return null;
    const storage = this.getStorage(config.storage);
    if (!storage) return null;
    try {
      const raw = storage.getItem(config.key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed?.version !== 1 || typeof parsed !== "object") return null;
      return parsed;
    } catch {
      return null;
    }
  }
  persistPanel(id) {
    const config = this.persistConfigs.get(id);
    if (!config) return;
    const storage = this.getStorage(config.storage);
    if (!storage) return;
    const values = this.snapshots.get(id) ?? this.panels.get(id)?.values;
    if (!values) return;
    const state = {
      version: 1,
      values,
      baseValues: this.baseValues.get(id) ?? values,
      activePresetId: this.activePreset.get(id) ?? null
    };
    if (config.presets) {
      state.presets = this.presets.get(id) ?? [];
    }
    try {
      storage.setItem(config.key, JSON.stringify(state));
    } catch {
    }
  }
  getStorage(kind) {
    if (typeof globalThis === "undefined" || !("window" in globalThis)) {
      return null;
    }
    try {
      return kind === "sessionStorage" ? globalThis.window?.sessionStorage ?? null : globalThis.window?.localStorage ?? null;
    } catch {
      return null;
    }
  }
  findControlByPath(controls, path) {
    for (const control of controls) {
      if (control.path === path) return control;
      if (control.type === "folder" && control.children) {
        const found = this.findControlByPath(control.children, path);
        if (found) return found;
      }
    }
    return null;
  }
  notify(panelId) {
    this.listeners.get(panelId)?.forEach((fn) => fn());
  }
  notifyGlobal() {
    this.panelsSnapshot = Array.from(this.panels.values());
    this.globalListeners.forEach((fn) => fn());
  }
  initTransitionModes(config, prefix, values) {
    for (const [key, value] of Object.entries(config)) {
      if (key === "_collapsed") continue;
      const path = prefix ? `${prefix}.${key}` : key;
      if (this.isEasingConfig(value)) {
        values[`${path}.__mode`] = "easing";
      } else if (this.isSpringConfig(value)) {
        const hasPhysics = value.stiffness !== void 0 || value.damping !== void 0 || value.mass !== void 0;
        const hasTime = value.visualDuration !== void 0 || value.bounce !== void 0;
        values[`${path}.__mode`] = hasPhysics && !hasTime ? "advanced" : "simple";
      } else if (typeof value === "object" && value !== null && !Array.isArray(value) && !this.isActionConfig(value) && !this.isSelectConfig(value) && !this.isColorConfig(value) && !this.isTextConfig(value)) {
        this.initTransitionModes(value, path, values);
      }
    }
  }
  parseConfig(config, prefix, shortcuts) {
    const controls = [];
    for (const [key, value] of Object.entries(config)) {
      if (key === "_collapsed") continue;
      const path = prefix ? `${prefix}.${key}` : key;
      const label = this.formatLabel(key);
      const shortcut = shortcuts?.[path];
      if (Array.isArray(value) && value.length <= 4 && typeof value[0] === "number") {
        controls.push({
          type: "slider",
          path,
          label,
          min: value[1],
          max: value[2],
          step: value[3] ?? this.inferStep(value[1], value[2]),
          shortcut
        });
      } else if (typeof value === "number") {
        const { min, max, step } = this.inferRange(value);
        controls.push({ type: "slider", path, label, min, max, step, shortcut });
      } else if (typeof value === "boolean") {
        controls.push({ type: "toggle", path, label, shortcut });
      } else if (this.isSpringConfig(value) || this.isEasingConfig(value)) {
        controls.push({ type: "transition", path, label });
      } else if (this.isActionConfig(value)) {
        controls.push({ type: "action", path, label: value.label || label });
      } else if (this.isSelectConfig(value)) {
        controls.push({ type: "select", path, label, options: value.options });
      } else if (this.isColorConfig(value)) {
        controls.push({ type: "color", path, label });
      } else if (this.isTextConfig(value)) {
        controls.push({ type: "text", path, label, placeholder: value.placeholder });
      } else if (typeof value === "string") {
        if (this.isHexColor(value)) {
          controls.push({ type: "color", path, label });
        } else {
          controls.push({ type: "text", path, label });
        }
      } else if (typeof value === "object" && value !== null) {
        const folderConfig = value;
        const defaultOpen = "_collapsed" in folderConfig ? !folderConfig._collapsed : true;
        controls.push({
          type: "folder",
          path,
          label,
          defaultOpen,
          children: this.parseConfig(folderConfig, path, shortcuts)
        });
      }
    }
    return controls;
  }
  flattenValues(config, prefix) {
    const values = {};
    for (const [key, value] of Object.entries(config)) {
      if (key === "_collapsed") continue;
      const path = prefix ? `${prefix}.${key}` : key;
      if (Array.isArray(value) && value.length <= 4 && typeof value[0] === "number") {
        values[path] = value[0];
      } else if (typeof value === "number" || typeof value === "boolean" || typeof value === "string") {
        values[path] = value;
      } else if (this.isSpringConfig(value) || this.isEasingConfig(value)) {
        values[path] = value;
      } else if (this.isActionConfig(value)) {
        values[path] = value;
      } else if (this.isSelectConfig(value)) {
        const firstOption = value.options[0];
        const firstValue = typeof firstOption === "string" ? firstOption : firstOption.value;
        values[path] = value.default ?? firstValue;
      } else if (this.isColorConfig(value)) {
        values[path] = value.default ?? "#000000";
      } else if (this.isTextConfig(value)) {
        values[path] = value.default ?? "";
      } else if (typeof value === "object" && value !== null) {
        Object.assign(values, this.flattenValues(value, path));
      }
    }
    return values;
  }
  isSpringConfig(value) {
    return typeof value === "object" && value !== null && "type" in value && value.type === "spring";
  }
  isEasingConfig(value) {
    return typeof value === "object" && value !== null && "type" in value && value.type === "easing";
  }
  isActionConfig(value) {
    return typeof value === "object" && value !== null && "type" in value && value.type === "action";
  }
  isSelectConfig(value) {
    return typeof value === "object" && value !== null && "type" in value && value.type === "select" && "options" in value && Array.isArray(value.options);
  }
  isColorConfig(value) {
    return typeof value === "object" && value !== null && "type" in value && value.type === "color";
  }
  isTextConfig(value) {
    return typeof value === "object" && value !== null && "type" in value && value.type === "text";
  }
  isHexColor(value) {
    return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/.test(value);
  }
  formatLabel(key) {
    return key.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase()).trim();
  }
  inferRange(value) {
    if (value >= 0 && value <= 1) {
      return { min: 0, max: 1, step: 0.01 };
    } else if (value >= 0 && value <= 10) {
      return { min: 0, max: value * 3 || 10, step: 0.1 };
    } else if (value >= 0 && value <= 100) {
      return { min: 0, max: value * 3 || 100, step: 1 };
    } else if (value >= 0) {
      return { min: 0, max: value * 3 || 1e3, step: 10 };
    } else {
      return { min: value * 3, max: -value * 3, step: 1 };
    }
  }
  inferStep(min, max) {
    const range = max - min;
    if (range <= 1) return 0.01;
    if (range <= 10) return 0.1;
    if (range <= 100) return 1;
    return 10;
  }
  normalizePreservedValue(existingValue, defaultValue, control) {
    if (existingValue === void 0 || !control) {
      return defaultValue;
    }
    switch (control.type) {
      case "slider": {
        if (typeof existingValue !== "number" || typeof defaultValue !== "number") {
          return defaultValue;
        }
        const min = control.min ?? Number.NEGATIVE_INFINITY;
        const max = control.max ?? Number.POSITIVE_INFINITY;
        const clamped = Math.min(max, Math.max(min, existingValue));
        if (typeof control.step !== "number" || control.step <= 0) {
          return clamped;
        }
        return this.roundToStep(clamped, min, max, control.step);
      }
      case "toggle":
        return typeof existingValue === "boolean" ? existingValue : defaultValue;
      case "select": {
        if (typeof existingValue !== "string") {
          return defaultValue;
        }
        const options = control.options ?? [];
        const validValues = new Set(options.map((option) => typeof option === "string" ? option : option.value));
        return validValues.has(existingValue) ? existingValue : defaultValue;
      }
      case "color":
      case "text":
        return typeof existingValue === "string" ? existingValue : defaultValue;
      case "transition":
        if (this.isSpringConfig(defaultValue)) {
          return this.isSpringConfig(existingValue) ? existingValue : defaultValue;
        }
        if (this.isEasingConfig(defaultValue)) {
          return this.isEasingConfig(existingValue) ? existingValue : defaultValue;
        }
        return defaultValue;
      case "action":
        return defaultValue;
      default:
        return defaultValue;
    }
  }
  roundToStep(value, min, max, step) {
    const snapped = min + Math.round((value - min) / step) * step;
    const clamped = Math.min(max, Math.max(min, snapped));
    const precision = this.stepPrecision(step);
    return Number(clamped.toFixed(precision));
  }
  stepPrecision(step) {
    const text = String(step);
    const decimalIndex = text.indexOf(".");
    return decimalIndex === -1 ? 0 : text.length - decimalIndex - 1;
  }
  mapControlsByPath(controls) {
    const map = /* @__PURE__ */ new Map();
    const visit = (nodes) => {
      for (const node of nodes) {
        if (node.type === "folder" && node.children) {
          visit(node.children);
          continue;
        }
        map.set(node.path, node);
      }
    };
    visit(controls);
    return map;
  }
};
var DialStore = new DialStoreClass();

// src/dev-session/panel-link.ts
function normalizeName(value) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}
function namesMatch(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  return a.includes(b) || b.includes(a);
}
function matchPanelForTarget(target, panels) {
  if (!target || panels.length === 0) return null;
  const stackNames = (target.reactStack ?? []).map(normalizeName);
  const innermost = stackNames[stackNames.length - 1];
  for (const panel of panels) {
    const candidates = [
      normalizeName(panel.name),
      normalizeName(panel.id),
      panel.componentName ? normalizeName(panel.componentName) : ""
    ].filter(Boolean);
    for (const candidate of candidates) {
      if (stackNames.some((name) => namesMatch(name, candidate))) {
        return panel;
      }
    }
  }
  if (innermost) {
    for (const panel of panels) {
      const candidate = normalizeName(panel.name);
      if (namesMatch(innermost, candidate)) return panel;
    }
  }
  return panels.length === 1 ? panels[0] : null;
}

// src/store/DevSessionStore.ts
var STORAGE_VERSION = 1;
function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
function storageKey(projectKey) {
  return `dialkit:dev-session:v${STORAGE_VERSION}:${projectKey}`;
}
var DevSessionStoreImpl = class {
  constructor() {
    this.projectKey = "default";
    this.enabled = false;
    this.notes = [];
    this.changes = [];
    this.cssOverrides = [];
    this.notesSnapshot = [];
    this.pendingChangesSnapshot = [];
    this.pendingCssSnapshot = [];
    this.listeners = /* @__PURE__ */ new Set();
    this.unsubscribeDial = null;
  }
  configure(projectKey = "default") {
    if (this.projectKey === projectKey && this.enabled) return;
    this.projectKey = projectKey;
    this.load();
    this.enable();
  }
  enable() {
    if (this.enabled) return;
    this.enabled = true;
    this.unsubscribeDial?.();
    this.unsubscribeDial = DialStore.subscribeChanges((event) => {
      const panel = DialStore.getPanels().find((p) => p.id === event.panelId);
      const control = panel?.controls.find((c) => c.path === event.path) ?? this.findControl(panel?.controls ?? [], event.path);
      this.logChange({
        panelId: event.panelId,
        panelName: panel?.name ?? event.panelId,
        path: event.path,
        label: control?.label ?? event.path,
        value: event.value
      });
    });
    this.notify();
  }
  disable() {
    this.enabled = false;
    this.unsubscribeDial?.();
    this.unsubscribeDial = null;
  }
  isEnabled() {
    return this.enabled;
  }
  getProjectKey() {
    return this.projectKey;
  }
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  getNotes() {
    return this.notesSnapshot;
  }
  getOpenNotes() {
    return this.notesSnapshot.filter((n) => n.status === "open" && !n.exportedAt);
  }
  getChanges() {
    return [...this.changes].sort((a, b) => b.at.localeCompare(a.at));
  }
  getPendingChanges() {
    return this.pendingChangesSnapshot;
  }
  getCssOverrides() {
    return [...this.cssOverrides].sort((a, b) => b.at.localeCompare(a.at));
  }
  getPendingCssOverrides() {
    return this.pendingCssSnapshot;
  }
  addNote(input) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const panels = DialStore.getPanels();
    const matched = !input.panelId && input.target ? matchPanelForTarget(input.target, panels) : null;
    const panelId = input.panelId ?? matched?.id;
    const panelName = input.panelName ?? matched?.name;
    const note = {
      id: uid(),
      createdAt: now,
      updatedAt: now,
      comment: input.comment.trim(),
      status: "open",
      pagePath: typeof location !== "undefined" ? location.pathname : "",
      pageUrl: typeof location !== "undefined" ? location.href : "",
      selector: input.target?.selector,
      element: input.target?.element,
      reactComponent: input.target?.reactComponent ?? null,
      reactStack: input.target?.reactStack,
      panelId,
      panelName,
      dialSnapshot: input.dialSnapshot ?? (panelId ? DialStore.getValues(panelId) : void 0),
      exportedAt: null
    };
    this.notes.unshift(note);
    this.save();
    this.notify();
    return note;
  }
  updateNote(id, patch) {
    const note = this.notes.find((n) => n.id === id);
    if (!note) return;
    if (patch.comment !== void 0) note.comment = patch.comment.trim();
    if (patch.status !== void 0) note.status = patch.status;
    note.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    this.save();
    this.notify();
  }
  deleteNote(id) {
    this.notes = this.notes.filter((n) => n.id !== id);
    this.save();
    this.notify();
  }
  logCssOverride(input) {
    const entry = {
      id: uid(),
      at: (/* @__PURE__ */ new Date()).toISOString(),
      selector: input.selector,
      element: input.element,
      property: input.property,
      value: input.value,
      previousValue: input.previousValue,
      reactComponent: input.target?.reactComponent ?? null,
      exportedAt: null
    };
    this.cssOverrides.unshift(entry);
    if (this.cssOverrides.length > 500) this.cssOverrides.length = 500;
    this.save();
    this.notify();
    return entry;
  }
  clearExported() {
    this.notes = this.notes.filter((n) => n.status === "open" && !n.exportedAt);
    this.changes = this.changes.filter((c) => !c.exportedAt);
    this.cssOverrides = this.cssOverrides.filter((c) => !c.exportedAt);
    this.save();
    this.notify();
  }
  resetSession() {
    this.notes = [];
    this.changes = [];
    this.cssOverrides = [];
    this.save();
    this.notify();
  }
  buildAgentReport(options) {
    const includeDone = options?.includeDoneNotes ?? false;
    const notes = this.getNotes().filter((n) => !n.exportedAt && (includeDone || n.status === "open"));
    const changes = this.getPendingChanges();
    const cssOverrides = this.getPendingCssOverrides();
    const panels = DialStore.getPanels();
    const lines = ["# DialKit dev session", ""];
    lines.push(`**Project:** ${this.projectKey}`);
    lines.push(`**Page:** ${typeof location !== "undefined" ? location.href : ""}`);
    lines.push(`**Generated:** ${(/* @__PURE__ */ new Date()).toISOString()}`);
    lines.push("");
    if (notes.length) {
      lines.push("## Notes");
      lines.push("");
      for (const note of notes) {
        lines.push(`### ${note.reactComponent ?? note.element ?? "UI note"} (${note.status})`);
        if (note.selector) lines.push(`- **Selector:** \`${note.selector}\``);
        if (note.reactComponent) lines.push(`- **React:** \`${note.reactComponent}\``);
        if (note.reactStack?.length) {
          lines.push(`- **Stack:** ${note.reactStack.map((n) => `\`${n}\``).join(" \u2192 ")}`);
        }
        if (note.panelName) lines.push(`- **Dial panel:** ${note.panelName}`);
        lines.push("");
        lines.push(note.comment || "(no comment)");
        lines.push("");
      }
    }
    if (cssOverrides.length) {
      lines.push("## CSS overrides");
      lines.push("");
      const bySelector = /* @__PURE__ */ new Map();
      for (const override of cssOverrides) {
        const list = bySelector.get(override.selector) ?? [];
        list.push(override);
        bySelector.set(override.selector, list);
      }
      for (const [selector, overrides] of bySelector) {
        lines.push(`### \`${selector}\``);
        const latestByProperty = /* @__PURE__ */ new Map();
        for (const o of overrides) latestByProperty.set(o.property, o);
        for (const o of latestByProperty.values()) {
          lines.push(`- **${o.property}:** \`${o.value}\` (was \`${o.previousValue || "unset"}\`)`);
        }
        lines.push("");
      }
    }
    if (changes.length) {
      lines.push("## Parameter changes");
      lines.push("");
      const byPanel = /* @__PURE__ */ new Map();
      for (const change of changes) {
        const list = byPanel.get(change.panelName) ?? [];
        list.push(change);
        byPanel.set(change.panelName, list);
      }
      for (const [panelName, panelChanges] of byPanel) {
        lines.push(`### ${panelName}`);
        const latestByPath = /* @__PURE__ */ new Map();
        for (const c of panelChanges) latestByPath.set(c.path, c);
        for (const c of latestByPath.values()) {
          lines.push(`- **${c.label}** (\`${c.path}\`): \`${JSON.stringify(c.value)}\``);
        }
        lines.push("");
      }
    }
    if (panels.length) {
      lines.push("## Current dial values");
      lines.push("");
      for (const panel of panels) {
        const values = DialStore.getValues(panel.id);
        lines.push(`### ${panel.name}`);
        lines.push("```json");
        lines.push(JSON.stringify(values, null, 2));
        lines.push("```");
        lines.push("");
      }
    }
    if (!notes.length && !changes.length && !cssOverrides.length) {
      lines.push("_No pending notes, CSS overrides, or parameter changes._");
    }
    return lines.join("\n");
  }
  async copyAgentReport() {
    const report = this.buildAgentReport();
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(report);
      this.markExported();
      return true;
    }
    return false;
  }
  markExported() {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    for (const note of this.notes) {
      if (note.status === "open" && !note.exportedAt) note.exportedAt = now;
    }
    for (const change of this.changes) {
      if (!change.exportedAt) change.exportedAt = now;
    }
    for (const override of this.cssOverrides) {
      if (!override.exportedAt) override.exportedAt = now;
    }
    this.save();
    this.notify();
  }
  logChange(input) {
    if (!this.enabled) return;
    const entry = {
      id: uid(),
      at: (/* @__PURE__ */ new Date()).toISOString(),
      exportedAt: null,
      ...input
    };
    this.changes.unshift(entry);
    if (this.changes.length > 500) this.changes.length = 500;
    this.save();
    this.notify();
  }
  findControl(controls, path) {
    for (const c of controls) {
      if (c.path === path) return c;
      if (c.children) {
        const found = this.findControl(c.children, path);
        if (found) return found;
      }
    }
    return null;
  }
  load() {
    const storage = this.getStorage();
    if (!storage) {
      this.notes = [];
      this.changes = [];
      this.cssOverrides = [];
      this.rebuildSnapshots();
      return;
    }
    try {
      const raw = storage.getItem(storageKey(this.projectKey));
      if (!raw) {
        this.notes = [];
        this.changes = [];
        this.cssOverrides = [];
        this.rebuildSnapshots();
        return;
      }
      const parsed = JSON.parse(raw);
      if (parsed?.version !== STORAGE_VERSION) {
        this.notes = [];
        this.changes = [];
        this.cssOverrides = [];
        this.rebuildSnapshots();
        return;
      }
      this.notes = Array.isArray(parsed.notes) ? parsed.notes : [];
      this.changes = Array.isArray(parsed.changes) ? parsed.changes : [];
      this.cssOverrides = Array.isArray(parsed.cssOverrides) ? parsed.cssOverrides : [];
    } catch {
      this.notes = [];
      this.changes = [];
      this.cssOverrides = [];
    }
    this.rebuildSnapshots();
  }
  save() {
    const storage = this.getStorage();
    if (!storage) return;
    const state = {
      version: STORAGE_VERSION,
      projectKey: this.projectKey,
      notes: this.notes,
      changes: this.changes,
      cssOverrides: this.cssOverrides
    };
    try {
      storage.setItem(storageKey(this.projectKey), JSON.stringify(state));
    } catch {
    }
  }
  getStorage() {
    if (typeof globalThis === "undefined" || !("window" in globalThis)) return null;
    try {
      return globalThis.window?.localStorage ?? null;
    } catch {
      return null;
    }
  }
  notify() {
    this.rebuildSnapshots();
    this.listeners.forEach((fn) => fn());
  }
  rebuildSnapshots() {
    this.notesSnapshot = [...this.notes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    this.pendingChangesSnapshot = [...this.changes].filter((c) => !c.exportedAt).sort((a, b) => b.at.localeCompare(a.at));
    this.pendingCssSnapshot = [...this.cssOverrides].filter((c) => !c.exportedAt).sort((a, b) => b.at.localeCompare(a.at));
  }
};
var DevSessionStore = new DevSessionStoreImpl();

// src/utils/dom-inspect.ts
function cssEscape(value) {
  if (typeof CSS !== "undefined" && CSS.escape) return CSS.escape(value);
  return value.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}
function getReactFiber(el) {
  if (!el || el.nodeType !== 1) return null;
  const keys = Object.keys(el);
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    if (k.indexOf("__reactFiber$") === 0 || k.indexOf("__reactInternalInstance$") === 0) {
      return el[k];
    }
  }
  return null;
}
function getVueComponent(el) {
  if (!el || el.nodeType !== 1) return null;
  return el.__vueParentComponent ?? el.__vue__ ?? null;
}
function getSvelteComponent(el) {
  if (!el || el.nodeType !== 1) return null;
  const keys = Object.keys(el);
  for (const k of keys) {
    if (k.startsWith("__svelte")) return el[k];
  }
  return null;
}
function fiberComponentName(fiber) {
  let cur = fiber;
  let depth = 0;
  while (cur && depth < 40) {
    if (cur.type) {
      if (typeof cur.type === "function") {
        return cur.type.displayName || cur.type.name || "Anonymous";
      }
      if (typeof cur.type === "object" && cur.type.displayName) {
        return cur.type.displayName;
      }
    }
    if (cur.elementType && typeof cur.elementType === "function") {
      return cur.elementType.displayName || cur.elementType.name || "Anonymous";
    }
    cur = cur.return;
    depth++;
  }
  return null;
}
function fiberStack(fiber) {
  const names = [];
  let cur = fiber;
  let depth = 0;
  while (cur && depth < 12) {
    const name = fiberComponentName(cur);
    if (name && names[names.length - 1] !== name) names.push(name);
    cur = cur.return;
    depth++;
  }
  return names.reverse();
}
function vueStack(component) {
  const names = [];
  let cur = component;
  let depth = 0;
  while (cur && depth < 12) {
    const name = cur.type?.name || cur.type?.__name || cur.type?.displayName;
    if (name && names[names.length - 1] !== name) names.push(name);
    cur = cur.parent;
    depth++;
  }
  return names.reverse();
}
function svelteStack(component) {
  const names = [];
  if (component?.function?.name) names.push(component.function.name);
  return names;
}
function detectComponentStack(el) {
  const fiber = getReactFiber(el);
  if (fiber) {
    return { stack: fiberStack(fiber), framework: "react" };
  }
  const vue = getVueComponent(el);
  if (vue) {
    return { stack: vueStack(vue), framework: "vue" };
  }
  const svelte = getSvelteComponent(el);
  if (svelte) {
    return { stack: svelteStack(svelte), framework: "svelte" };
  }
  return { stack: [], framework: null };
}
function cssPath(el) {
  if (!el || el.nodeType !== 1) return "";
  if (el.id) return `#${cssEscape(el.id)}`;
  const parts = [];
  let node = el;
  while (node && node.nodeType === 1 && node !== document.documentElement) {
    let part = node.tagName.toLowerCase();
    if (node.id) {
      parts.unshift(`#${cssEscape(node.id)}`);
      break;
    }
    const className = (node.className || "").toString().trim().split(/\s+/).filter(Boolean).slice(0, 2);
    if (className.length) {
      part += className.map((c) => `.${cssEscape(c)}`).join("");
    }
    const parent = node.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        (child) => child instanceof Element && child.tagName === node.tagName
      );
      if (siblings.length > 1) {
        part += `:nth-of-type(${siblings.indexOf(node) + 1})`;
      }
    }
    parts.unshift(part);
    node = parent;
  }
  return parts.join(" > ");
}
function elementLabel(el) {
  const tag = el.tagName ? el.tagName.toLowerCase() : "node";
  const id = el.id ? `#${el.id}` : "";
  const cls = (el.className || "").toString().trim().split(/\s+/).filter(Boolean).slice(0, 2);
  const classPart = cls.length ? `.${cls.join(".")}` : "";
  const text = (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80);
  return tag + id + classPart + (text ? ` "${text}"` : "");
}
function inspectElement(el) {
  if (!el || el.nodeType !== 1) return null;
  const { stack, framework } = detectComponentStack(el);
  const r = el.getBoundingClientRect();
  return {
    url: location.href,
    pathname: location.pathname,
    selector: cssPath(el),
    element: elementLabel(el),
    reactComponent: stack.length ? stack[stack.length - 1] : null,
    reactStack: stack,
    framework,
    rect: {
      x: Math.round(r.x),
      y: Math.round(r.y),
      width: Math.round(r.width),
      height: Math.round(r.height)
    }
  };
}

// src/dev-session/css-inspector.ts
var CSS_INSPECTOR_PROPERTIES = [
  { key: "color", label: "Color", type: "color" },
  { key: "background-color", label: "Background", type: "color" },
  { key: "border-color", label: "Border color", type: "color" },
  { key: "border-width", label: "Border width", type: "length" },
  { key: "border-radius", label: "Radius", type: "length" },
  { key: "opacity", label: "Opacity", type: "number" },
  { key: "padding", label: "Padding", type: "length" },
  { key: "margin", label: "Margin", type: "length" },
  { key: "width", label: "Width", type: "length" },
  { key: "height", label: "Height", type: "length" },
  { key: "font-size", label: "Font size", type: "length" },
  { key: "font-weight", label: "Weight", type: "select", options: ["300", "400", "500", "600", "700", "800"] },
  { key: "box-shadow", label: "Shadow", type: "text" },
  { key: "transform", label: "Transform", type: "text" },
  { key: "filter", label: "Filter", type: "text" },
  { key: "stroke", label: "Stroke", type: "color" },
  { key: "stroke-width", label: "Stroke width", type: "length" },
  { key: "fill", label: "Fill", type: "color" }
];
var OVERRIDE_ATTR = "data-dialkit-css-override";
function readCssValues(el, defs = CSS_INSPECTOR_PROPERTIES) {
  const computed = getComputedStyle(el);
  const values = {};
  for (const def of defs) {
    if (def.key === "stroke" || def.key === "stroke-width" || def.key === "fill") {
      if (el instanceof SVGElement || el.ownerSVGElement) {
        values[def.key] = el.style.getPropertyValue(def.key) || computed.getPropertyValue(def.key) || "";
      }
      continue;
    }
    values[def.key] = el.style.getPropertyValue(def.key) || computed.getPropertyValue(def.key) || "";
  }
  return values;
}
function applyCssOverride(el, property, value) {
  const previous = el.style.getPropertyValue(property);
  if (property === "stroke" || property === "fill" || property === "stroke-width") {
    el.style.setProperty(property, value);
  } else {
    el.style.setProperty(property, value);
  }
  el.setAttribute(OVERRIDE_ATTR, "true");
  return previous;
}

// src/dev-session/dev-session-host.ts
var activeHost = null;
var DevSessionHost = class {
  constructor(options = {}) {
    this.listeners = /* @__PURE__ */ new Set();
    this.targetEl = null;
    this.targetInfo = null;
    this.cssTarget = null;
    this.cssValues = {};
    this.menuPos = { x: 0, y: 0 };
    this.noteText = "";
    this.unsubStore = null;
    this.onContextMenu = (e) => {
      const el = e.target;
      if (!el || el.closest(".dialkit-root, .dialkit-dev-host")) return;
      e.preventDefault();
      e.stopPropagation();
      this.setTarget(el);
      this.menuPos = { x: e.clientX, y: e.clientY };
      this.positionFloating(this.contextMenu, e.clientX, e.clientY);
      this.contextMenu.hidden = false;
      this.noteComposer.hidden = true;
      this.cssPanel.hidden = true;
    };
    this.onDocumentClick = (e) => {
      const t = e.target;
      if (!t) return;
      if (this.contextMenu.contains(t) || this.noteComposer.contains(t) || this.cssPanel.contains(t)) {
        return;
      }
      this.hideAll();
    };
    this.onKeyDown = (e) => {
      if (e.key !== "Escape") return;
      this.hideAll();
      this.clearTargetHighlight();
      this.targetEl = null;
      this.targetInfo = null;
    };
    this.projectKey = options.projectKey ?? "default";
    this.root = document.createElement("div");
    this.root.className = "dialkit-dev-host";
    this.contextMenu = this.createContextMenu();
    this.noteComposer = this.createNoteComposer();
    this.cssPanel = this.createCssPanel();
    this.root.append(this.contextMenu, this.noteComposer, this.cssPanel);
  }
  mount() {
    if (activeHost && activeHost !== this) {
      activeHost.unmount();
    }
    activeHost = this;
    DevSessionStore.configure(this.projectKey);
    document.body.appendChild(this.root);
    document.addEventListener("contextmenu", this.onContextMenu, true);
    document.addEventListener("click", this.onDocumentClick, true);
    document.addEventListener("keydown", this.onKeyDown, true);
    this.unsubStore = DevSessionStore.subscribe(() => this.notify());
    return () => this.unmount();
  }
  unmount() {
    if (activeHost === this) activeHost = null;
    document.removeEventListener("contextmenu", this.onContextMenu, true);
    document.removeEventListener("click", this.onDocumentClick, true);
    document.removeEventListener("keydown", this.onKeyDown, true);
    this.unsubStore?.();
    this.unsubStore = null;
    this.clearTargetHighlight();
    this.hideAll();
    this.root.remove();
  }
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  setTarget(el) {
    this.clearTargetHighlight();
    this.targetEl = el;
    this.targetInfo = el ? inspectElement(el) : null;
    if (el) {
      el.classList.add("dialkit-feedback-selected");
    }
    this.notify();
  }
  getTarget() {
    return this.targetEl;
  }
  getTargetInfo() {
    return this.targetInfo;
  }
  openNoteComposer(x, y) {
    if (x !== void 0 && y !== void 0) {
      this.menuPos = { x, y };
    }
    this.positionFloating(this.noteComposer, this.menuPos.x, this.menuPos.y);
    const textarea = this.noteComposer.querySelector("textarea");
    if (textarea instanceof HTMLTextAreaElement) {
      textarea.value = this.noteText;
      setTimeout(() => textarea.focus(), 0);
    }
    this.updateNoteComposerMeta();
    this.noteComposer.hidden = false;
    this.contextMenu.hidden = true;
  }
  openCssInspector(el) {
    const target = el ?? (this.targetEl instanceof HTMLElement ? this.targetEl : null);
    if (!target) return;
    this.cssTarget = target;
    this.cssValues = readCssValues(target);
    this.renderCssFields();
    this.cssPanel.hidden = false;
    this.contextMenu.hidden = true;
    this.noteComposer.hidden = true;
  }
  notify() {
    this.listeners.forEach((fn) => fn());
  }
  hideAll() {
    this.contextMenu.hidden = true;
    this.noteComposer.hidden = true;
    this.cssPanel.hidden = true;
  }
  clearTargetHighlight() {
    this.targetEl?.classList.remove("dialkit-feedback-selected");
    document.querySelectorAll(".dialkit-feedback-highlight").forEach((n) => {
      n.classList.remove("dialkit-feedback-highlight");
    });
  }
  positionFloating(el, x, y) {
    const pad = 8;
    const rect = { width: 260, height: 200 };
    let left = x;
    let top = y;
    if (left + rect.width > window.innerWidth - pad) left = window.innerWidth - rect.width - pad;
    if (top + rect.height > window.innerHeight - pad) top = window.innerHeight - rect.height - pad;
    el.style.left = `${Math.max(pad, left)}px`;
    el.style.top = `${Math.max(pad, top)}px`;
  }
  createContextMenu() {
    const menu = document.createElement("div");
    menu.className = "dialkit-dev-context-menu";
    menu.hidden = true;
    menu.innerHTML = `
      <button type="button" data-action="note">Leave note</button>
      <button type="button" data-action="css">Edit styles</button>
      <button type="button" data-action="tag">Tag element</button>
    `;
    menu.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-action]");
      if (!btn) return;
      const action = btn.getAttribute("data-action");
      if (action === "note") this.openNoteComposer(this.menuPos.x, this.menuPos.y);
      if (action === "css" && this.targetEl instanceof HTMLElement) this.openCssInspector(this.targetEl);
      if (action === "tag") {
        this.contextMenu.hidden = true;
        this.notify();
      }
    });
    return menu;
  }
  createNoteComposer() {
    const panel = document.createElement("div");
    panel.className = "dialkit-dev-note-composer";
    panel.hidden = true;
    panel.innerHTML = `
      <div class="dialkit-dev-note-head"><strong>Agent note</strong><button type="button" data-close>&times;</button></div>
      <div class="dialkit-dev-note-meta"></div>
      <textarea rows="3" placeholder="What should change here?"></textarea>
      <div class="dialkit-dev-note-actions">
        <button type="button" data-save class="dialkit-dev-btn-primary">Save note</button>
        <button type="button" data-cancel>Cancel</button>
      </div>
    `;
    panel.querySelector("[data-close]")?.addEventListener("click", () => {
      panel.hidden = true;
    });
    panel.querySelector("[data-cancel]")?.addEventListener("click", () => {
      panel.hidden = true;
    });
    panel.querySelector("[data-save]")?.addEventListener("click", () => {
      const textarea = panel.querySelector("textarea");
      const comment = textarea instanceof HTMLTextAreaElement ? textarea.value : "";
      const panels = DialStore.getPanels();
      const matched = matchPanelForTarget(this.targetInfo, panels);
      DevSessionStore.addNote({
        comment,
        target: this.targetInfo,
        panelId: matched?.id,
        panelName: matched?.name,
        dialSnapshot: matched ? DialStore.getValues(matched.id) : void 0
      });
      if (textarea instanceof HTMLTextAreaElement) textarea.value = "";
      panel.hidden = true;
      this.clearTargetHighlight();
      this.targetEl = null;
      this.targetInfo = null;
      this.notify();
    });
    return panel;
  }
  updateNoteComposerMeta() {
    const meta = this.noteComposer.querySelector(".dialkit-dev-note-meta");
    if (!meta) return;
    const panels = DialStore.getPanels();
    const matched = matchPanelForTarget(this.targetInfo, panels);
    const lines = [];
    if (this.targetInfo?.selector) lines.push(`<code>${escapeHtml(this.targetInfo.selector)}</code>`);
    if (this.targetInfo?.reactComponent) lines.push(`<span>${escapeHtml(this.targetInfo.reactComponent)}</span>`);
    if (matched) lines.push(`<span>Panel: ${escapeHtml(matched.name)}</span>`);
    meta.innerHTML = lines.join("") || "<span>Tagged element</span>";
  }
  createCssPanel() {
    const panel = document.createElement("div");
    panel.className = "dialkit-dev-css-panel";
    panel.hidden = true;
    panel.innerHTML = `
      <div class="dialkit-dev-css-head">
        <strong>Style editor</strong>
        <button type="button" data-close>&times;</button>
      </div>
      <div class="dialkit-dev-css-fields"></div>
    `;
    panel.querySelector("[data-close]")?.addEventListener("click", () => {
      panel.hidden = true;
    });
    return panel;
  }
  renderCssFields() {
    const container = this.cssPanel.querySelector(".dialkit-dev-css-fields");
    if (!container || !this.cssTarget) return;
    container.innerHTML = "";
    const defs = this.getRelevantDefs(this.cssTarget);
    for (const def of defs) {
      const row = document.createElement("label");
      row.className = "dialkit-dev-css-row";
      const value = this.cssValues[def.key] ?? "";
      row.innerHTML = `<span>${escapeHtml(def.label)}</span>`;
      const input = this.createCssInput(def, value);
      row.appendChild(input);
      container.appendChild(row);
    }
  }
  getRelevantDefs(el) {
    const isSvg = el instanceof SVGElement || Boolean(el.ownerSVGElement);
    return CSS_INSPECTOR_PROPERTIES.filter((def) => {
      if (def.key === "stroke" || def.key === "stroke-width" || def.key === "fill") return isSvg;
      return def.key !== "stroke" && def.key !== "stroke-width" && def.key !== "fill";
    });
  }
  createCssInput(def, value) {
    if (def.type === "select" && def.options) {
      const select = document.createElement("select");
      for (const opt of def.options) {
        const o = document.createElement("option");
        o.value = opt;
        o.textContent = opt;
        if (opt === value) o.selected = true;
        select.appendChild(o);
      }
      select.addEventListener("change", () => this.commitCss(def.key, select.value));
      return select;
    }
    const input = document.createElement("input");
    input.type = def.type === "color" ? "color" : def.type === "number" ? "number" : "text";
    if (def.type === "color") {
      input.value = toHexColor(value);
    } else {
      input.value = value;
    }
    input.addEventListener("change", () => this.commitCss(def.key, input.value));
    input.addEventListener("input", () => {
      if (def.type === "color" || def.type === "number") this.commitCss(def.key, input.value);
    });
    return input;
  }
  commitCss(property, value) {
    if (!this.cssTarget || !this.targetInfo) return;
    const previous = applyCssOverride(this.cssTarget, property, value);
    this.cssValues[property] = value;
    DevSessionStore.logCssOverride({
      selector: this.targetInfo.selector,
      element: this.targetInfo.element,
      property,
      value,
      previousValue: previous,
      target: this.targetInfo
    });
    this.notify();
  }
};
function escapeHtml(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function toHexColor(value) {
  if (/^#[0-9a-f]{6}$/i.test(value)) return value;
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return "#000000";
  ctx.fillStyle = value || "#000000";
  const normalized = ctx.fillStyle;
  if (/^#[0-9a-f]{6}$/i.test(normalized)) return normalized;
  return "#000000";
}
function mountDevSessionHost(options) {
  const host = new DevSessionHost(options);
  return host.mount();
}

// src/inject/standalone.ts
if (typeof window !== "undefined") {
  window.__DIALKIT_DEV_SESSION__ = {
    mount: mountDevSessionHost,
    version: "1.4.0-dev.1"
  };
  let cleanup = null;
  const enable = (projectKey = "extension") => {
    cleanup?.();
    cleanup = mountDevSessionHost({ projectKey });
  };
  const disable = () => {
    cleanup?.();
    cleanup = null;
  };
  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    if (event.data?.type === "dialkit-dev-session-enable") {
      enable(event.data.projectKey ?? "extension");
    }
    if (event.data?.type === "dialkit-dev-session-disable") {
      disable();
    }
  });
  const params = new URLSearchParams(window.location.search);
  const enabled = params.get("dialkit-dev") === "1" || window.localStorage.getItem("dialkit:dev-session:auto") === "1";
  if (enabled && !document.querySelector(".dialkit-root")) {
    enable(params.get("dialkit-project") ?? "extension");
  }
}
export {
  mountDevSessionHost
};
//# sourceMappingURL=inject.js.map