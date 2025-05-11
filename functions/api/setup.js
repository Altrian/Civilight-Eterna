export async function onRequestPost(context) {
    try {
      const data = await context.request.json();
  
      if (!data?.gachaTags || !Array.isArray(data.gachaTags)) {
        return new Response(
          JSON.stringify({ error: 'Invalid JSON format: expected gachaTags array.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
  
      const db = context.env.ARKNIGHTS_DB;
      if (!db) {
        return new Response(
          JSON.stringify({ error: 'Database instance is not configured properly.' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
      const insertStmt = db.prepare(`
        INSERT INTO recruitment_tags (id, tag_name)
        VALUES (?, ?)
        ON CONFLICT(id) DO UPDATE SET
          tag_name = excluded.tag_name
      `);
  
      const batch = db.batch(
        data.gachaTags.map(tag =>
          insertStmt.bind(tag.tagId, tag.tagName)
        )
      );
  
      await batch;
  
      return new Response(
        JSON.stringify({ status: 'Tags populated successfully.', count: data.gachaTags.length }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    } catch (err) {
      return new Response(
        JSON.stringify({ error: 'Failed to process JSON.', details: err.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }
  