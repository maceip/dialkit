import {
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
  type JSX,
} from 'solid-js';
import { Portal } from 'solid-js/web';
import type { Annotation } from '../../../annotation/types';
import { getDevSessionHost } from '../../../dev-session/dev-session-host';
import { MoveTool } from '../../../dev-session/layout-tools';
import { createAnnotationStore, type PendingAnnotation } from '../createAnnotationStore';
import { dialsOpen, setDialsOpen } from '../toolChrome';
import { ensureAnnotationStyles } from '../injectCss';
import { AnnotationMarker } from './AnnotationMarker';
import { AnnotationPopup } from './AnnotationPopup';
import { DevSessionStore } from '../../../store/DevSessionStore';
import {
  clampRailPos,
  DEFAULT_ACCENT,
  loadAccent,
  loadRailPos,
  RAIL_ACCENTS,
  saveAccent,
  saveRailPos,
  type RailPos,
} from '../railPrefs';
import {
  IconAnnotate,
  IconCapture,
  IconColor,
  IconDial,
  IconGrip,
  IconInfo,
  IconMove,
  IconSearch,
  IconSend,
} from './ToolbarIcons';

export interface SolidAnnotationToolbarProps {
  projectKey?: string;
  /** "New issue" URL (e.g. https://github.com/owner/repo/issues/new); enables the Send action. */
  issueUrl?: string;
  onAnnotationAdd?: (annotation: Annotation) => void;
  onCopy?: (markdown: string) => void;
}

type ToolId = 'info' | 'move' | 'color' | 'dial' | 'annotate' | 'capture' | 'search' | null;

const HOWTO: { id: Exclude<ToolId, null | 'info'>; title: string; body: string }[] = [
  { id: 'move', title: 'Move', body: 'Click an element, then drag to nudge its position.' },
  { id: 'color', title: 'Color', body: 'Click an element to open the style editor (colors, type, spacing).' },
  { id: 'dial', title: 'Dial', body: 'Open live parameter dials for this page.' },
  { id: 'annotate', title: 'Annotate', body: 'Arm the tool, then right-click an element to pin a note. Copy or clear from the annotate tray.' },
  { id: 'capture', title: 'Capture', body: 'Drag a rectangle over the page; the region is screenshotted and attached to a note.' },
  { id: 'search', title: 'Search', body: 'Find elements by visible text, then jump to a match.' },
];

/** Everything on the clipboard in one paste: annotations + CSS/dial appendix. */
function buildFullReport(annotationsMd: string): string {
  const appendix = DevSessionStore.buildAgentReport();
  return [annotationsMd, appendix].filter((s) => s.trim()).join('\n\n---\n\n');
}

/** Prefilled new-issue URL; body is trimmed to stay under URL length limits. */
function buildIssueUrl(base: string, body: string): string {
  const url = new URL(base);
  url.searchParams.set('title', `Page feedback: ${location.pathname}`);
  const max = 6000;
  url.searchParams.set(
    'body',
    body.length > max ? `${body.slice(0, max)}\n\n_…truncated; full report on the clipboard._` : body,
  );
  return url.toString();
}

function prefersDark(): boolean {
  return typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-color-scheme: dark)').matches;
}

function isChromeTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest('[data-dialkit-annotation-root], [data-dialkit-annotation-toolbar], .dialkit-root, .dialkit-dev-host'),
  );
}

function findElementsByText(query: string): { el: HTMLElement; label: string }[] {
  const q = query.trim().toLowerCase();
  if (!q || typeof document === 'undefined') return [];

  const out: { el: HTMLElement; label: string }[] = [];
  const seen = new Set<HTMLElement>();
  const nodes = document.body.querySelectorAll<HTMLElement>('h1,h2,h3,h4,h5,h6,p,span,a,button,li,label,td,th,strong,em');

  for (const el of nodes) {
    if (isChromeTarget(el)) continue;
    if (seen.has(el)) continue;
    const text = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
    if (!text || text.length > 160) continue;
    if (!text.toLowerCase().includes(q)) continue;
    // Prefer leaf-ish nodes: skip if a child already matched with same text
    let skip = false;
    for (const child of el.querySelectorAll<HTMLElement>('*')) {
      if (seen.has(child)) {
        skip = true;
        break;
      }
    }
    if (skip) continue;
    seen.add(el);
    out.push({ el, label: text.slice(0, 80) });
    if (out.length >= 24) break;
  }
  return out;
}

