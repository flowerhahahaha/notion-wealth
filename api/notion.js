// api/notion.js
// Vercel Serverless Function - 从 Notion 获取数据

const { Client } = require('@notionhq/client');

// ============ 配置区（部署前修改） ============
const NOTION_API_KEY = process.env.NOTION_API_KEY || 'your_notion_api_key';
const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID || 'your_database_id';
// =============================================

module.exports = async (req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const notion = new Client({ auth: NOTION_API_KEY });

        const response = await notion.databases.query({
            database_id: NOTION_DATABASE_ID,
            sorts: [{ property: 'Date', direction: 'descending' }],
        });

        const records = response.results.map(page => {
            const p = page.properties;
            return {
                id: page.id,
                date: p.Date?.date?.start || '',
                amount: p['#金额']?.number || 0,
                type: p['收支类型']?.select?.name || '',
                category: p['大类']?.select?.name || '未分类',
                subcategory: p['小类']?.select?.name || '未分类',
                account: p['账户']?.select?.name || '',
                note: p['备注']?.rich_text?.map(t => t.plain_text).join('') || '',
            };
        });

        res.status(200).json({ success: true, data: records });

    } catch (error) {
        console.error('Notion API Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};
