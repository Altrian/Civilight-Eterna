export async function onRequestPost(context) {
    try {
      const data = await context.request.json();
  
      if (!(data?.tags.data || data?.recruitment_list.data) || !Array.isArray(data.tags.data)) {
        return new Response(
          JSON.stringify({ error: 'Invalid JSON format: expected data array from tags.' }),
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

      const createTables = [
        db.exec(`CREATE TABLE IF NOT EXISTS operators (id TEXT PRIMARY KEY, appellation TEXT, name_zh TEXT, name_ja TEXT, name_en TEXT, rarity TEXT, profession TEXT, subProfessionId TEXT, IsRecruitOnly BOOLEAN, tags TEXT)`),
        db.exec(`CREATE TABLE IF NOT EXISTS recruitment_tags (id INTEGER PRIMARY KEY, name_zh TEXT, name_en TEXT, name_jp TEXT)`),
        db.exec(`CREATE TABLE IF NOT EXISTS operators_tags (operator_id TEXT, tag_id INTEGER, PRIMARY KEY (operator_id, tag_id), FOREIGN KEY (operator_id) REFERENCES operators(id), FOREIGN KEY (tag_id) REFERENCES recruitment_tags(id))`)
      ];

      await Promise.all(createTables);


      const operatorsStmt = db.prepare(`INSERT INTO operators (id, appellation, name_zh, name_ja, name_en, rarity, profession, subProfessionId, IsRecruitOnly, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET appellation = excluded.appellation, name_zh = excluded.name_zh, name_ja = excluded.name_ja, name_en = excluded.name_en, rarity = excluded.rarity, profession = excluded.profession, subProfessionId = excluded.subProfessionId, IsRecruitOnly = excluded.IsRecruitOnly, tags = excluded.tags`);
      const operatorBindings = data.recruitment_list.data.map(operator =>
        operatorsStmt.bind(
          operator.id,
          operator.appellation,
          operator.name_zh,
          operator.name_ja,
          operator.name_en,
          operator.rarity,
          operator.profession,
          operator.subProfessionId,
          operator.IsRecruitOnly,
          JSON.stringify(operator.tags || [])
        )
      );

      await db.batch(operatorBindings);
      
      const tagStmt = db.prepare(`INSERT INTO recruitment_tags (id, name_zh, name_en, name_jp) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name_zh = excluded.name_zh, name_en = excluded.name_en, name_jp = excluded.name_jp`);
      const tagBindings = data.tags.data.map(tag =>
        tagStmt.bind(tag.id, tag.name_zh, tag.name_en, tag.name_jp)
      )
      
      await db.batch(tagBindings);

      const operatorTagStmt = db.prepare(`INSERT OR IGNORE INTO operators_tags (operator_id, tag_id) VALUES (?, ?) ON CONFLICT(operator_id, tag_id) DO NOTHING`);
      const operatorTagBindings = data.recruitment_list.data.map(operator =>
        [...new Set(operator.tags)].map(tagId =>
          operatorTagStmt.bind(operator.id, tagId)
        )
      ).flat()

      await db.batch(operatorTagBindings);
  
  
      return new Response(
        JSON.stringify({ status: 'Tags populated successfully.', count: data.tags.data.length }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    } catch (err) {
      return new Response(
        JSON.stringify({ error: 'Failed to process JSON.', details: err.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }
  