export function AnnotationToolbar(props: SolidAnnotationToolbarProps) {
  const store = createAnnotationStore(props.projectKey ?? 'default');
  const [themeDark, setThemeDark] = createSignal(prefersDark());
  const [scrollY, setScrollY] = createSignal(typeof window !== 'undefined' ? window.scrollY : 0);
  const [tool, setTool] = createSignal<ToolId>(null);
  const [searchQuery, setSearchQuery] = createSignal('');
  const [searchHits, setSearchHits] = createSignal<{ el: HTMLElement; label: string }[]>([]);
  const [copiedAll, setCopiedAll] = createSignal(false);
  const [railPos, setRailPos] = createSignal<RailPos | null>(loadRailPos());
  const [accent, setAccent] = createSignal(loadAccent() ?? DEFAULT_ACCENT);
  const moveTool = new MoveTool();
  let railRef: HTMLDivElement | undefined;

  const onGripPointerDown = (e: PointerEvent) => {
    if (!railRef || e.button !== 0) return;
    e.preventDefault();
    const rect = railRef.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;
    const grip = e.currentTarget as HTMLElement;
    grip.setPointerCapture(e.pointerId);

    const onDragMove = (ev: PointerEvent) => {
      setRailPos(clampRailPos(
        { x: ev.clientX - offsetX, y: ev.clientY - offsetY },
        rect.width,
        rect.height,
      ));
    };
    const onDragEnd = () => {
      grip.removeEventListener('pointermove', onDragMove);
      grip.removeEventListener('pointerup', onDragEnd);
      grip.removeEventListener('pointercancel', onDragEnd);
      saveRailPos(railPos());
    };
    grip.addEventListener('pointermove', onDragMove);
    grip.addEventListener('pointerup', onDragEnd);
    grip.addEventListener('pointercancel', onDragEnd);
  };

  const dockRail = () => {
    setRailPos(null);
    saveRailPos(null);
  };

  const pickAccent = (value: string) => {
    setAccent(value);
    saveAccent(value);
  };

  const railStyle = () => {
    const pos = railPos();
    return pos ? { left: `${pos.x}px`, top: `${pos.y}px`, transform: 'none' } : undefined;
  };

  /**
   * Flyouts default to sitting beside the docked rail (CSS fallbacks). When
   * the rail is dragged, follow it — flipping to the rail's left side near
   * the right viewport edge. Vertically they stay centered on the rail
   * (translateY(-50%) from CSS); the center is clamped so tall flyouts
   * keep their edges on screen.
   */
  const rootStyle = createMemo<JSX.CSSProperties>(() => {
    const style: JSX.CSSProperties = {
      display: 'contents',
      '--dk-ann-accent': accent(),
    };
    const pos = railPos();
    if (pos && typeof window !== 'undefined') {
      const rect = railRef?.getBoundingClientRect();
      const railW = rect?.width ?? 52;
      const railH = rect?.height ?? 320;
      const flyoutW = 292;
      const rightOfRail = pos.x + railW + 12;
      const overflowsRight = rightOfRail + flyoutW > window.innerWidth - 8;
      style['--dk-fly-left'] = `${overflowsRight ? Math.max(8, pos.x - flyoutW - 12) : rightOfRail}px`;
      style['--dk-fly-top'] = `clamp(240px, ${Math.round(pos.y + railH / 2)}px, calc(100vh - 240px))`;
    }
    return style;
  });

  onMount(() => {
    ensureAnnotationStyles();
    const onScroll = () => setScrollY(window.scrollY);
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    const onTheme = () => setThemeDark(prefersDark());
    const onOpenDials = () => {
      setDialsOpen(true);
      setTool('dial');
    };
    const onResize = () => {
      const pos = railPos();
      if (!pos || !railRef) return;
      const r = railRef.getBoundingClientRect();
      setRailPos(clampRailPos(pos, r.width, r.height));
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('dialkit:open-dials', onOpenDials);
    window.addEventListener('resize', onResize);
    mq?.addEventListener?.('change', onTheme);
    onCleanup(() => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('dialkit:open-dials', onOpenDials);
      window.removeEventListener('resize', onResize);
      mq?.removeEventListener?.('change', onTheme);
      moveTool.stop();
    });
  });

  const selectTool = (next: ToolId) => {
    const current = tool();

    // Capture is a one-shot action, not a mode: run the drag-select flow,
    // then land in annotate mode so the new pin (and composer) are visible.
    if (next === 'capture') {
      moveTool.stop();
      if (current === 'dial') setDialsOpen(false);
      void store.captureRegionAnnotation().then((ok) => {
        if (ok) {
          setTool('annotate');
          store.setActive(true);
        }
      });
      return;
    }

    // Toggle off
    if (current === next) {
      setTool(null);
      store.setActive(false);
      store.cancelPending();
      store.setEditingId(null);
      if (next === 'dial') setDialsOpen(false);
      moveTool.stop();
      return;
    }

    moveTool.stop();
    store.cancelPending();
    store.setEditingId(null);

    if (next !== 'annotate') store.setActive(false);
    if (next !== 'dial') setDialsOpen(false);
    if (next !== 'search') {
      setSearchQuery('');
      setSearchHits([]);
    }

    setTool(next);

    if (next === 'annotate') store.setActive(true);
    if (next === 'dial') setDialsOpen(true);
  };

  // Annotate page capture
  createEffect(() => {
    if (!store.active()) return;
    const detach = store.attachPageListeners();
    onCleanup(detach);
  });

  // Move / Color: next pointer on page picks the target
  createEffect(() => {
    const mode = tool();
    if (mode !== 'move' && mode !== 'color') return;

    const onPick = (e: MouseEvent) => {
      if (isChromeTarget(e.target)) return;
      const el = e.target;
      if (!(el instanceof HTMLElement)) return;
      e.preventDefault();
      e.stopPropagation();

      const host = getDevSessionHost();
      if (mode === 'color') {
        host?.openCssInspector(el);
        setTool(null);
        return;
      }

      // Move starts on mousedown so drag can continue without a second gesture
      host?.tagTarget(el);
      moveTool.start(el, e);
    };

    const type = mode === 'move' ? 'mousedown' : 'click';
    document.addEventListener(type, onPick, true);
    onCleanup(() => document.removeEventListener(type, onPick, true));
  });

  // Escape clears tool
  createEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setTool(null);
      store.setActive(false);
      store.cancelPending();
      store.setEditingId(null);
      setDialsOpen(false);
      moveTool.stop();
    };
    window.addEventListener('keydown', onKey, true);
    onCleanup(() => window.removeEventListener('keydown', onKey, true));
  });

  const editing = createMemo(() => {
    const id = store.editingId();
    return id ? store.annotations().find((a) => a.id === id) ?? null : null;
  });

  const editingAsPending = createMemo<PendingAnnotation | null>(() => {
    const a = editing();
    if (!a) return null;
    return {
      x: a.x,
      y: a.y,
      element: a.element,
      elementPath: a.elementPath,
      selectedText: a.selectedText,
      boundingBox: a.boundingBox,
      nearbyText: a.nearbyText,
      cssClasses: a.cssClasses,
      isFixed: a.isFixed,
    };
  });

  const pendingOutline = createMemo(() => {
    const p = store.pending();
    if (!p?.boundingBox) return null;
    const box = p.boundingBox;
    return {
      left: `${box.x}px`,
      top: `${p.isFixed ? box.y : box.y - scrollY()}px`,
      width: `${box.width}px`,
      height: `${box.height}px`,
      fixed: p.isFixed,
    };
  });

  const count = createMemo(() => store.annotations().length);

  const runSearch = (value: string) => {
    setSearchQuery(value);
    setSearchHits(findElementsByText(value));
  };

  const toolButton = (
    id: Exclude<ToolId, null>,
    label: string,
    icon: JSX.Element,
    extra?: { badge?: () => number },
  ) => (
    <button
      type="button"
      class="dk-ann-tool"
      data-tool={id}
      data-active={tool() === id || (id === 'dial' && dialsOpen()) ? 'true' : 'false'}
      data-testid={`dialkit-tool-${id}`}
      aria-label={label}
      title={label}
      onClick={() => selectTool(id)}
    >
      {icon}
      <Show when={(extra?.badge?.() ?? 0) > 0}>
        <span class="dk-ann-tool-badge">{extra!.badge!()}</span>
      </Show>
    </button>
  );

  return (
    <Portal mount={document.body}>
      <div
        data-dialkit-annotation-root
        data-theme={themeDark() ? 'dark' : 'light'}
        style={rootStyle()}
      >
        <div
          ref={railRef}
          class="dk-ann-toolbar"
          data-dialkit-annotation-toolbar
          data-testid="dialkit-annotation-toolbar"
          data-orientation="vertical"
          style={railStyle()}
        >
          <div
            class="dk-ann-grip"
            data-testid="dialkit-rail-grip"
            title="Drag to move — double-click to dock"
            onPointerDown={onGripPointerDown}
            onDblClick={dockRail}
          >
            <IconGrip />
          </div>
          {toolButton('info', 'How to use', <IconInfo />)}
          {toolButton('move', 'Move', <IconMove />)}
          {toolButton('color', 'Color / styles', <IconColor />)}
          {toolButton('dial', 'Open dials', <IconDial />)}
          {toolButton('annotate', 'Annotate', <IconAnnotate />, { badge: count })}
          <Show when={store.captureSupported()}>
            {toolButton('capture', 'Capture region', <IconCapture />)}
          </Show>
          {toolButton('search', 'Search elements', <IconSearch />)}
        </div>

        <Show when={tool() === 'info'}>
          <div class="dk-ann-flyout dk-ann-howto" data-dialkit-annotation-toolbar role="dialog" aria-label="How to use DialKit tools">
            <strong>DialKit tools</strong>
            <ul>
              <For each={HOWTO}>
                {(item) => (
                  <li>
                    <b>{item.title}</b>
                    <span>{item.body}</span>
                  </li>
                )}
              </For>
            </ul>
            <div class="dk-ann-accent-row" role="group" aria-label="Toolbar color">
              <span>Color</span>
              <For each={RAIL_ACCENTS}>
                {(opt) => (
                  <button
                    type="button"
                    class="dk-ann-swatch"
                    title={opt.label}
                    aria-label={opt.label}
                    data-active={accent() === opt.value ? 'true' : 'false'}
                    data-testid={`dialkit-accent-${opt.label.toLowerCase()}`}
                    style={{ background: opt.value }}
                    onClick={() => pickAccent(opt.value)}
                  />
                )}
              </For>
            </div>
          </div>
        </Show>

        <Show when={tool() === 'annotate'}>
          <div class="dk-ann-flyout dk-ann-annotate-tray" data-dialkit-annotation-toolbar>
            <span class="dk-ann-tray-label">
              {store.active() ? 'Right-click an element to pin a note' : 'Annotate'}
              <Show when={count() > 0}>
                <span class="dk-ann-badge">{count()}</span>
              </Show>
            </span>
            <button
              type="button"
              title="Copy notes + CSS/dial changes as markdown for an agent"
              onClick={async () => {
                const report = buildFullReport(store.markdown());
                if (!report.trim()) return;
                await navigator.clipboard?.writeText(report);
                setCopiedAll(true);
                window.setTimeout(() => setCopiedAll(false), 1500);
                props.onCopy?.(report);
              }}
            >
              {copiedAll() ? 'Copied' : 'Copy'}
            </button>
            <Show when={props.issueUrl}>
              {(issueUrl) => (
                <button
                  type="button"
                  title="Open a prefilled issue with this feedback (also copies it)"
                  onClick={async () => {
                    const report = buildFullReport(store.markdown());
                    if (!report.trim()) return;
                    await navigator.clipboard?.writeText(report).catch(() => {});
                    window.open(buildIssueUrl(issueUrl(), report), '_blank', 'noopener');
                  }}
                >
                  <IconSend />
                  Send
                </button>
              )}
            </Show>
            <button type="button" disabled={count() === 0} onClick={() => store.clearAll()}>
              Clear
            </button>
          </div>
        </Show>

        <Show when={tool() === 'search'}>
          <div class="dk-ann-flyout dk-ann-search" data-dialkit-annotation-toolbar>
            <input
              type="search"
              placeholder="Search text in elements…"
              value={searchQuery()}
              data-testid="dialkit-element-search"
              onInput={(e) => runSearch(e.currentTarget.value)}
            />
            <Show when={searchQuery().trim() && searchHits().length === 0}>
              <p class="dk-ann-search-empty">No matches</p>
            </Show>
            <ul class="dk-ann-search-hits">
              <For each={searchHits()}>
                {(hit) => (
                  <li>
                    <button
                      type="button"
                      onClick={() => {
                        hit.el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        getDevSessionHost()?.tagTarget(hit.el);
                        hit.el.classList.add('dialkit-feedback-highlight');
                        window.setTimeout(() => hit.el.classList.remove('dialkit-feedback-highlight'), 1600);
                      }}
                    >
                      {hit.label}
                    </button>
                  </li>
                )}
              </For>
            </ul>
          </div>
        </Show>

        <Show when={tool() === 'move' || tool() === 'color'}>
          <div class="dk-ann-hint" data-dialkit-annotation-toolbar>
            {tool() === 'move' ? 'Click an element, then drag to move' : 'Click an element to edit styles'}
          </div>
        </Show>

        <Show when={store.active()}>
          <For each={store.annotations()}>
            {(annotation, index) => (
              <AnnotationMarker
                annotation={annotation}
                index={index()}
                onSelect={() => {
                  store.setPending(null);
                  store.setEditingId(annotation.id);
                }}
              />
            )}
          </For>
        </Show>

        <Show when={pendingOutline()}>
          {(box) => (
            <div
              class="dk-ann-outline"
              data-fixed={box().fixed ? 'true' : undefined}
              style={{
                left: box().left,
                top: box().top,
                width: box().width,
                height: box().height,
              }}
            />
          )}
        </Show>

        <Show when={store.pending()}>
          {(p) => (
            <AnnotationPopup
              pending={p()}
              screenshotUrl={store.screenshotFor(p())}
              onCancel={() => store.cancelPending()}
              onSubmit={(comment) => {
                const before = store.annotations().length;
                store.addAnnotation(comment);
                const added = store.annotations()[0];
                if (added && store.annotations().length > before) {
                  props.onAnnotationAdd?.(added);
                }
              }}
            />
          )}
        </Show>

        <Show when={editingAsPending()}>
          {(p) => (
            <AnnotationPopup
              pending={p()}
              screenshotUrl={editing() ? store.screenshotFor(editing()!) : null}
              initialComment={editing()?.comment ?? ''}
              submitLabel="Save"
              onCancel={() => store.setEditingId(null)}
              onDelete={() => {
                const id = store.editingId();
                if (id) store.deleteAnnotation(id);
              }}
              onSubmit={(comment) => {
                const id = store.editingId();
                if (id) store.updateAnnotation(id, comment);
              }}
            />
          )}
        </Show>
      </div>
    </Portal>
  );
}
