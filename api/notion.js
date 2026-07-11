// /api/notion.js
const { Client } = require('@notionhq/client');

const NOTION_API_KEY = process.env.NOTION_API_KEY;
const DATABASE_ID = process.env.NOTION_DATABASE_ID;

const notion = new Client({ auth: NOTION_API_KEY });

const PROP = {
  date: 'Date',
  amount: '金额',
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

  if (!NOTION_API_KEY || !DATABASE_ID) {
    return res.status(500).json({
      success: false,
      error: '缺少环境变量 NOTION_API_KEY 或 NOTION_DATABASE_ID',
    });
  }

  try {
    if (req.method === 'GET') {
      const records = await queryAllRecords();
      return res.status(200).json({ success: true, data: records });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { date, amount, type, category, subcategory, account, note } = body || {};

      if (!date || amount === undefined || amount === null || !type) {
        return res.status(400).json({ success: false, error: '缺少必填字段：日期 / 金额 / 收支类型' });
      }
      const numericAmount = Number(amount);
      if (Number.isNaN(numericAmount) || numericAmount <= 0) {
        return res.status(400).json({ success: false, error: '金额必须是大于 0 的数字' });
      }
      if (type !== '收入' && type !== '支出') {
        return res.status(400).json({ success: false, error: '收支类型必须是 "收入" 或 "支出"' });
      }

      const properties = {
        [PROP.date]: { title: [{ text: { content: date } }] },
        [PROP.amount]: { number: numericAmount },
        [PROP.type]: { select: { name: type } },
      };
      if (category) properties[PROP.category] = { select: { name: category } };
      if (subcategory) properties[PROP.subcategory] = { select: { name: subcategory } };
      if (account) properties[PROP.account] = { select: { name: account } };
      if (note) properties[PROP.note] = { rich_text: [{ text: { content: String(note).slice(0, 2000) } }] };

      const page = await notion.pages.create({
        parent: { database_id: DATABASE_ID },
        properties,
      });

      return res.status(200).json({ success: true, id: page.id });
    }

    res.setHeader('Allow', ['GET', 'POST', 'OPTIONS']);
    return res.status(405).json({ success: false, error: `不支持的请求方法: ${req.method}` });
  } catch (err) {
    console.error('Notion API error:', err);
    return res.status(500).json({
      success: false,
      error: err && err.message ? err.message : '服务器内部错误',
    });
  }
};

async function queryAllRecords() {
  let results = [];
  let cursor = undefined;

  do {
    const response = await notion.databases.query({
      database_id: DATABASE_ID,
      start_cursor: cursor,
      page_size: 100,
      sorts: [{ property: PROP.date, direction: 'ascending' }],
    });
    results = results.concat(response.results);
    cursor = response.has_more ? response.next_cursor : undefined;
  } while (cursor);

  return results.map(mapPageToRecord).filter((r) => r.date);
}

function mapPageToRecord(page) {
  const p = page.properties || {};
  return {
    id: page.id,
    date: getTitle(p[PROP.date]),
    amount: getNumber(p[PROP.amount]),
    type: getSelect(p[PROP.type]),
    category: getSelect(p[PROP.category]),
    subcategory: getSelect(p[PROP.subcategory]),
    account: getSelect(p[PROP.account]),
    note: getRichText(p[PROP.note]),
  };
}

// 关键改动：Date 是 title 类型
function getTitle(prop) {
  if (!prop || !Array.isArray(prop.title)) return null;
  return prop.title.map((t) => t.plain_text).join('') || null;
}

function getNumber(prop) {
  return prop && typeof prop.number === 'number' ? prop.number : 0;
}

function getSelect(prop) {
  return prop && prop.select && prop.select.name ? prop.select.name : '';
}

function getRichText(prop) {
  if (!prop || !Array.isArray(prop.rich_text)) return '';
  return prop.rich_text.map((t) => t.plain_text).join('');
}
