// /api/notion.js
// 用原生 fetch，不依赖任何第三方包

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const NOTION_API_KEY = process.env.NOTION_API_KEY;
  const DATABASE_ID = process.env.NOTION_DATABASE_ID;

  // 返回调试信息
  return res.status(200).json({
    status: 'ok',
    hasApiKey: !!NOTION_API_KEY,
    hasDatabaseId: !!DATABASE_ID,
    apiKeyLength: NOTION_API_KEY ? NOTION_API_KEY.length : 0,
    databaseIdLength: DATABASE_ID ? DATABASE_ID.length : 0,
    envKeys: Object.keys(process.env).filter(k => k.includes('NOTION')),
  });
};
