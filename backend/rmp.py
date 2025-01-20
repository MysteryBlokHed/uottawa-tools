"""Wrappers around Rate My Professors APIs."""

from typing import Any, Literal, TypedDict
import requests

import base64
import json

ENDPOINT = "https://www.ratemyprofessors.com/graphql"
AUTH = f"Basic {base64.b64encode('test:test'.encode('utf-8')).decode()}"
SCHOOL_ID = base64.b64encode("School-1452".encode("utf-8")).decode()


class ProfessorRating(TypedDict):
    helpfulRating: float
    difficultyRating: float
    clarityRating: float
    comment: str


class ProfessorInfo(TypedDict):
    firstName: str
    lastName: str
    avgRating: float
    avgDifficulty: float
    ratings: dict[Literal["edges"], list[dict[Literal["node"], ProfessorRating]]]


def create_graphql_query(*, id: str, course: str | None):
    course_filter = (
        f", courseFilter: {json.dumps(course)}" if course is not None else ""
    )
    return f"""query {{ node(id: {json.dumps(id)} ) {{ ... on Teacher {{ firstName lastName avgRating avgDifficulty ratings(first: 25{course_filter}) {{ edges {{ node {{ comment helpfulRating difficultyRating clarityRating }} }} }} }} }}  }}"""


def get_professor_info(id: str, course: str) -> ProfessorInfo | None:
    r = requests.post(
        ENDPOINT,
        headers={
            "Accept": "*/*",
            "Authorization": AUTH,
            "Access-Control-Allow-Origin": "*",
            "Content-Type": "application/json",
        },
        json={"query": create_graphql_query(id=id, course=course)},
    )
    response = r.json()
    if "errors" in response:
        return None
    ratings: list[Any] = response["data"]["node"]["ratings"]["edges"]
    if len(ratings) == 0:
        # Do request without course filter
        r = requests.post(
            ENDPOINT,
            headers={
                "Accept": "*/*",
                "Authorization": AUTH,
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "application/json",
            },
            json={"query": create_graphql_query(id=id, course=None)},
        )
        response = r.json()
        if "errors" in response:
            return None

    return response["data"]["node"]
