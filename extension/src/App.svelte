<script lang="ts">
    import { EventType, type ExtensionEvent } from "./browser/messaging";
    import type { Options } from "./stores";

    let options: Options | null = $state(null);
    async function initializeOptions() {
        options = (await window.chrome.storage.local.get([
            "rmp",
            "rmpAiFeedback",
            "calendarExport",
            "calendarAutoRefresh",
            "googleCalendarId",
        ] as const)) as Options;
        options.rmp ??= true;
        options.calendarExport ??= true;
        options.calendarAutoRefresh ??= true;
        options.googleCalendarId ??= null;
    }
    initializeOptions();

    $effect(() => {
        if (!options) return;
        window.chrome.storage.local.set(options);
    });

    let authorized: boolean | null = $state(null);
    window.chrome.identity
        .getAuthToken({ interactive: false })
        .then(token => {
            if (token.token) authorized = true;
            else authorized = false;
        })
        .catch(() => (authorized = false));

    interface Calendar {
        accessRole: string;
        id: string;
        summary: string;
    }

    let calendars: Calendar[] | null = $state(null);
    $effect(() => {
        if (!authorized) return;
        window.chrome.runtime.sendMessage<ExtensionEvent>(
            { event: EventType.GoogleCalendarList },
            response => {
                if (response.success) calendars = response.calendars;
            },
        );
    });

    async function enableSync() {
        const token = await window.chrome.identity.getAuthToken({ interactive: true });
        if (token.token) authorized = true;
    }
</script>

{#snippet option(property: string & keyof Options, label: string)}
    <div class="form-control">
        <label>
            <input type="checkbox" bind:checked={options![property] as boolean} />
            <span>{label}</span>
        </label>
    </div>
{/snippet}

<main>
    <h1>uOttawa Tools</h1>
    <h2>General Options</h2>
    {#if options}
        {@render option("rmp", "Rate My Professors integration")}
        {@render option("rmpAiFeedback", "AI chat option to ask about professors")}
        {@render option("calendarExport", "Calendar export for schedule")}
        {@render option("calendarAutoRefresh", "Auto-apply filters for weekly calendar")}
    {/if}
    <h2>Google Calendar</h2>
    {#if authorized === false}
        <button onclick={enableSync}>Enable Google Calendar Sync</button>
    {/if}
    {#if options && calendars != null}
        <label>
            <span>Target Calendar</span>
            <select bind:value={options.googleCalendarId}>
                {#each calendars.filter(calendar => calendar.accessRole === "owner") as calendar}
                    <option value={calendar.id}>{calendar.summary}</option>
                {/each}
            </select>
        </label>
    {/if}
</main>
