export async function onRequest(context) {
    const { results } = await context.env.ARKNIGHTS_DB
        .prepare('SELECT id, name_en FROM recruitment_tags')
        .all();

    return new Response(JSON.stringify(results), {
        headers: { 'Content-Type': 'application/json' }
    });
}