<script lang="ts">
  interface Props {
    checked: boolean;
    disabled?: boolean;
    onchange: (checked: boolean) => void;
    preventChange?: boolean;
  }

  let { checked = $bindable(), disabled = false, onchange, preventChange = false }: Props = $props();

  function handleChange(event: Event) {
    const target = event.target as HTMLInputElement;
    
    if (preventChange) {
      target.checked = checked;
      onchange(!checked);
      return;
    }
    
    checked = target.checked;
    onchange(checked);
  }
</script>

<label style:width="40px" style:height="22px" class="relative inline-block flex-shrink-0">
  <input 
    name="toggle" 
    class="opacity-0 w-0 h-0 focus:outline-none peer"
    {checked} 
    {disabled}
    onchange={handleChange}
    type="checkbox"
  />
  <span 
    class="toggle-switch"
    class:checked
    class:disabled
  >
    <span 
      class="toggle-handle"
      class:checked
      class:disabled
    ></span>
  </span>
</label> 