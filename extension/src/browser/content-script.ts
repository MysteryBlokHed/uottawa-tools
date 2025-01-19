import { EventType, type ExtensionEvent } from "./messaging.js";
import { CurrentPage, identifyPage } from "./page-info.js";
import { classToEvents } from "../utils/export-classes.js";
import { createEvents } from "../utils/ics.js";
import type { BasicRating } from "../utils/rmp.js";
import type { Options } from "../stores.js";

async function addRmp(
    rows: () => Iterable<HTMLTableRowElement>,
    profCol: number,
    multilineNames: boolean,
) {
    // Find unique prof names
    const profNamesSet = new Set<string>();
    for (const row of rows()) {
        const name = (row.children[profCol] as HTMLTableColElement).innerText.split("\n")[0].trim();
        if (!name || name == "To be Announced") continue;
        profNamesSet.add(name);
    }
    const profNames = Array.from(profNamesSet);

    // Request basic prof ratings
    const profRatingsResponse = await chrome.runtime.sendMessage<ExtensionEvent>({
        event: EventType.RmpBasicMulti,
        names: profNames,
    });
    if (!profRatingsResponse.success) return null;
    const ratings = profRatingsResponse.ratings as BasicRating[];

    // Create mapping of prof names to ratings
    const profRatingsMap: Record<string, BasicRating> = {};
    for (let i = 0; i < ratings.length; ++i) {
        if (ratings[i] == null) continue;
        profRatingsMap[profNames[i]] = ratings[i];
    }

    for (const row of rows()) {
        const nameCol = row.children[profCol] as HTMLTableColElement;
        const name = nameCol.innerText.split("\n")[0].trim();
        if (!name || name == "To be Announced") continue;

        const rmpLink = document.createElement("a");
        rmpLink.target = "_blank";

        if (name in profRatingsMap) {
            const rating = profRatingsMap[name];
            rmpLink.innerHTML = `(Rating <b>${rating.avgRating}/5.0</b>, Difficulty <b>${rating.avgDifficulty}/5.0</b>)`;
            const id = parseInt(atob(rating.id).slice(8));
            rmpLink.href = `https://www.ratemyprofessors.com/professor/${id}`;
        } else {
            rmpLink.innerText = "(No rating found)";
            const params = new URLSearchParams({ q: name });
            const searchUrl = `https://www.ratemyprofessors.com/search/professors/1452?${params.toString()}`;
            rmpLink.href = searchUrl;
        }

        // TODO: Instead of just only considering one prof name in lists with multiple names, check all names
        // (although I have never actually seen the names be different)
        if (multilineNames) nameCol.innerText = name + "\n";
        nameCol.appendChild(rmpLink);
    }

    return ratings;
}

let observer: MutationObserver | null = null;

async function main() {
    const page = identifyPage();
    console.log("Identified page", page);
    const options = (await chrome.storage.local.get([
        "rmp",
        "calendarExport",
        "calendarAutoRefresh",
    ] satisfies Array<keyof Options>)) as Options;

    switch (page.page) {
        case CurrentPage.ClassSchedule:
            {
                // =======================
                // Calendar Export Buttons
                // =======================
                if (options.calendarExport) {
                    const row =
                        document.querySelector<HTMLTableRowElement>("tr[id*=trCLASS_MTG_VW]");
                    const btnContainer =
                        // @ts-expect-error This UI is terrible and this is the best idea I've got
                        row.parentElement.parentElement.parentElement.parentElement.parentElement
                            .parentElement.parentElement.parentElement.parentElement.parentElement
                            .parentElement.parentElement.parentElement.parentElement.parentElement
                            .parentElement.parentElement.parentElement.parentElement.parentElement
                            .parentElement;

                    const icsButton = document.createElement("button");
                    icsButton.type = "button";
                    icsButton.style.width = "100%";
                    icsButton.innerText = "Export to iCalendar (.ics)";
                    icsButton.onclick = async ev => {
                        ev.stopImmediatePropagation();
                        const events = await createEvents(page.classes.flatMap(classToEvents));
                        const blob = new Blob([events], { type: "text/calendar" });
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement("a");
                        link.href = url;
                        link.download = "schedule.ics";
                        link.click();
                    };

                    const googleCalButton = document.createElement("button");
                    googleCalButton.type = "button";
                    googleCalButton.style.width = "100%";
                    googleCalButton.innerText = "Export to Google Calendar";
                    googleCalButton.onclick = async ev => {
                        const response = await chrome.runtime.sendMessage<ExtensionEvent>({
                            event: EventType.GooglePush,
                            classes: page.classes,
                        });
                    };

                    btnContainer!.prepend(googleCalButton);
                    btnContainer!.prepend(icsButton);
                }

                // ===============
                // RMP Integration
                // ===============
                if (options.rmp) {
                    const rows =
                        document.querySelectorAll<HTMLTableRowElement>("tr[id*=trCLASS_MTG_VW]");
                    addRmp(() => rows.values(), 5, false);
                }
            }
            break;
        case CurrentPage.ClassSelector:
            {
                // ===============
                // RMP Integration
                // ===============
                if (options.rmp) {
                    const rows = document.querySelectorAll<HTMLTableRowElement>(
                        "tr[id*=trSSR_CLSRCH_MTG1]",
                    );
                    addRmp(() => rows.values(), 4, true);
                }
            }
            break;
        case CurrentPage.WeeklyCalendar:
            {
                // =================
                // Automatic refresh
                // =================
                if (options.calendarAutoRefresh) {
                    const registerListeners = () => {
                        const container = document.querySelector(
                            "div[id*=DERIVED_CLASS_S_MONDAY_LBL]",
                        )!;
                        const checkboxes =
                            container.querySelectorAll<HTMLInputElement>("input[type=checkbox]");
                        const refreshButton =
                            container.querySelector<HTMLInputElement>("input[type=button]")!;
                        checkboxes.forEach(checkbox =>
                            checkbox.addEventListener("input", () => refreshButton.click()),
                        );
                    };
                    const calendarObserver = new MutationObserver(registerListeners);
                    registerListeners();
                    calendarObserver.observe(document.getElementById("win0divPSPAGECONTAINER")!, {
                        childList: true,
                    });
                }
            }
            break;
    }

    if (page.page !== CurrentPage.Unknown && observer != null) observer.disconnect();
    else if (page.page === CurrentPage.Unknown && observer == null) {
        observer = new MutationObserver(() => main());
        observer.observe(document.body, { attributes: true, childList: true });
    }
}

main();
