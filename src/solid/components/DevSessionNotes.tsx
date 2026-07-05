import { onCleanup, onMount } from 'solid-js';
import { bootstrapDevSession } from '../../dev-session/bootstrap';
import { mountAgentNotesPanel } from '../../dev-session/feedback-mount';
import { Folder } from './Folder';

interface DevSessionNotesProps {
  projectKey?: string;
  defaultOpen?: boolean;
  inline?: boolean;
}

export function DevSessionNotes(props: DevSessionNotesProps) {
  let container: HTMLDivElement | undefined;

  onMount(() => {
    const cleanHost = bootstrapDevSession({ projectKey: props.projectKey ?? 'default' });
    const cleanPanel = container ? mountAgentNotesPanel(container) : () => {};
    onCleanup(() => {
      cleanPanel();
      cleanHost();
    });
  });

  return (
    <div class="dialkit-panel-wrapper dialkit-feedback-panel">
      <Folder
        title="Agent notes"
        defaultOpen={props.defaultOpen ?? true}
        isRoot={false}
        inline={props.inline ?? false}
      >
        <div ref={container} />
      </Folder>
    </div>
  );
}
