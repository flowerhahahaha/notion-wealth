// api/notion.js
const { Client } = require('@notionhq/client');

const NOTION_API_KEY = process.env.NOTION_API_KEY || 'your_notion_api_key';
const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID || 'your_database_id';

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const notion = new Client({ auth: NOTION_API_KEY });

    try {
        // GET：查询
        if (req.method === 'GET') {
            const response = await notion.databases.query({
                database_id: NOTION_DATABASE_ID,
                sorts: [{ property: 'Date', direction: 'descending' }],
            });

            const records = response.results.map(page => {
                const p = page.properties;
                return {
                    id: page.id,
                    date: p.Date?.date?.start || '',
                    amount: p['金额']?.number || 0,
                    type: p['收支类型']?.select?.name || '',
                    category: p['大类']?.select?.name || '未分类',
                    subcategory: p['小类']?.select?.name || '未分类',
                    account: p['账户']?.select?.name || '',
                    note: p['备注']?.rich_text?.map(t => t.plain_text).join('') || '',
                };
            });
            return res.status(200).json({ success: true, data: records });
        }

        // POST：新增
        if (req.method === 'POST') {
            const { date, amount, type, category, subcategory, account, note } = req.body;

            if (!date || !amount || !type) {
                return res.status(400).json({ success: false, error: '请填写日期、金额和收支类型' });
            }

            const newPage = {
                parent: { database_id: NOTION_DATABASE_ID },
                properties: {
                    'Date': { date: { start: date } },
                    '金额': { number: parseFloat(amount) },
                    '收支类型': { select: { name: type } },
                },
            };

            if (category && category !== '未分类') {
                newPage.properties['大类'] = { select: { name: category } };
            }
            if (subcategory && subcategory !== '未分类') {
                newPage.properties['小类'] = { select: { name: subcategory } };
            }
            if (account) {
                newPage.properties['账户'] = { select: { name: account } };
            }
            if (note) {
                newPage.properties['备注'] = { rich_text: [{ text: { content: note } }] };
            }

            await notion.pages.create(newPage);
            return res.status(200).json({ success: true, message: '记账成功' });
        }

        return res.status(405).json({ success: false, error: 'Method not allowed' });

    } catch (error) {
        console.error('Notion API Error:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
};
