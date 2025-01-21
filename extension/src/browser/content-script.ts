import { marked } from "marked";
import DOMPurify from "dompurify";

import {
    ExtensionEventType,
    IncomingExtensionEventType,
    type ExtensionEvent,
    type IncomingExtensionEvent,
} from "./messaging.js";
import { CurrentPage, identifyPage } from "./page-info.js";
import { classToEvents } from "../utils/export-classes.js";
import { createEvents } from "../utils/ics.js";
import type { BasicRating } from "../utils/rmp.js";
import type { Options } from "../stores.js";

type MessageListener = Parameters<(typeof chrome)["runtime"]["onMessage"]["addListener"]>[0];

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
        event: ExtensionEventType.RmpBasicMulti,
        names: profNames,
    });
    if (!profRatingsResponse.success) return null;
    const ratings = profRatingsResponse.ratings as BasicRating[];
    const ids = profRatingsResponse.ids as string[];

    // Create mapping of prof names to ratings
    const profRatingsMap: Record<string, BasicRating> = {};
    const profIdsMap: Record<string, string> = {};
    for (let i = 0; i < ratings.length; ++i) {
        if (ratings[i] == null) continue;
        profRatingsMap[profNames[i]] = ratings[i];
        profIdsMap[profNames[i]] = ids[i];
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

    return [profRatingsMap, profIdsMap] as const;
}

/**
 * Create the dialog used to communicate with the AI.
 * @param chromeListener The event listener for streamed responses. Used to kill the listener once the dialog is closed
 */
function createAiDialog(): [
    HTMLDialogElement,
    HTMLButtonElement,
    HTMLParagraphElement,
    HTMLInputElement,
    (chromeListener: MessageListener) => void,
] {
    const dialog = document.createElement("dialog");
    dialog.style.textAlign = "center";
    dialog.style.width = "400px";
    dialog.style.height = "600px";
    dialog.style.display = "flex";
    dialog.style.flexDirection = "column";
    dialog.style.justifyContent = "space-between";

    const title = document.createElement("h1");
    title.innerText = "Ask AI";
    dialog.appendChild(title);

    const response = document.createElement("p");
    response.style.height = "100%";
    response.style.textAlign = "left";
    response.style.overflowY = "scroll";
    dialog.appendChild(response);

    const inputContainer = document.createElement("div");
    inputContainer.style.display = "flex";
    dialog.appendChild(inputContainer);

    const submitButton = document.createElement("button");
    submitButton.type = "button";
    submitButton.innerText = "Ask";

    const promptInput = document.createElement("input");
    promptInput.type = "text";
    promptInput.style.width = "100%";
    promptInput.addEventListener("keyup", ev => {
        if (ev.key === "Enter") submitButton.click();
    });

    inputContainer.appendChild(promptInput);
    inputContainer.appendChild(submitButton);

    document.body.appendChild(dialog);

    return [
        dialog,
        submitButton,
        response,
        promptInput,
        chromeListener => {
            dialog.addEventListener(
                "close",
                () => {
                    dialog.remove();
                    chrome.runtime.onMessage.removeListener(chromeListener);
                },
                { once: true },
            );
        },
    ];
}

const unknownObserver = new MutationObserver(main);

function createAiStreamListener(
    responseArea: HTMLElement,
    input: HTMLInputElement,
    aiButton: HTMLButtonElement,
) {
    let responseRaw = "";
    // Set up listener for stream response
    const listener = (async (message: IncomingExtensionEvent) => {
        switch (message.event) {
            case IncomingExtensionEventType.ProfessorAiStreamStart:
                // Reset response area
                responseArea.innerText = responseRaw;
                // Clear user input
                input.value = "";
                break;
            case IncomingExtensionEventType.ProfessorAiStreamChunk:
                responseRaw += message.delta;
                // It seems quite inefficient to re-process the whole stream for every chunk, but it doesn't cause
                // any noticeable lag so seems fine
                responseArea.innerHTML = DOMPurify.sanitize(await marked(responseRaw));
                // Make sure that any link tags open in a new tab
                for (const anchor of responseArea.getElementsByTagName("a"))
                    anchor.target = "_blank";
                break;
            case IncomingExtensionEventType.ProfessorAiStreamEnd:
                aiButton.disabled = false;
                responseRaw = "";
                break;
            case IncomingExtensionEventType.ProfessorAiStreamFail:
                console.error("Error getting AI completion:", message.reason);
                responseArea.innerHTML =
                    '<span style="color: red;">Failed to get AI response</span>';
                aiButton.disabled = false;
                break;
        }
    }) satisfies MessageListener;
    return listener;
}

