/// <reference lib="webworker" />
import { EventType, type ExtensionEvent } from "./messaging.js";
import { bulkCreateEvents } from "../utils/google.js";
import {
    findProfsByName,
    getBasicRatings,
    type BasicRating,
    type Professor,
} from "../utils/rmp.js";

chrome.runtime.onMessage.addListener((message: ExtensionEvent, sender, sendResponse) => {
    (async () => {
        console.log("Got message:", message);
        switch (message.event) {
            case EventType.GoogleSync:
                {
                    console.log("Received request to sync to Google Calendar");

                    let token: chrome.identity.GetAuthTokenResult;
                    try {
                        token = await chrome.identity.getAuthToken({ interactive: true });
                        if (!token.token) throw new Error("Didn't receive token from Chrome");
                    } catch (e) {
                        console.error("Failed to get auth token", e);
                        sendResponse({ success: false });
                        return;
                    }
                    console.log("Authorization received");

                    try {
                        const response = await fetch(
                            "https://www.googleapis.com/calendar/v3/users/me/calendarList",
                            {
                                headers: {
                                    Authorization: `Bearer ${token.token}`,
                                },
                            },
                        ).then(r => r.json());

                        await bulkCreateEvents(token.token, "placeholder", message.classes);
                    } catch (e) {
                        console.error("Failed to send request", e);
                        sendResponse({ success: false });
                        return;
                    }
                    console.log("Successfully synced to calendar");
                    sendResponse({ success: true });
                }
                break;
            case EventType.RmpBasicMulti:
                {
                    // Try to find professors by name
                    let professorEntries: Professor[];
                    try {
                        professorEntries = await findProfsByName(message.names);
                    } catch (e) {
                        console.error("Failed to query RMP for professors by name", e);
                        sendResponse({ success: false });
                        return;
                    }

                    // Only include professors whose names are an exact match
                    const validIndices = professorEntries
                        .map((professor, i) => {
                            if (`${professor.firstName} ${professor.lastName}` != message.names[i])
                                return null;
                            return i;
                        })
                        .filter(i => i != null);

                    if (validIndices.length === 0) {
                        sendResponse({ success: true, ratings: Array(professorEntries.length).fill(null) });
                        return;
                    }

                    const profsToRequest = professorEntries
                        .filter((_, i) => validIndices.includes(i))
                        .map(professor => professor.id);

                    let professorRatingsUnmapped: BasicRating[];
                    try {
                        professorRatingsUnmapped = await getBasicRatings(profsToRequest);
                    } catch (e) {
                        console.error("Failed to query RMP for valid professor IDs", e);
                        sendResponse({ success: false });
                        return;
                    }

                    // Re-align the professors whose ratings we could find with the professorEntries array
                    const professorRatings = Array(professorEntries.length).fill(null);
                    for (let i = 0; i < professorRatingsUnmapped.length; ++i) {
                        professorRatings[validIndices[i]] = professorRatingsUnmapped[i];
                    }

                    // Finally, send data back
                    sendResponse({ success: true, ratings: professorRatings });
                }
                break;
            default:
                sendResponse({ success: false });
        }
    })();
    return true;
});
