<script lang="ts">
    import type { Options } from "./stores";

    let options: Options | null = $state(null);
    async function initializeOptions() {
        options = (await chrome.storage.local.get(["rmp", "calendarExport"] as const)) as Options;
        options.rmp ??= true;
        options.calendarExport ??= true;
    }
    initializeOptions();

    $effect(() => {
        if (!options) return;
        chrome.storage.local.set(options);
    });
</script>

{#snippet option(property: string & keyof Options, label: string)}
    <div class="form-control">
        <label>
            <input type="checkbox" bind:checked={options![property]} />
            <span>{label}</span>
        </label>
    </div>
{/snippet}

<main>
    <h1>uOttawa Tools</h1>
    {#if options}
        {@render option("rmp", "Rate My Professors integration")}
        {@render option("calendarExport", "Calendar export for schedule")}
    {/if}
</main>
