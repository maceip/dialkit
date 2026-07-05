<script lang="ts">
  import { onMount } from 'svelte';
  import { bootstrapDevSession } from '../../dev-session/bootstrap';
  import { mountAgentNotesPanel } from '../../dev-session/feedback-mount';
  import Folder from './Folder.svelte';

  let {
    projectKey = 'default',
    defaultOpen = true,
    inline = false,
  } = $props<{
    projectKey?: string;
    defaultOpen?: boolean;
    inline?: boolean;
  }>();

  let container = $state<HTMLDivElement>();

  onMount(() => {
    const cleanHost = bootstrapDevSession({ projectKey });
    const cleanPanel = container ? mountAgentNotesPanel(container) : () => {};
    return () => {
      cleanPanel();
      cleanHost();
    };
  });
</script>

<div class="dialkit-panel-wrapper dialkit-feedback-panel">
  <Folder title="Agent notes" {defaultOpen} isRoot={false} {inline}>
    <div bind:this={container}></div>
  </Folder>
</div>
