"""Functions to interact with the OpenAI API."""

from openai import AsyncOpenAI
from openai.types.chat import ChatCompletionMessageParam

import base64
from collections.abc import Iterable
import json
from typing import Literal, TypedDict

from .rmp import ProfessorRating, ProfessorInfo


def prof_info_to_json(
    *,
    info: ProfessorInfo,
    course: str,
    course_display: str,
):
    numerical_id = base64.b64decode(info["id"]).decode()[8:]
    source_url = f"https://www.ratemyprofessors.com/professor/{numerical_id}"

    prompt_comments = map(lambda edge: edge["node"], info["ratings"]["edges"])

    return {
        "source": {
            "site_name": "Rate My Professors",
            "site_url": source_url,
        },
        "professor": {
            "name": info["firstName"] + " " + info["lastName"],
            "avg_rating": info["avgRating"],
            "avg_difficulty": info["avgDifficulty"],
            "would_take_again": f"{info['wouldTakeAgainPercent']:.2f}%",
        },
        "course": {
            "code": course,
            "display_name": course_display,
        },
        "user_feedback": list(prompt_comments),
    }


def create_prof_feedback_prompt(
    *,
    info: ProfessorInfo,
    course: str,
    course_display: str,
) -> list[ChatCompletionMessageParam]:
    return [
        {
            "role": "system",
            "content": (
                "You are an assistant designed to help users get information on their professors at the University of Ottawa. "
                "The following is information on a particular professor. "
                "Answer any questions that a user may have about this professor.\n\n"
                "If a user asks where the data came from, or for this professor's page, you should provide the full `siteUrl` key. "
                "You are NOT to provide this URL unless EXPLICITLY ASKED."
            ),
        },
        {
            "role": "system",
            "content": json.dumps(
                prof_info_to_json(
                    info=info,
                    course=course,
                    course_display=course_display,
                ),
                indent=0,
            ),
        },
    ]


def create_multi_prof_identification_prompt(
    *,
    available_professors: Iterable[str],
) -> list[ChatCompletionMessageParam]:
    names = {"professors": list(available_professors)}
    return [
        {
            "role": "system",
            "content": (
                "You are going to be given a list of professor names. After this, a user prompt will be provided. "
                "Your task is to determine which of the listed professors are relevant to the user's query. "
                "If a user specifies a specific professor or professors, return only their names. "
                "If a user requests information on all professors, return all professors' names. "
                "If a user requests a professor that is not listed, simply ignore that request.\n\n"
                "Your response should be a list of strings in a JSON key called `professors`. "
                "NAMES MUST BE EXACT!! If a user specifies only part of a professor's name, insert the FULL NAME of the closest professor. "
                "If there are multiple professors with a similar name, include ALL OF THEM."
            ),
        },
        {
            "role": "system",
            "content": json.dumps(names, indent=0),
        },
    ]


async def identify_referenced_profs(
    *,
    client: AsyncOpenAI,
    model: str,
    available_professors: dict[str, str],
    prompt: str,
) -> list[str]:
    """Given a list of professors and a user prompt, identifies which professors
    are relevant to the user's query.

    Args:
        available_professors: A mapping of professor IDs (keys) to professor names (values).
        prompt: The user's prompt.

    Raises:

        JSONDecodeError: The AI's response was not valid JSON.
        TypeError: The AI returned an unexpected JSON format (eg. invalid key), or had no response at all.
        ValueError: The AI returned professor data that made no sense.
    Returns: The IDs of the relevant professors.
    """
    response = await client.chat.completions.create(
        messages=create_multi_prof_identification_prompt(
            available_professors=available_professors.keys()
        )
        + [{"role": "user", "content": prompt}],
        model=model,
        temperature=0.5,
        max_tokens=128,
        response_format={"type": "json_object"},
    )
    response_text = response.choices[0].message.content
    if not response_text:
        raise TypeError("AI did not return a response.")

    # Check that proper keys exist on response object
    parsed = json.loads(response_text)
    if "professors" not in parsed:
        raise TypeError("Missing professors key in response.")
    professors = parsed["professors"]
    if not isinstance(professors, list):
        raise TypeError("professors key is not a list.")

    # Ensure that all listed professors are valid
    professor_ids: list[str] = []
    for professor in professors:
        try:
            professor_ids.append(available_professors[professor])
        except KeyError:
            raise ValueError("AI returned an invalid professor.")

    # If no professor ids were returned by the model, use all professors
    return professor_ids or list(available_professors.values())


class MultiProfContext(TypedDict):
    info: ProfessorInfo
    course: str
    course_display: str


def create_multi_prof_feedback_prompt(
    *,
    info: Iterable[MultiProfContext],
) -> list[ChatCompletionMessageParam]:
    professor_list = {
        "professors": list(
            map(
                lambda data: prof_info_to_json(
                    info=data["info"],
                    course=data["course"],
                    course_display=data["course_display"],
                ),
                info,
            ),
        )
    }

    return [
        {
            "role": "system",
            "content": (
                "You are an assistant designed to help users get information on their professors at the University of Ottawa. "
                "The following is a collection of information about various professors. "
                "Answer any questions that a user may have about these professors.\n\n"
                "If a user asks where the data came from, or for any professor's page, you should provide the full `siteUrl` key for any relevant professors. "
                "You are NOT to provide these URL unless EXPLICITLY ASKED."
            ),
        },
        {
            "role": "system",
            "content": json.dumps(professor_list, indent=0),
        },
    ]


async def generate_stream(
    *,
    client: AsyncOpenAI,
    model: str,
    messages: Iterable[ChatCompletionMessageParam],
):
    stream = await client.chat.completions.create(
        messages=messages,
        model=model,
        temperature=0.5,
        stream=True,
        max_tokens=1024,
    )
    async for chunk in stream:
        content = chunk.choices[0].delta.content
        if content is not None:
            yield content
