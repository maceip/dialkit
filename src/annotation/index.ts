// DialKit annotation toolbar (vendored Agentation UI, localStorage only)

export { PageFeedbackToolbarCSS as AnnotationToolbar } from './components/page-toolbar-css';
export { PageFeedbackToolbarCSS } from './components/page-toolbar-css';
export type { AgentationProps, DemoAnnotation } from './components/page-toolbar-css';
export type { Annotation } from './types';
export {
  loadAnnotations,
  saveAnnotations,
  getStorageKey,
  setAnnotationProjectKey,
  getAnnotationProjectKey,
  migrateDevSessionNotes,
  generateOutput,
} from './utils/public';
