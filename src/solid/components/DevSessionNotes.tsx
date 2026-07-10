import { onCleanup, onMount } from 'solid-js';
import { bootstrapDevSession } from '../../dev-session/bootstrap';
import { AnnotationToolbar } from '../annotation';

interface DevSessionNotesProps {
  projectKey?: string;
  defaultOpen?: boolean;
  inline?: boolean;
}

/**
 * Standalone mount for apps that don't use DialRoot:
 * slim CSS/dial/move host + Solid-native annotation toolbar.
 */
export function DevSessionNotes(props: DevSessionNotesProps) {
  onMount(() => {
    const cleanHost = bootstrapDevSession({ projectKey: props.projectKey ?? 'default' });
    onCleanup(() => cleanHost());
  });

  return <AnnotationToolbar projectKey={props.projectKey ?? 'default'} />;
}
