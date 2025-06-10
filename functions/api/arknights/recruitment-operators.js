export async function onRequest(context) {
  try {

    const { request, env } = context;
    const url = new URL(request.url);

    const db = env.ARKNIGHTS_DB;

    const raw = url.searchParams.get('tag_ids');
    const match = url.searchParams.get('match') || 'all';
    const tagIds = raw ? raw.split(',').map(id => parseInt(id)) : [];

    if (tagIds.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No tag IDs provided.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const placeholders = tagIds.map(() => '?').join(', ');
    let sql
    let bindArgs;

    if (match === 'any') {
      sql = `SELECT DISTINCT c.* FROM operators c JOIN operators_tags ct ON c.id = ct.operator_id WHERE ct.tag_id IN (${placeholders})`;
      bindArgs = tagIds;
    } else {
      sql = `SELECT c.* FROM operators c JOIN operators_tags ct ON c.id = ct.operator_id WHERE ct.tag_id IN (${placeholders}) GROUP BY c.id HAVING COUNT(DISTINCT ct.tag_id) = ?`;
      bindArgs = [...tagIds, tagIds.length];
    }

    const { results } = await db.prepare(sql).bind(...bindArgs).all();
    return new Response(JSON.stringify(results), {
      headers: { "Content-Type": "application/json" }
    });


  } catch (err) {
      return new Response(
        JSON.stringify({ error: 'Failed to process JSON.', details: err.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
}