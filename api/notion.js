// /api/notion.js
const { Client } = require('@notionhq/client');

const NOTION_API_KEY = process.env.NOTION_API_KEY;
const DATABASE_ID = process.env.NOTION_DATABASE_ID;

const notion = new Client({ auth: NOTION_API_KEY });

const PROP = {
  date: 'Date',
  amount: '#金额',
  type: '收支类型',
  category: '大类',
  subcategory: '小类',
  account: '账户',
  note: '备注',
};

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
      details: {
        hasApiKey: !!NOTION_API_KEY,
        hasDatabaseId: !!DATABASE_ID
      }
    });
  }

  try {
    if (req.method === 'GET') {
      const response = await notion.databases.query({
        database_id: DATABASE_ID,
        page_size: 100,
        sorts: [{ property: PROP.date, direction: 'ascending' }],
      });

      const records = response.results.map(page => {
        const p = page.properties;
        return {
          id: page.id,
          date: p[PROP.date]?.title?.[0]?.plain_text || null,
          amount: p[PROP.amount]?.number || 0,
          type: p[PROP.type]?.select?.name || '',
          category: p[PROP.category]?.select?.name || '',
          subcategory: p[PROP.subcategory]?.select?.name || '',
          account: p[PROP.account]?.select?.name || '',
          note: p[PROP.note]?.rich_text?.map(t => t.plain_text).join('') || '',
        };
      }).filter(r => r.date);

      return res.status(200).json({
        success: true,
        data: records,
        total: response.results.length,
        filtered: records.length
      });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { date, amount, type, category, subcategory, account, note } = body || {};

      if (!date || amount === undefined || amount === null || !type) {
        return res.status(400).json({ success: false, error: '缺少必填字段' });
      }

      const numericAmount = Number(amount);
      if (isNaN(numericAmount) || numericAmount <= 0) {
        return res.status(400).json({ success: false, error: '金额必须大于0' });
      }

      const properties = {
        [PROP.date]: { title: [{ text: { content: date } }] },
        [PROP.amount]: { number: numericAmount },
        [PROP.type]: { select: { name: type } },
      };
      if (category) properties[PROP.category] = { select: { name: category } };
      if (subcategory) properties[PROP.subcategory] = { select: { name: subcategory } };
      if (account) properties[PROP.account] = { select: { name: account } };
      if (note) properties[PROP.note] = { rich_text: [{ text: { content: String(note) } }] };

      const page = await notion.pages.create({
        parent: { database_id: DATABASE_ID },
        properties,
      });

      return res.status(200).json({ success: true, id: page.id });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (err) {
    console.error('Notion API Error:', JSON.stringify(err, null, 2));
    return res.status(500).json({
      success: false,
      error: err.message || '服务器内部错误',
      code: err.code || 'unknown',
      status: err.status || 500,
      notion_error: err.body || null
    });
  }
};
