import { useEffect, useRef } from 'react';
import { Folder } from './Folder';
import { mountAgentNotesPanel } from '../dev-session/feedback-mount';

interface FeedbackPanelProps {
  defaultOpen?: boolean;
  inline?: boolean;
}

export function FeedbackPanel({ defaultOpen = true, inline = false }: FeedbackPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    return mountAgentNotesPanel(containerRef.current);
  }, []);

  return (
    <div className="dialkit-panel-wrapper dialkit-feedback-panel">
      <Folder title="Agent notes" defaultOpen={defaultOpen} isRoot={!inline} inline={inline}>
        <div ref={containerRef} />
      </Folder>
    </div>
  );
}
