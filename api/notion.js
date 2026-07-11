// /api/notion.js
// 用原生 fetch，不需要 @notionhq/client

const NOTION_API_KEY = process.env.NOTION_TOKEN;  // ← 改成 NOTION_TOKEN
const DATABASE_ID = process.env.NOTION_DATABASE_ID;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 检查环境变量
  if (!NOTION_API_KEY || !DATABASE_ID) {
    return res.status(500).json({
      success: false,
      error: '环境变量未配置',
      hasApiKey: !!NOTION_API_KEY,
      hasDatabaseId: !!DATABASE_ID,
    });
  }

  try {
    if (req.method === 'GET') {
      const response = await fetch(`https://api.notion.com/v1/databases/${DATABASE_ID}/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${NOTION_API_KEY}`,
          'Content-Type': 'application/json',
          'Notion-Version': '2022-06-28',
        },
        body: JSON.stringify({
          page_size: 100,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return res.status(response.status).json({
          success: false,
          error: data.message || 'Notion API 错误',
          code: data.code,
          details: data,
        });
      }

      const records = (data.results || []).map(page => {
        const p = page.properties || {};
        return {
          id: page.id,
          date: p.Date?.title?.[0]?.plain_text || null,
          amount: p['#金额']?.number || 0,
          type: p['收支类型']?.select?.name || '',
          category: p['大类']?.select?.name || '',
          subcategory: p['小类']?.select?.name || '',
          account: p['账户']?.select?.name || '',
          note: p['备注']?.rich_text?.map(t => t.plain_text).join('') || '',
        };
      }).filter(r => r.date);

      return res.status(200).json({
        success: true,
        data: records,
        total: data.results?.length || 0,
        filtered: records.length,
      });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { date, amount, type, category, subcategory, account, note } = body || {};

      if (!date || !amount || !type) {
        return res.status(400).json({ success: false, error: '缺少必填字段' });
      }

      const properties = {
        'Date': { title: [{ text: { content: date } }] },
        '#金额': { number: Number(amount) },
        '收支类型': { select: { name: type } },
      };
      if (category) properties['大类'] = { select: { name: category } };
      if (subcategory) properties['小类'] = { select: { name: subcategory } };
      if (account) properties['账户'] = { select: { name: account } };
      if (note) properties['备注'] = { rich_text: [{ text: { content: String(note) } }] };

      const response = await fetch('https://api.notion.com/v1/pages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${NOTION_API_KEY}`,
          'Content-Type': 'application/json',
          'Notion-Version': '2022-06-28',
        },
        body: JSON.stringify({
          parent: { database_id: DATABASE_ID },
          properties,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return res.status(response.status).json({
          success: false,
          error: data.message || '创建失败',
          details: data,
        });
      }

      return res.status(200).json({ success: true, id: data.id });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });

  } catch (error) {
    console.error('错误:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message || '服务器内部错误',
    });
  }
};
