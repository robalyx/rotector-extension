<script lang="ts">
  interface Props {
    size?: 'small' | 'medium' | 'large';
  }

  let { size = 'medium' }: Props = $props();
</script>

<div class="loading-spinner {size}"></div> 