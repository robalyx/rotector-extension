<script lang="ts">
  import type { UserStatus } from '../../lib/types/api';

  interface Props {
    status: UserStatus;
    position?: 'inline' | 'below-header' | 'footer';
  }

  let { status, position = 'below-header' }: Props = $props();

  const versionStatus = $derived(() => {
    if (!status.engineVersion) {
      return { 
        status: 'unknown', 
        statusText: 'Unknown',
        description: 'This analysis used an AI engine with unknown compatibility status.',
        impact: 'Version compatibility could not be determined.'
      };
    }
    
    const compatibility = status.versionCompatibility;
    
    if (compatibility === 'current') {
      return {
        status: 'latest',
        statusText: 'Latest',
        description: 'This analysis used the most current AI engine with the latest detection capabilities.',
        impact: 'Highest accuracy and most comprehensive analysis.'
      };
    } else if (compatibility === 'compatible') {
      return {
        status: 'behind-minor',
        statusText: 'Compatible',
        description: 'This analysis used an AI engine that is still supported but not the latest version.',
        impact: 'Still highly accurate with minor differences in detection capabilities.'
      };
    } else if (compatibility === 'outdated') {
      return {
        status: 'behind-major',
        statusText: 'Outdated',
        description: 'This analysis used an AI engine that is significantly behind the latest version.',
        impact: 'May have reduced accuracy compared to newer engine versions.'
      };
    } else if (compatibility === 'deprecated') {
      return {
        status: 'deprecated',
        statusText: 'Deprecated',
        description: 'This analysis used an AI engine that is no longer supported.',
        impact: 'Accuracy may be significantly reduced and results should be treated with caution.'
      };
    } else {
      // Fallback for unknown compatibility status
      return {
        status: 'unknown',
        statusText: 'Unknown',
        description: 'This analysis used an AI engine with unknown compatibility status.',
        impact: 'Version compatibility could not be determined.'
      };
    }
  });

  let showTooltip = $state(false);

  function handleMouseEnter() {
    showTooltip = true;
  }

  function handleMouseLeave() {
    showTooltip = false;
  }
</script>

<div 
  class="engine-version-container-{position}"
  aria-label="Engine version information"
  onmouseenter={handleMouseEnter}
  onmouseleave={handleMouseLeave}
  role="tooltip"
>
  <div class="engine-version-tag {versionStatus().status}">
    {status.engineVersion}
  </div>
  
  {#if showTooltip}
    <div class="engine-version-tooltip {position} visible">
      <div class="engine-version-tooltip-header" class:centered={position === 'below-header' || position === 'footer'}>
        Engine v{status.engineVersion}
        <div class="engine-version-status {versionStatus().status}">
          {versionStatus().statusText}
        </div>
      </div>
      
      <div class="engine-version-description">
        {versionStatus().description}
      </div>
      
      <div class="engine-version-impact">
        {versionStatus().impact}
      </div>
    </div>
  {/if}
</div> 