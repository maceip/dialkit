import { useEffect } from 'react';
import {
  PageFeedbackToolbarCSS,
  type AgentationProps,
} from '../annotation/components/page-toolbar-css';
import {
  removeAnnotationFromDevSession,
  syncAnnotationToDevSession,
  syncAnnotationUpdateToDevSession,
} from '../annotation/bridge-dev-session';
import { DevSessionStore } from '../store/DevSessionStore';

export type AnnotationToolbarProps = AgentationProps & {
  projectKey?: string;
  /** When true (default), mirror annotations into DevSessionStore local notes. */
  syncToDevSession?: boolean;
};

/**
 * Page annotation toolbar (Agentation UI) wired to DialKit local storage.
 * Hosted sync / webhooks / telemetry are not available.
 */
export function AnnotationToolbar({
  projectKey = 'default',
  syncToDevSession = true,
  onAnnotationAdd,
  onAnnotationUpdate,
  onAnnotationDelete,
  onAnnotationsClear,
  ...rest
}: AnnotationToolbarProps) {
  useEffect(() => {
    if (syncToDevSession) {
      DevSessionStore.configure(projectKey);
    }
  }, [projectKey, syncToDevSession]);

  return (
    <PageFeedbackToolbarCSS
      {...rest}
      onAnnotationAdd={(annotation) => {
        if (syncToDevSession) syncAnnotationToDevSession(annotation, projectKey);
        onAnnotationAdd?.(annotation);
      }}
      onAnnotationUpdate={(annotation) => {
        if (syncToDevSession) syncAnnotationUpdateToDevSession(annotation, projectKey);
        onAnnotationUpdate?.(annotation);
      }}
      onAnnotationDelete={(annotation) => {
        if (syncToDevSession) removeAnnotationFromDevSession(annotation, projectKey);
        onAnnotationDelete?.(annotation);
      }}
      onAnnotationsClear={(annotations) => {
        if (syncToDevSession) {
          for (const annotation of annotations) {
            removeAnnotationFromDevSession(annotation, projectKey);
          }
        }
        onAnnotationsClear?.(annotations);
      }}
    />
  );
}
