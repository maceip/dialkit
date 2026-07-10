import { createSignal, Show } from 'solid-js';
import type { PendingAnnotation } from '../createAnnotationStore';

export function AnnotationPopup(props: {
  pending: PendingAnnotation;
  onSubmit: (comment: string) => void;
  onCancel: () => void;
  initialComment?: string;
  submitLabel?: string;
  onDelete?: () => void;
}) {
  const [text, setText] = createSignal(props.initialComment ?? '');
  const scrollY = () => (typeof window !== 'undefined' ? window.scrollY : 0);
  const top = () => (props.pending.isFixed ? props.pending.y : props.pending.y - scrollY()) + 18;
  const left = () => `${Math.min(Math.max(props.pending.x, 8), 92)}%`;

  return (
    <div
      class="dk-ann-popup"
      data-annotation-popup
      data-fixed={props.pending.isFixed ? 'true' : undefined}
      style={{
        left: left(),
        top: `${top()}px`,
        transform: 'translateX(-50%)',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div class="dk-ann-popup-head">
        <strong title={props.pending.elementPath}>{props.pending.element}</strong>
        <span>note</span>
      </div>
      <Show when={props.pending.selectedText}>
        <div style={{ 'font-size': '12px', color: 'var(--dk-ann-muted)', 'margin-bottom': '8px' }}>
          “{props.pending.selectedText}”
        </div>
      </Show>
      <textarea
        placeholder="What should change?"
        value={text()}
        onInput={(e) => setText(e.currentTarget.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (text().trim()) props.onSubmit(text());
          }
          if (e.key === 'Escape') props.onCancel();
        }}
        autofocus
      />
      <div class="dk-ann-popup-actions">
        <Show when={props.onDelete}>
          <button type="button" onClick={() => props.onDelete?.()}>Delete</button>
        </Show>
        <button type="button" onClick={() => props.onCancel()}>Cancel</button>
        <button
          type="button"
          class="dk-ann-submit"
          disabled={!text().trim()}
          onClick={() => props.onSubmit(text())}
        >
          {props.submitLabel ?? 'Add'}
        </button>
      </div>
    </div>
  );
}
