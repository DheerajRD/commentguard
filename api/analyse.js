// api/analyse.js — Vercel Serverless Function
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { comments } = req.body || {};
  if (!comments?.length) return res.status(400).json({ error: 'No comments provided' });

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set' });

  const batchSize = 10;
  const results = [];

  try {
    for (let i = 0; i < comments.length; i += batchSize) {
      const batch = comments.slice(i, i + batchSize);
      const prompt = `You are a social media content moderator. Classify each comment below.
Reply ONLY with a valid JSON array — no markdown, no extra text.
Format: [{"id":<number>,"severity":"toxic|negative|spam|neutral|positive","reason":"one short sentence"}]
toxic=hate/attack/threat, negative=rude/dismissive, spam=promo/bot, neutral=question/mixed, positive=kind/supportive
Comments:
${batch.map(c => `ID ${c.id}: "${c.text}"`).join('\n')}`;

      const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1500, messages: [{ role: 'user', content: prompt }] }),
      });
      const data = await apiRes.json();
      const raw = data.content?.[0]?.text || '[]';
      try {
        results.push(...JSON.parse(raw.replace(/```json|```/g, '').trim()));
      } catch {
        batch.forEach(c => results.push({ id: c.id, severity: 'neutral', reason: 'Could not analyse' }));
      }
    }
    return res.status(200).json({ results });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Analysis failed' });
  }
}
