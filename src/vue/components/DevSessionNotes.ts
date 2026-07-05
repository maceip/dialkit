import { onMounted, onUnmounted, ref, defineComponent, h } from 'vue';
import { bootstrapDevSession } from '../../dev-session/bootstrap';
import { mountAgentNotesPanel } from '../../dev-session/feedback-mount';
import { Folder } from './Folder';

export const DevSessionNotes = defineComponent({
  name: 'DialKitDevSessionNotes',
  props: {
    projectKey: { type: String, default: 'default' },
    defaultOpen: { type: Boolean, default: true },
    inline: { type: Boolean, default: false },
  },
  setup(props) {
    const container = ref<HTMLDivElement | null>(null);
    let cleanupPanel: (() => void) | undefined;
    let cleanupHost: (() => void) | undefined;

    onMounted(() => {
      cleanupHost = bootstrapDevSession({ projectKey: props.projectKey });
      if (container.value) {
        cleanupPanel = mountAgentNotesPanel(container.value);
      }
    });

    onUnmounted(() => {
      cleanupPanel?.();
      cleanupHost?.();
    });

    return () => h('div', { class: 'dialkit-panel-wrapper dialkit-feedback-panel' }, [
      h(Folder, {
        title: 'Agent notes',
        defaultOpen: props.defaultOpen,
        isRoot: false,
        inline: props.inline,
      }, {
        default: () => h('div', { ref: container }),
      }),
    ]);
  },
});
