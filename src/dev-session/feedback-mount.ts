import { DevSessionStore } from '../store/DevSessionStore';
import { DialStore } from '../store/DialStore';
import { inspectElement } from '../utils/dom-inspect';
import { matchPanelForTarget } from './panel-link';
import { getDevSessionHost } from './dev-session-host';

export function mountAgentNotesPanel(container: HTMLElement): () => void {
  let target: Element | null = null;
  let picking = false;
  let hover: Element | null = null;
  let comment = '';

  const root = document.createElement('div');
  root.className = 'dialkit-feedback-inner';
  root.innerHTML = `
    <div class="dialkit-feedback-meta" data-meta></div>
    <div class="dialkit-feedback-hint">Right-click any element to leave a note or edit styles.</div>
    <div class="dialkit-feedback-target" data-target></div>
    <textarea class="dialkit-feedback-textarea" rows="3" placeholder="What should change here?"></textarea>
    <div class="dialkit-feedback-actions">
      <button type="button" class="dialkit-button dialkit-feedback-btn-primary" data-tag>Tag element</button>
      <button type="button" class="dialkit-button" data-save>Save note</button>
      <button type="button" class="dialkit-button" data-css>Edit styles</button>
      <button type="button" class="dialkit-button dialkit-feedback-btn-accent" data-copy>Copy for agent</button>
      <button type="button" class="dialkit-button" data-json>Copy JSON</button>
    </div>
    <div class="dialkit-feedback-status" data-status hidden></div>
    <div class="dialkit-feedback-notes" data-notes></div>
    <div class="dialkit-feedback-footer">
      <button type="button" class="dialkit-feedback-link" data-clear>Clear exported</button>
      <button type="button" class="dialkit-feedback-link dialkit-feedback-link-danger" data-reset>Reset session</button>
    </div>
  `;
  container.appendChild(root);

  const metaEl = root.querySelector('[data-meta]')!;
  const targetEl = root.querySelector('[data-target]')!;
  const textarea = root.querySelector('textarea')!;
  const statusEl = root.querySelector('[data-status]') as HTMLElement;
  const notesEl = root.querySelector('[data-notes]')!;

  const setStatus = (msg: string) => {
    statusEl.textContent = msg;
    statusEl.hidden = !msg;
  };

  const render = () => {
    const notes = DevSessionStore.getNotes();
    const openNotes = notes.filter((n) => n.status === 'open');
    const pendingChanges = DevSessionStore.getPendingChanges().length;
    const pendingCss = DevSessionStore.getPendingCssOverrides().length;
    metaEl.textContent = `${openNotes.length} open note${openNotes.length === 1 ? '' : 's'} · ${pendingChanges} dial change${pendingChanges === 1 ? '' : 's'} · ${pendingCss} CSS edit${pendingCss === 1 ? '' : 's'}`;

    const info = target ? inspectElement(target) : null;
    const matched = matchPanelForTarget(info, DialStore.getPanels());
    if (info) {
      targetEl.innerHTML = `<strong>Tagged</strong><code>${escapeHtml(info.selector)}</code>${info.reactComponent ? `<span>${escapeHtml(info.reactComponent)}</span>` : ''}${matched ? `<span>Panel: ${escapeHtml(matched.name)}</span>` : ''}`;
    } else {
      targetEl.innerHTML = '<span>Tag a component on the page, then leave a note.</span>';
    }

    notesEl.innerHTML = notes.slice(0, 8).map((note) => `
      <div class="dialkit-feedback-note" data-status="${note.status}">
        <div class="dialkit-feedback-note-head"><strong>${escapeHtml(note.reactComponent ?? note.element ?? 'Note')}</strong><span>${new Date(note.updatedAt).toLocaleString()}</span></div>
        ${note.selector ? `<code>${escapeHtml(note.selector)}</code>` : ''}
        ${note.panelName ? `<span class="dialkit-feedback-note-panel">Panel: ${escapeHtml(note.panelName)}</span>` : ''}
        <p>${escapeHtml(note.comment || '(no comment)')}</p>
        ${(note.replies ?? []).map((r) => `<p class="dialkit-feedback-reply">${escapeHtml(r.body)}</p>`).join('')}
        <div class="dialkit-feedback-note-actions">
          <button type="button" class="dialkit-feedback-link" data-reply="${note.id}">Reply</button>
          <button type="button" class="dialkit-feedback-link" data-toggle="${note.id}">${note.status === 'open' ? 'Mark done' : 'Reopen'}</button>
          <button type="button" class="dialkit-feedback-link dialkit-feedback-link-danger" data-delete="${note.id}">Delete</button>
        </div>
      </div>
    `).join('');
  };

  const unsub = DevSessionStore.subscribe(render);
  const hostUnsub = getDevSessionHost()?.subscribe(() => {
    const el = getDevSessionHost()?.getTarget();
    if (el) {
      target = el;
      render();
    }
  });

  textarea.addEventListener('input', () => {
    comment = (textarea as HTMLTextAreaElement).value;
  });

  root.querySelector('[data-tag]')?.addEventListener('click', () => {
    picking = !picking;
    const btn = root.querySelector('[data-tag]')!;
    btn.textContent = picking ? 'Cancel tag' : 'Tag element';
    if (!picking) {
      hover?.classList.remove('dialkit-feedback-highlight');
      hover = null;
      document.body.style.cursor = '';
      return;
    }
    setStatus('Click an element to tag it.');
  });

  root.querySelector('[data-save]')?.addEventListener('click', () => {
    const info = target ? inspectElement(target) : null;
    const matched = matchPanelForTarget(info, DialStore.getPanels());
    if (!comment.trim() && !info) {
      setStatus('Add a comment or tag an element.');
      return;
    }
    DevSessionStore.addNote({
      comment,
      target: info,
      panelId: matched?.id,
      panelName: matched?.name,
      dialSnapshot: matched ? DialStore.getValues(matched.id) : undefined,
    });
    comment = '';
    (textarea as HTMLTextAreaElement).value = '';
    target?.classList.remove('dialkit-feedback-selected');
    target = null;
    getDevSessionHost()?.setTarget(null);
    setStatus('Note saved locally.');
    render();
  });

  root.querySelector('[data-css]')?.addEventListener('click', () => {
    if (target instanceof HTMLElement) {
      getDevSessionHost()?.openCssInspector(target);
      setStatus('Style editor opened.');
    } else {
      setStatus('Tag an element first.');
    }
  });

  root.querySelector('[data-copy]')?.addEventListener('click', async () => {
    const ok = await DevSessionStore.copyAgentReport();
    setStatus(ok ? 'Copied agent report.' : 'Copy failed.');
    render();
  });

  root.querySelector('[data-json]')?.addEventListener('click', async () => {
    const ok = await DevSessionStore.copyJsonExport();
    setStatus(ok ? 'Copied JSON export.' : 'Copy failed.');
  });

  root.querySelector('[data-clear]')?.addEventListener('click', () => {
    DevSessionStore.clearExported();
    render();
  });

  root.querySelector('[data-reset]')?.addEventListener('click', () => {
    if (confirm('Clear all saved notes and change history for this project?')) {
      DevSessionStore.resetSession();
      setStatus('Session cleared.');
      render();
    }
  });

  notesEl.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const toggleId = t.getAttribute('data-toggle');
    const deleteId = t.getAttribute('data-delete');
    const replyId = t.getAttribute('data-reply');
    if (toggleId) {
      const note = DevSessionStore.getNotes().find((n) => n.id === toggleId);
      if (note) DevSessionStore.updateNote(toggleId, { status: note.status === 'open' ? 'done' : 'open' });
    }
    if (deleteId) DevSessionStore.deleteNote(deleteId);
    if (replyId) {
      const body = prompt('Reply');
      if (body) DevSessionStore.addReply(replyId, body);
    }
  });

  const onMove = (e: MouseEvent) => {
    if (!picking) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || el.closest('.dialkit-root, .dialkit-dev-host')) return;
    if (hover !== el) {
      hover?.classList.remove('dialkit-feedback-highlight');
      hover = el;
      el.classList.add('dialkit-feedback-highlight');
    }
  };

  const onClick = (e: MouseEvent) => {
    if (!picking) return;
    const el = e.target as Element | null;
    if (!el || el.closest('.dialkit-root, .dialkit-dev-host')) return;
    e.preventDefault();
    e.stopPropagation();
    target?.classList.remove('dialkit-feedback-selected');
    target = el;
    getDevSessionHost()?.setTarget(el);
    el.classList.add('dialkit-feedback-selected');
    picking = false;
    root.querySelector('[data-tag]')!.textContent = 'Tag element';
    hover?.classList.remove('dialkit-feedback-highlight');
    hover = null;
    document.body.style.cursor = '';
    setStatus('Element tagged.');
    render();
  };

  document.addEventListener('mousemove', onMove, true);
  document.addEventListener('click', onClick, true);
  render();

  return () => {
    unsub();
    hostUnsub?.();
    document.removeEventListener('mousemove', onMove, true);
    document.removeEventListener('click', onClick, true);
    root.remove();
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
