// =============================================================================
// DialKit page annotations (ported from Agentation UI, local-only storage)
// =============================================================================
//
// Upstream UI adapted from https://github.com/benjitaylor/agentation
// (PolyForm Shield 1.0.0 — see LICENSE.Agentation / THIRD_PARTY_AGENTATION_LICENSE.txt).
// Hosted MCP/cloud sync, webhooks, and telemetry paths are intentionally omitted.
// Annotations persist in localStorage and mirror into DialKit DevSessionStore.
//

export { PageFeedbackToolbarCSS as Agentation } from "./components/page-toolbar-css";
export { PageFeedbackToolbarCSS } from "./components/page-toolbar-css";
export type { DemoAnnotation, AgentationProps } from "./components/page-toolbar-css";

export { AnnotationPopupCSS } from "./components/annotation-popup-css";
export type {
  AnnotationPopupCSSProps,
  AnnotationPopupCSSHandle,
} from "./components/annotation-popup-css";

export * from "./components/icons";

export {
  identifyElement,
  identifyAnimationElement,
  getElementPath,
  getNearbyText,
  getElementClasses,
  isInShadowDOM,
  getShadowHost,
  closestCrossingShadow,
} from "./utils/element-identification";

export {
  loadAnnotations,
  saveAnnotations,
  getStorageKey,
} from "./utils/storage";

export type { Annotation } from "./types";

export {
  syncAnnotationToDevSession,
  syncAnnotationUpdateToDevSession,
  annotationToDevNoteInput,
} from "./bridge-dev-session";