async function main() {
    const page = identifyPage();
    const options = (await chrome.storage.local.get([
        "rmp",
        "rmpAiFeedback",
        "calendarExport",
        "calendarAutoRefresh",
    ] satisfies Array<keyof Options>)) as Options;

    if (page.page !== CurrentPage.Unknown) unknownObserver.disconnect();
    else if (page.page === CurrentPage.Unknown)
        unknownObserver.observe(document.body, { attributes: true, childList: true });

    switch (page.page) {
        case CurrentPage.ClassSchedule:
            {
                // Stop weird behaviour when certain keys are pressed
                document.addEventListener(
                    "keydown",
                    ev => {
                        if (ev.key === "Escape" || ev.key === "Enter")
                            ev.stopImmediatePropagation();
                    },
                    { capture: true },
                );

                // Add specialized listener in case this page is overwritten
                const observer = new MutationObserver(mutationList => {
                    // This is the only thing I could find that reliably triggered a rerender at the right time
                    if (mutationList.length === 3) {
                        observer.disconnect();
                        main();
                    }
                });
                // For whatever reason, a style is added while the page is refreshing and then removed when it's done.
                // This can be used to identify when the page is done refreshing
                observer.observe(document.body, { attributes: true, attributeFilter: ["style"] });

                // =======================
                // Calendar Export Buttons
                // =======================
                if (options.calendarExport) {
                    const row =
                        document.querySelector<HTMLTableRowElement>("tr[id*=trCLASS_MTG_VW]");
                    const parentDiv =
                        // @ts-expect-error Trust these elements exist
                        row.parentElement.parentElement.parentElement.parentElement.parentElement
                            .parentElement.parentElement.parentElement.parentElement.parentElement
                            .parentElement.parentElement.parentElement.parentElement.parentElement
                            .parentElement.parentElement.parentElement.parentElement.parentElement
                            .parentElement;
                    const btnContainer = document.createElement("div");
                    parentDiv!.prepend(btnContainer);

                    const calendarHeading = document.createElement("h2");
                    calendarHeading.style.margin = "0";
                    calendarHeading.innerText = "Calendar";
                    btnContainer.appendChild(calendarHeading);

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
                    googleCalButton.onclick = async () => {
                        await chrome.runtime.sendMessage<ExtensionEvent>({
                            event: ExtensionEventType.GooglePush,
                            classes: page.classes,
                        });
                    };

                    btnContainer.append(icsButton);
                    btnContainer.append(googleCalButton);
                }

                // ===============
                // RMP Integration
                // ===============
                if (options.rmp) {
                    const rows =
                        document.querySelectorAll<HTMLTableRowElement>("tr[id*=trCLASS_MTG_VW]");
                    const rmpResponse = await addRmp(() => rows.values(), 5, false);
                    if (rmpResponse != null) {
                        // ===========
                        // RMP AI Chat
                        // ===========
                        if (options.rmpAiFeedback) {
                            // For the multi-professor API
                            const multiProfessorInfo: Array<
                                Record<"id" | "course" | "course_display", string>
                            > = [];

                            const ids = rmpResponse[1];
                            for (const row of rows.values()) {
                                const name = (
                                    (row.children[5] as HTMLTableColElement)
                                        .children[0] as HTMLDivElement
                                ).innerText;
                                if (name && name in ids) {
                                    // prettier-ignore
                                    const classParent: string =
                                        // @ts-expect-error Trust these elements exist
                                        row.parentElement.parentElement.parentElement.parentElement
                                            .parentElement.parentElement.parentElement.parentElement
                                            .parentElement.parentElement.parentElement.parentElement
                                            // @ts-expect-error Trust these elements exist
                                            .parentElement.parentElement.children[0].innerText;
                                    const [courseCode, courseName] = classParent.split(" - ");
                                    // For the multi-professor API
                                    multiProfessorInfo.push({
                                        id: ids[name],
                                        course: courseCode,
                                        course_display: courseName,
                                    });

                                    // Professor-scoped AI chat
                                    const aiButton = document.createElement("button");
                                    aiButton.type = "button";
                                    aiButton.style.width = "100%";
                                    aiButton.innerText = "Ask AI";
                                    aiButton.onclick = async () => {
                                        const [
                                            dialog,
                                            sendButton,
                                            responseArea,
                                            input,
                                            registerListener,
                                        ] = createAiDialog();

                                        const listener = createAiStreamListener(
                                            responseArea,
                                            input,
                                            aiButton,
                                        );
                                        chrome.runtime.onMessage.addListener(listener);
                                        registerListener(listener);

                                        sendButton.addEventListener("click", async () => {
                                            if (input.value.trim().length === 0) return;
                                            responseArea.innerHTML =
                                                '<span style="color: gray;">Waiting for response...</span>';

                                            const response =
                                                await chrome.runtime.sendMessage<ExtensionEvent>({
                                                    event: ExtensionEventType.ProfessorAiCompletion,
                                                    courseCode: courseCode.replaceAll(" ", ""),
                                                    courseName,
                                                    professorId: ids[name],
                                                    prompt: input.value.trim(),
                                                });

                                            if (!response.success) {
                                                console.error(
                                                    "Unsuccessful response from service worker",
                                                    response,
                                                );
                                                responseArea.innerHTML =
                                                    '<span style="color: red;">Failed to communicate with backend</span>';
                                                return;
                                            }
                                        });
                                        dialog.showModal();
                                    };
                                    row.children[5].appendChild(aiButton);
                                }
                            }

                            // Create multi professor chat button
                            const row =
                                document.querySelector<HTMLTableRowElement>(
                                    "tr[id*=trCLASS_MTG_VW]",
                                );
                            const parentDiv =
                                // @ts-expect-error Trust these elements exist
                                row.parentElement.parentElement.parentElement.parentElement
                                    .parentElement.parentElement.parentElement.parentElement
                                    .parentElement.parentElement.parentElement.parentElement
                                    .parentElement.parentElement.parentElement.parentElement
                                    .parentElement.parentElement.parentElement.parentElement
                                    .parentElement;

                            const multiAiContainer = document.createElement("div");
                            parentDiv!.prepend(multiAiContainer);

                            const multiAiHeading = document.createElement("h2");
                            multiAiHeading.style.margin = "0";
                            multiAiHeading.innerText = "Multi-Professor AI";
                            multiAiContainer.appendChild(multiAiHeading);

                            const multiAiButton = document.createElement("button");
                            multiAiButton.type = "button";
                            multiAiButton.style.width = "100%";
                            multiAiButton.innerText = "Ask AI";
                            multiAiContainer.appendChild(multiAiButton);

                            multiAiButton.onclick = async () => {
                                const [dialog, sendButton, responseArea, input, registerListener] =
                                    createAiDialog();

                                const listener = createAiStreamListener(
                                    responseArea,
                                    input,
                                    multiAiButton,
                                );
                                chrome.runtime.onMessage.addListener(listener);
                                registerListener(listener);

                                sendButton.addEventListener("click", async () => {
                                    if (input.value.trim().length === 0) return;
                                    responseArea.innerHTML =
                                        '<span style="color: gray;">Waiting for response...</span>';

                                    console.log("Going to send request with", multiProfessorInfo);

                                    const response =
                                        await chrome.runtime.sendMessage<ExtensionEvent>({
                                            event: ExtensionEventType.MultiProfessorAiCompletion,
                                            professors: multiProfessorInfo,
                                            prompt: input.value.trim(),
                                        });

                                    if (!response.success) {
                                        console.error(
                                            "Unsuccessful response from service worker",
                                            response,
                                        );
                                        responseArea.innerHTML =
                                            '<span style="color: red;">Failed to communicate with backend</span>';
                                        return;
                                    }
                                });
                                dialog.showModal();
                            };
                        }
                    }
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
}

main();
