"""Wrappers around Rate My Professors APIs."""

from collections.abc import Iterable
import aiohttp

import base64
import json
from typing import Any, Literal, TypedDict

from aiohttp.abc import IterableBase

ENDPOINT = "https://www.ratemyprofessors.com/graphql"
AUTH = f"Basic {base64.b64encode('test:test'.encode('utf-8')).decode()}"
SCHOOL_ID = base64.b64encode("School-1452".encode("utf-8")).decode()


class ProfessorRating(TypedDict):
    helpfulRating: float
    difficultyRating: float
    clarityRating: float
    comment: str


RawRatings = dict[Literal["edges"], list[dict[Literal["node"], ProfessorRating]]]


class ProfessorInfo(TypedDict):
    id: str
    firstName: str
    lastName: str
    avgRating: float
    avgDifficulty: float
    wouldTakeAgainPercent: float
    ratings: RawRatings


class BasicProfessorInfo(TypedDict):
    firstName: str
    lastName: str


def create_multi_basic_info_graphql_query(*, ids: Iterable[str]):
    requests_list: list[str] = []
    for i, id in enumerate(ids):
        requests_list.append(
            f"p{i}: node(id: {json.dumps(id)}) {{ ... on Teacher {{ firstName lastName }} }}"
        )
    requests = "\n".join(requests_list)
    return f"query {{ {requests} }}"


def create_multi_info_graphql_query(
    *,
    ids: Iterable[str],
    ratings: int,
):
    requests_list: list[str] = []
    for i, id in enumerate(ids):
        requests_list.append(
            f"p{i}: node(id: {json.dumps(id)}) {{ ... on Teacher {{ id firstName lastName avgRating avgDifficulty wouldTakeAgainPercent ratings(first: {ratings}) {{ edges {{ node {{ comment helpfulRating difficultyRating clarityRating }} }} }} }} }}"
        )
    requests = "\n".join(requests_list)
    return f"query {{ {requests} }}"


def create_info_graphql_query(
    *,
    id: str,
    course: str | None,
    ratings: int = 25,
):
    course_filter = (
        f", courseFilter: {json.dumps(course)}" if course is not None else ""
    )
    return f"""query {{ node(id: {json.dumps(id)} ) {{ ... on Teacher {{ id firstName lastName avgRating avgDifficulty wouldTakeAgainPercent ratings(first: {ratings}{course_filter}) {{ edges {{ node {{ comment helpfulRating difficultyRating clarityRating }} }} }} }} }}  }}"""


async def get_professor_info(
    *,
    client: aiohttp.ClientSession,
    id: str,
    course: str,
) -> ProfessorInfo | None:
    r = await client.post(
        ENDPOINT,
        headers={
            "Accept": "*/*",
            "Authorization": AUTH,
            "Access-Control-Allow-Origin": "*",
            "Content-Type": "application/json",
        },
        json={"query": create_info_graphql_query(id=id, course=course)},
    )
    response: dict[Any, Any] = await r.json()
    if "errors" in response:
        return None
    ratings: list[Any] = response["data"]["node"]["ratings"]["edges"]
    if len(ratings) == 0:
        # Do request without course filter
        r = await client.post(
            ENDPOINT,
            headers={
                "Accept": "*/*",
                "Authorization": AUTH,
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "application/json",
            },
            json={"query": create_info_graphql_query(id=id, course=None)},
        )
        response = await r.json()
        if "errors" in response:
            return None

    return response["data"]["node"]


async def get_multi_basic_info(
    *,
    client: aiohttp.ClientSession,
    ids: Iterable[str],
) -> Iterable[BasicProfessorInfo] | None:
    r = await client.post(
        ENDPOINT,
        headers={
            "Accept": "*/*",
            "Authorization": AUTH,
            "Access-Control-Allow-Origin": "*",
            "Content-Type": "application/json",
        },
        json={"query": create_multi_basic_info_graphql_query(ids=ids)},
    )
    response: dict[Any, Any] = await r.json()
    if "errors" in response:
        return None

    data = list(map(lambda pair: (int(pair[0][1:]), pair[1]), response["data"].items()))
    data.sort()
    return map(lambda pair: pair[1], data)


async def get_multi_info(
    *,
    client: aiohttp.ClientSession,
    ids: Iterable[str],
) -> Iterable[ProfessorInfo] | None:
    ids = list(ids)
    r = await client.post(
        ENDPOINT,
        headers={
            "Accept": "*/*",
            "Authorization": AUTH,
            "Access-Control-Allow-Origin": "*",
            "Content-Type": "application/json",
        },
        json={
            "query": create_multi_info_graphql_query(ids=ids, ratings=25 // len(ids))
        },
    )
    response: dict[Any, Any] = await r.json()
    if "errors" in response:
        return None

    data = list(map(lambda pair: (int(pair[0][1:]), pair[1]), response["data"].items()))
    data.sort()
    return map(lambda pair: pair[1], data)
