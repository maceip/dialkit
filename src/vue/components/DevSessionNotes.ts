import { onMounted, onUnmounted, defineComponent } from 'vue';
import { bootstrapDevSession } from '../../dev-session/bootstrap';

export const DevSessionNotes = defineComponent({
  name: 'DialKitDevSessionNotes',
  props: {
    projectKey: { type: String, default: 'default' },
    defaultOpen: { type: Boolean, default: true },
    inline: { type: Boolean, default: false },
  },
  setup(props) {
    let cleanupHost: (() => void) | undefined;

    onMounted(() => {
      cleanupHost = bootstrapDevSession({ projectKey: props.projectKey });
    });

    onUnmounted(() => {
      cleanupHost?.();
    });

    return () => null;
  },
});
