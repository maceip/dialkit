import {
  AnnotationToolbar as Toolbar,
  migrateDevSessionNotes,
  setAnnotationProjectKey,
} from '../annotation';
import type { Annotation } from '../annotation';

export interface AnnotationToolbarProps {
  projectKey?: string;
  onAnnotationAdd?: (annotation: Annotation) => void;
  onAnnotationDelete?: (annotation: Annotation) => void;
  onAnnotationUpdate?: (annotation: Annotation) => void;
  onAnnotationsClear?: (annotations: Annotation[]) => void;
  onCopy?: (markdown: string) => void;
  onSubmit?: (output: string, annotations: Annotation[]) => void;
}

/** DialKit wrapper: scopes storage by projectKey before the toolbar mounts. */
export function AnnotationToolbar({
  projectKey = 'default',
  ...callbacks
}: AnnotationToolbarProps) {
  // Must run during render (not useEffect) so the first load/save uses the right key.
  setAnnotationProjectKey(projectKey);
  if (typeof window !== 'undefined') {
    migrateDevSessionNotes(projectKey);
  }

  return <Toolbar copyToClipboard {...callbacks} />;
}
