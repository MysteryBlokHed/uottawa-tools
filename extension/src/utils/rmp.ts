const ENDPOINT = "https://www.ratemyprofessors.com/graphql";
// Yes, this is the actual authentication used in RMP prod
const AUTH = `Basic ${btoa("test:test")}`;
const SCHOOL_ID = btoa("School-1452");

export interface Professor {
    firstName: string;
    lastName: string;
    id: string;
    department: string;
}

export interface BasicRating {
    id: string;
    avgRating: number;
    avgDifficulty: number;
}

async function sendQuery(query: string, extra?: any): Promise<unknown> {
    const response = await fetch(ENDPOINT, {
        method: "POST",
        body: JSON.stringify({ query, ...extra }),
        headers: {
            Accept: "*/*",
            Authorization: AUTH,
            "Access-Control-Allow-Origin": "*",
            "Content-Type": "application/json",
        },
    });
    return response.json();
}

export async function findProfsByName(names: readonly string[]): Promise<Array<Professor | null>> {
    const requests = names
        .map(
            (name, i) =>
                `p${i}: newSearch {
    teachers(query: { text: ${JSON.stringify(name)}, schoolID: ${JSON.stringify(SCHOOL_ID)} }, first: 1) {
        edges {
            node {
                id
                firstName
                lastName
                department
            }
        }
    }
}`,
        )
        .join("\n");

    console.log(requests);

    const response = (await sendQuery(`query { ${requests} }`)) as any;
    if (response.errors) throw response.errors;
    // Convert responses into array
    const data = Object.entries(response.data).map(
        ([key, value]) => [parseInt(key.slice(1)), value] as const,
    );
    data.sort(([a], [b]) => a - b);
    console.log("just before bullshit:", data);
    return data.map(
        ([, value]) => (value as any).teachers.edges[0]?.node || null,
    ) as Array<Professor | null>;
}

export async function getBasicRatings(ids: readonly string[]): Promise<BasicRating[]> {
    const requests = ids
        .map(
            (id, i) =>
                `p${i}: node(id: ${JSON.stringify(id)}) {
    ... on Teacher {
        id
        avgRating
        avgDifficulty
    }
}`,
        )
        .join("\n");

    const response = (await sendQuery(`query { ${requests} }`)) as any;
    if (response.errors) throw response.errors;
    // Convert responses into array
    const data = Object.entries(response.data).map(
        ([key, value]) => [parseInt(key.slice(1)), value] as const,
    );
    data.sort(([a], [b]) => a - b);
    return data.map(([, value]) => value as any) as BasicRating[];
}
