"""Functions to interact with the OpenAI API."""

from openai import AsyncOpenAI
from openai.types.chat import ChatCompletionMessageParam

import base64
from collections.abc import Iterable
from typing import Literal

from .rmp import ProfessorRating, ProfessorInfo


def format_feedback_for_prompt(feedback: dict[Literal["node"], ProfessorRating]) -> str:
    node = feedback["node"]
    return f"""<userFeedback>
<clarityRating>{node['clarityRating']}/5.0</clarityRating>
<difficultyRating>{node['difficultyRating']}/5.0</difficultyRating>
<helpfulRating>{node['helpfulRating']}/5.0</helpfulRating>
<comment>{node['comment']}</comment>
</userFeedback>"""


def prof_info_to_xml(
    *, id: str, info: ProfessorInfo, course: str, course_display: str
) -> str:
    numerical_id = base64.b64decode(id).decode()[8:]
    source_url = f"https://www.ratemyprofessors.com/professor/{numerical_id}"

    prompt_comments = "\n".join(
        map(format_feedback_for_prompt, info["ratings"]["edges"])
    )

    return f"""<dataSourceSection>
<siteName>Rate My Professors</siteName>
<siteUrl>{source_url}</siteUrl>
</dataSourceSection>
<professorDetailsSection>
<professorName>{info['firstName']} {info['lastName']}</professorName>
<avgRating>{info['avgRating']}</avgRating>
<avgDifficulty>{info['avgDifficulty']}</avgDifficulty>
<wouldTakeAgainPercent>{info['wouldTakeAgainPercent']:.2f}<wouldTakeAgainPercent>
</professorDetailsSection>
<courseDetailsSection>
<courseCode>{course}</courseCode>
<courseDisplayName>{course_display}</courseDisplayName>
</courseDetailsSection>
<userFeedbackSection>
{prompt_comments}
</userFeedbackSection>"""


def create_prof_feedback_prompt(
    *,
    id: str,
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
                "If a user asks where the data came from, or for this professor's page, you should provide the full `siteUrl` key."
            ),
        },
        {
            "role": "system",
            "content": prof_info_to_xml(
                id=id, info=info, course=course, course_display=course_display
            ),
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
        max_tokens=1000,
    )
    async for chunk in stream:
        content = chunk.choices[0].delta.content
        if content is not None:
            yield content
