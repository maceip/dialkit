<script lang="ts">
  import { onMount } from 'svelte';
  import { bootstrapDevSession } from '../../dev-session/bootstrap';

  let {
    projectKey = 'default',
  } = $props<{
    projectKey?: string;
    defaultOpen?: boolean;
    inline?: boolean;
  }>();

  onMount(() => {
    // Tool host only. Annotation toolbar is React-first (see dialkit React DialRoot).
    return bootstrapDevSession({ projectKey });
  });
</script>
