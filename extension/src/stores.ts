import { writable, type Writable } from "svelte/store";

export interface Options {
    rmp: boolean;
    calendarExport: boolean;
    calendarAutoRefresh: boolean;
}

export let options: Writable<Options>;

export async function initializeOptions() {
    const chromeConfig = (await chrome.storage.local.get([
        "rmp",
        "calendarExport",
        "calendarAutoRefresh",
    ] satisfies Array<keyof Options>)) as Options;
    chromeConfig.rmp ??= true;
    chromeConfig.calendarExport ??= true;
    chromeConfig.calendarAutoRefresh ??= true;
    options = writable(chromeConfig);
    options.subscribe(options => chrome.storage.local.set(options));
}
