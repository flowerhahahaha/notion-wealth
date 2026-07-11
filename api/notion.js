// /api/notion.js
// 用原生 fetch，不需要 @notionhq/client

const NOTION_API_KEY = process.env.NOTION_TOKEN;
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
    // ===== GET: 查询数据 =====
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
          amount: p['金额']?.number || 0,
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

    // ===== POST: 创建记录 =====
    if (req.method === 'POST') {
      // Vercel 环境下，req.body 可能已经是解析好的对象
      let body = req.body;
      if (typeof body === 'string') {
        try {
          body = JSON.parse(body);
        } catch (e) {
          return res.status(400).json({ success: false, error: '请求体格式错误' });
        }
      }

      const { date, amount, type, category, subcategory, account, note } = body || {};

      // 验证必填字段
      if (!date) {
        return res.status(400).json({ success: false, error: '缺少日期字段' });
      }
      if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
        return res.status(400).json({ success: false, error: '金额必须大于0' });
      }
      if (!type || (type !== '收入' && type !== '支出')) {
        return res.status(400).json({ success: false, error: '收支类型必须是"收入"或"支出"' });
      }

      // 构建 Notion properties
      const properties = {
        'Date': { title: [{ text: { content: date } }] },
        '金额': { number: Number(amount) },
        '收支类型': { select: { name: type } },
      };

      if (category && category.trim() !== '') {
        properties['大类'] = { select: { name: category } };
      }
      if (subcategory && subcategory.trim() !== '') {
        properties['小类'] = { select: { name: subcategory } };
      }
      if (account && account.trim() !== '') {
        properties['账户'] = { select: { name: account } };
      }
      if (note && note.trim() !== '') {
        properties['备注'] = { rich_text: [{ text: { content: String(note).slice(0, 2000) } }] };
      }

      // 调用 Notion API 创建页面
      const response = await fetch('https://api.notion.com/v1/pages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${NOTION_API_KEY}`,
          'Content-Type': 'application/json',
          'Notion-Version': '2022-06-28',
        },
        body: JSON.stringify({
          parent: { database_id: DATABASE_ID },
          properties: properties,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Notion 创建失败:', JSON.stringify(data, null, 2));
        return res.status(response.status).json({
          success: false,
          error: data.message || 'Notion 创建失败',
          details: data,
        });
      }

      return res.status(200).json({
        success: true,
        id: data.id,
        message: '记账成功',
      });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });

  } catch (error) {
    console.error('服务器错误:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message || '服务器内部错误',
    });
  }
};
