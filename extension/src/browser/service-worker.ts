/// <reference lib="webworker" />
import { EventType, type ExtensionEvent } from "./messaging.js";
import { bulkCreateEvents } from "../utils/google.js";
import {
    findProfsByName,
    getBasicRatings,
    type BasicRating,
    type Professor,
} from "../utils/rmp.js";

chrome.runtime.onMessage.addListener((message: ExtensionEvent, _sender, sendResponse) => {
    (async () => {
        console.log("Got message:", message);
        switch (message.event) {
            case EventType.GoogleCalendarList:
                {
                    console.log("Received request to get Google Calendar list");

                    let token: chrome.identity.GetAuthTokenResult;
                    try {
                        token = await chrome.identity.getAuthToken({ interactive: false });
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
                        if (response.items) sendResponse({ success: true, calendars: response.items });
                        else throw new Error('Problem getting calendar list');
                    } catch (e) {
                        console.error("Failed to send request", e);
                        sendResponse({ success: false });
                        return;
                    }
                }
                break;
            case EventType.GooglePush:
                {
                    console.log("Received request to sync to Google Calendar");
                    const { googleCalendarId } = await chrome.storage.local.get('googleCalendarId');
                    if (googleCalendarId == null) {
                        console.error('No calendar ID specified');
                        sendResponse({ success: false });
                        return;
                    }

                    let token: chrome.identity.GetAuthTokenResult;
                    try {
                        token = await chrome.identity.getAuthToken({ interactive: false });
                        if (!token.token) throw new Error("Didn't receive token from Chrome");
                    } catch (e) {
                        console.error("Failed to get auth token", e);
                        sendResponse({ success: false });
                        return;
                    }
                    console.log("Authorization received");

                    try {
                        await bulkCreateEvents(token.token, googleCalendarId, message.classes);
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
                    let professorEntries: Array<Professor | null>;
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
                            if (!professor) return null;
                            if (`${professor.firstName} ${professor.lastName}`.toLowerCase() != message.names[i].toLowerCase())
                                return null;
                            return i;
                        })
                        .filter(i => i != null);

                    if (validIndices.length === 0) {
                        sendResponse({
                            success: true,
                            ratings: Array(professorEntries.length).fill(null),
                        });
                        return;
                    }

                    const profsToRequest = professorEntries
                        .filter((_, i) => validIndices.includes(i))
                        .map(professor => professor!.id);

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
