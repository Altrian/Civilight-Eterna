export async function onRequest(context) {
    const { results } = await context.env.ARKNIGHTS_DB
        .prepare('SELECT id, tag_name FROM tags')
        .all();

    return new Response(JSON.stringify(results), {
        headers: { 'Content-Type': 'application/json' }
    });
}