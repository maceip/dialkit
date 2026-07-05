// Core API
export { createDialKit, createDialKitController } from './createDialKit';
export type { CreateDialOptions, DialKitController } from './createDialKit';
export { createDevDialKit, createDevDialKitController } from './createDevDialKit';

// Root component
export { DialRoot } from './components/DialRoot';
export type { DialPosition, DialMode, DialTheme } from './components/DialRoot';
export { DevSessionNotes } from './components/DevSessionNotes';

// Store exports
export { DialStore } from '../store/DialStore';
export { DevSessionStore } from '../store/DevSessionStore';
export type { DevNote, DialChangeEntry, CssOverrideEntry } from '../store/DevSessionStore';
export { bootstrapDevSession } from '../dev-session/bootstrap';
export { mountDevSessionHost } from '../dev-session/dev-session-host';
export { inspectElement, cssPath } from '../utils/dom-inspect';
export type { ElementInfo } from '../utils/dom-inspect';
export { Slider } from './components/Slider';
export { Toggle } from './components/Toggle';
export { Folder } from './components/Folder';
export { ButtonGroup } from './components/ButtonGroup';
export { SpringControl } from './components/SpringControl';
export { SpringVisualization } from './components/SpringVisualization';
export { TextControl } from './components/TextControl';
export { SelectControl } from './components/SelectControl';
export { ColorControl } from './components/ColorControl';
export { PresetManager } from './components/PresetManager';

export type {
  SpringConfig,
  EasingConfig,
  TransitionConfig,
  ActionConfig,
  SelectConfig,
  ColorConfig,
  TextConfig,
  ShortcutConfig,
  Preset,
  DialValue,
  DialConfig,
  DialKitPersistOptions,
  DialKitValueUpdates,
  ResolvedValues,
  ControlMeta,
  PanelConfig,
} from '../store/DialStore';
