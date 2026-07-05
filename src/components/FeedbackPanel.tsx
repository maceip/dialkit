import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { DevSessionStore, type DevNote } from '../store/DevSessionStore';
import { DialStore } from '../store/DialStore';
import { inspectElement } from '../utils/dom-inspect';
import { matchPanelForTarget } from '../dev-session/panel-link';
import { getDevSessionHost } from '../dev-session/dev-session-host';
import { Folder } from './Folder';

interface FeedbackPanelProps {
  defaultOpen?: boolean;
  inline?: boolean;
}

export function FeedbackPanel({ defaultOpen = true, inline = false }: FeedbackPanelProps) {
  const [comment, setComment] = useState('');
  const [picking, setPicking] = useState(false);
  const [target, setTarget] = useState<Element | null>(null);
  const [hover, setHover] = useState<Element | null>(null);
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState('');

  const subscribe = useCallback((cb: () => void) => DevSessionStore.subscribe(cb), []);
  const getSnapshot = useCallback(() => DevSessionStore.getNotes(), []);
  const notes = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const pendingChanges = useSyncExternalStore(
    useCallback((cb) => DevSessionStore.subscribe(cb), []),
    useCallback(() => DevSessionStore.getPendingChanges().length, []),
    useCallback(() => DevSessionStore.getPendingChanges().length, [])
  );

  const pendingCss = useSyncExternalStore(
    useCallback((cb) => DevSessionStore.subscribe(cb), []),
    useCallback(() => DevSessionStore.getPendingCssOverrides().length, []),
    useCallback(() => DevSessionStore.getPendingCssOverrides().length, [])
  );

  const panels = useSyncExternalStore(
    useCallback((cb) => DialStore.subscribeGlobal(cb), []),
    useCallback(() => DialStore.getPanels(), []),
    useCallback(() => [], [])
  );

  const targetInfo = useMemo(() => (target ? inspectElement(target) : null), [target]);
  const matchedPanel = useMemo(
    () => matchPanelForTarget(targetInfo, panels),
    [targetInfo, panels]
  );

  useEffect(() => {
    const host = getDevSessionHost();
    if (!host) return;
    return host.subscribe(() => {
      const el = host.getTarget();
      if (el) setTarget(el);
    });
  }, []);

  useEffect(() => {
    if (!picking) return;

    const onMove = (e: MouseEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (!el || el.closest('.dialkit-root, .dialkit-dev-host')) return;
      if (hover !== el) {
        hover?.classList.remove('dialkit-feedback-highlight');
        setHover(el);
        el.classList.add('dialkit-feedback-highlight');
      }
    };

    const onClick = (e: MouseEvent) => {
      const el = e.target as Element | null;
      if (!el || el.closest('.dialkit-root, .dialkit-dev-host')) return;
      e.preventDefault();
      e.stopPropagation();
      target?.classList.remove('dialkit-feedback-selected');
      setTarget(el);
      getDevSessionHost()?.setTarget(el);
      el.classList.add('dialkit-feedback-selected');
      setPicking(false);
      hover?.classList.remove('dialkit-feedback-highlight');
      setHover(null);
      setStatus('Element tagged. Right-click anywhere for quick notes.');
    };

    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('click', onClick, true);
    document.body.style.cursor = 'crosshair';

    return () => {
      document.removeEventListener('mousemove', onMove, true);
      document.removeEventListener('click', onClick, true);
      document.body.style.cursor = '';
      hover?.classList.remove('dialkit-feedback-highlight');
    };
  }, [picking, hover, target]);

  useEffect(() => {
    if (!picking) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      setPicking(false);
      hover?.classList.remove('dialkit-feedback-highlight');
      setHover(null);
      setStatus('Tag cancelled.');
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [picking, hover]);

  const handleSaveNote = () => {
    if (!comment.trim() && !targetInfo) {
      setStatus('Add a comment or tag an element.');
      return;
    }
    DevSessionStore.addNote({
      comment,
      target: targetInfo,
      panelId: matchedPanel?.id,
      panelName: matchedPanel?.name,
      dialSnapshot: matchedPanel ? DialStore.getValues(matchedPanel.id) : undefined,
    });
    setComment('');
    target?.classList.remove('dialkit-feedback-selected');
    setTarget(null);
    getDevSessionHost()?.setTarget(null);
    setStatus('Note saved locally.');
  };

  const handleCopyReport = async () => {
    const ok = await DevSessionStore.copyAgentReport();
    if (ok) {
      setCopied(true);
      setStatus('Copied agent report. Pending items marked exported.');
      setTimeout(() => setCopied(false), 1500);
    } else {
      setStatus('Copy failed.');
    }
  };

  const openCssEditor = () => {
    if (target instanceof HTMLElement) {
      getDevSessionHost()?.openCssInspector(target);
      setStatus('Style editor opened.');
    } else {
      setStatus('Tag an element first.');
    }
  };

  const openNotes = notes.filter((n) => n.status === 'open');

  return (
    <div className="dialkit-panel-wrapper dialkit-feedback-panel">
      <Folder title="Agent notes" defaultOpen={defaultOpen} isRoot={!inline} inline={inline}>
        <div className="dialkit-feedback-meta">
          {openNotes.length} open note{openNotes.length === 1 ? '' : 's'} · {pendingChanges} dial change{pendingChanges === 1 ? '' : 's'} · {pendingCss} CSS edit{pendingCss === 1 ? '' : 's'}
        </div>
        <div className="dialkit-feedback-hint">Right-click any element to leave a note or edit styles.</div>

        <div className="dialkit-feedback-target">
          {targetInfo ? (
            <>
              <strong>Tagged</strong>
              <code>{targetInfo.selector}</code>
              {targetInfo.reactComponent ? <span>{targetInfo.reactComponent}</span> : null}
              {matchedPanel ? <span>Panel: {matchedPanel.name}</span> : null}
            </>
          ) : (
            <span>Tag a component on the page, then leave a note.</span>
          )}
        </div>

        <textarea
          className="dialkit-feedback-textarea"
          placeholder="What should change here?"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
        />

        <div className="dialkit-feedback-actions">
          <button
            type="button"
            className="dialkit-button dialkit-feedback-btn-primary"
            onClick={() => setPicking((v) => !v)}
          >
            {picking ? 'Cancel tag' : 'Tag element'}
          </button>
          <button type="button" className="dialkit-button" onClick={handleSaveNote}>
            Save note
          </button>
          <button type="button" className="dialkit-button" onClick={openCssEditor}>
            Edit styles
          </button>
          <button type="button" className="dialkit-button dialkit-feedback-btn-accent" onClick={handleCopyReport}>
            {copied ? 'Copied' : 'Copy for agent'}
          </button>
        </div>

        {status ? <div className="dialkit-feedback-status">{status}</div> : null}

        {notes.length > 0 && (
          <div className="dialkit-feedback-notes">
            {notes.slice(0, 8).map((note) => (
              <FeedbackNoteRow key={note.id} note={note} />
            ))}
          </div>
        )}

        <div className="dialkit-feedback-footer">
          <button type="button" className="dialkit-feedback-link" onClick={() => DevSessionStore.clearExported()}>
            Clear exported
          </button>
          <button type="button" className="dialkit-feedback-link dialkit-feedback-link-danger" onClick={() => {
            if (confirm('Clear all saved notes and change history for this project?')) {
              DevSessionStore.resetSession();
              setStatus('Session cleared.');
            }
          }}>
            Reset session
          </button>
        </div>
      </Folder>
    </div>
  );
}

function FeedbackNoteRow({ note }: { note: DevNote }) {
  return (
    <div className="dialkit-feedback-note" data-status={note.status}>
      <div className="dialkit-feedback-note-head">
        <strong>{note.reactComponent ?? note.element ?? 'Note'}</strong>
        <span>{new Date(note.updatedAt).toLocaleString()}</span>
      </div>
      {note.selector ? <code>{note.selector}</code> : null}
      {note.panelName ? <span className="dialkit-feedback-note-panel">Panel: {note.panelName}</span> : null}
      <p>{note.comment || '(no comment)'}</p>
      <div className="dialkit-feedback-note-actions">
        <button
          type="button"
          className="dialkit-feedback-link"
          onClick={() => DevSessionStore.updateNote(note.id, { status: note.status === 'open' ? 'done' : 'open' })}
        >
          {note.status === 'open' ? 'Mark done' : 'Reopen'}
        </button>
        <button
          type="button"
          className="dialkit-feedback-link dialkit-feedback-link-danger"
          onClick={() => DevSessionStore.deleteNote(note.id)}
        >
          Delete
        </button>
      </div>
    </div>
  );
}
