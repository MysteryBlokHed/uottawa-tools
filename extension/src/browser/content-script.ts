import { EventType, type ExtensionEvent } from "./messaging.js";
import { CurrentPage, identifyPage } from "./page-info.js";
import { classToEvents } from "../utils/export-classes";
import { createEvents } from "../utils/ics";
import type { BasicRating } from "../utils/rmp.js";

(async () => {
    const page = identifyPage();
    console.log("Identified page", page);

    switch (page.page) {
        case CurrentPage.ClassSchedule: {
            // =======================
            // Calendar Export Buttons
            // =======================
            const row = document.querySelector<HTMLTableRowElement>("tr[id*=trCLASS_MTG_VW]");
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
                    event: EventType.GoogleSync,
                    classes: page.classes,
                });
                console.log("Response:", response);
            };

            btnContainer!.prepend(googleCalButton);
            btnContainer!.prepend(icsButton);

            // ===============
            // RMP Integration
            // ===============
            const rows = document.querySelectorAll<HTMLTableRowElement>("tr[id*=trCLASS_MTG_VW]");
            // Find unique prof names
            const profNamesSet = new Set<string>();
            for (const row of rows.values()) {
                const name = (row.children[5] as HTMLTableColElement).innerText.trim();
                if (!name || name == 'To be Announced') continue;
                profNamesSet.add(name);
            }
            const profNames = Array.from(profNamesSet);

            // Request basic prof ratings
            const profRatingsResponse = await chrome.runtime.sendMessage<ExtensionEvent>({
                event: EventType.RmpBasicMulti, names: profNames
            });
            if (!profRatingsResponse.success) break;
            const ratings = profRatingsResponse.ratings as BasicRating[];
            console.log(ratings);

            // Create mapping of prof names to ratings
            const profRatingsMap: Record<string, BasicRating> = {};
            for (let i = 0; i < ratings.length; ++i) {
                if (ratings[i] == null) continue;
                profRatingsMap[profNames[i]] = ratings[i];
            }

            // Add ratings to table
            for (const row of rows.values()) {
                const nameCol = row.children[5] as HTMLTableColElement;
                const name = nameCol.innerText.trim();
                if (!name || name == 'To be Announced') continue;

                const rmpLink = document.createElement('a');
                rmpLink.target = '_blank';

                if (name in profRatingsMap) {
                    const rating = profRatingsMap[name];
                    rmpLink.innerHTML = `(Rating <b>${rating.avgRating}/5.0</b>, Difficulty <b>${rating.avgDifficulty}/5.0</b>)`;
                    const id = parseInt(atob(rating.id).slice(8));
                    rmpLink.href = `https://www.ratemyprofessors.com/professor/${id}`;
                } else {
                    rmpLink.innerText = '(No rating found)';
                    const params = new URLSearchParams({ q: name });
                    const searchUrl = `https://www.ratemyprofessors.com/search/professors/1452?${params.toString()}`;
                    rmpLink.href = searchUrl;
                }

                nameCol.appendChild(rmpLink);

            }
        } break;
    }
})();
