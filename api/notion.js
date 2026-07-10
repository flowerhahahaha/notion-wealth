export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const API_KEY = process.env.NOTION_API_KEY;
    const DB_ID = process.env.NOTION_DATABASE_ID;

    if (!API_KEY || !DB_ID) {
        return res.status(500).json({ error: 'Missing Notion credentials' });
    }

    const NOTION_API = 'https://api.notion.com/v1';
    const headers = {
        'Authorization': `Bearer ${API_KEY}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
    };

    try {
        // GET → 查询
        if (req.method === 'GET') {
            const response = await fetch(`${NOTION_API}/databases/${DB_ID}/query`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    sorts: [{ property: 'Date', direction: 'descending' }]
                })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Query failed');

            const results = data.results.map(page => {
                const p = page.properties;
                return {
                    id: page.id,
                    日期: p.Date?.date?.start || '',
                    金额: p.金额?.number || 0,
                    类别: p.类别?.select?.name || '',
                    收支类型: p.收支类型?.select?.name || '',
                    账户: p.账户?.select?.name || '',
                    备注: p.备注?.rich_text?.[0]?.plain_text || '',
                };
            });
            return res.status(200).json({ results });
        }

        // POST → 写入
        if (req.method === 'POST') {
            const { date, amount, type, category, account, note } = req.body;

            if (!date || !amount || !type || !category || !account) {
                return res.status(400).json({ error: 'Missing required fields' });
            }

            const response = await fetch(`${NOTION_API}/pages`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    parent: { database_id: DB_ID },
                    properties: {
                        'Date': { date: { start: date } },
                        '金额': { number: amount },
                        '收支类型': { select: { name: type } },
                        '类别': { select: { name: category } },
                        '账户': { select: { name: account } },
                        '备注': { rich_text: note ? [{ type: 'text', text: { content: note } }] : [] },
                    }
                })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Create failed');

            return res.status(200).json({ success: true, id: data.id });
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (error) {
        console.error('Notion API Error:', error);
        return res.status(500).json({ error: error.message || 'Server error' });
    }
}
