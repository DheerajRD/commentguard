// api/scrape.js  — Vercel Serverless Function
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { postUrl, apifyToken, maxComments = 100 } = req.body || {};

  if (!postUrl || !apifyToken) {
    return res.status(400).json({ error: 'postUrl and apifyToken are required' });
  }

  const isInstagram = postUrl.includes('instagram.com');
  const isTwitter   = postUrl.includes('twitter.com') || postUrl.includes('x.com');

  if (!isInstagram && !isTwitter) {
    return res.status(400).json({ error: 'Only Instagram and X/Twitter URLs are supported' });
  }

  try {
    const actorId = isInstagram
      ? 'apify~instagram-comment-scraper'
      : 'quacker~twitter-scraper';

    const inputBody = isInstagram
      ? { directUrls: [postUrl], resultsLimit: maxComments }
      : { startUrls: [{ url: postUrl }], maxItems: maxComments };

    // 1. Start the Apify actor run
    const startRes = await fetch(
      `https://api.apify.com/v2/acts/${actorId}/runs?token=${apifyToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inputBody),
      }
    );

    if (!startRes.ok) {
      const err = await startRes.text();
      return res.status(400).json({ error: `Apify error: ${err}` });
    }

    const startData = await startRes.json();
    const runId = startData.data?.id;
    if (!runId) return res.status(500).json({ error: 'No run ID from Apify' });

    // 2. Poll until finished (max 90s)
    let succeeded = false;
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 3000));
      const statusRes  = await fetch(
        `https://api.apify.com/v2/actor-runs/${runId}?token=${apifyToken}`
      );
      const statusData = await statusRes.json();
      const status     = statusData.data?.status;
      if (status === 'SUCCEEDED') { succeeded = true; break; }
      if (status === 'FAILED' || status === 'ABORTED') {
        return res.status(500).json({ error: 'Apify run failed. Check if the post is public.' });
      }
    }

    if (!succeeded) return res.status(504).json({ error: 'Timed out waiting for Apify. Try again.' });

    // 3. Fetch results
    const itemsRes  = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${apifyToken}&limit=${maxComments}`
    );
    const items = await itemsRes.json();

    // 4. Normalise to common shape
    const comments = (items || [])
      .map((item, i) => {
        if (isInstagram) {
          return {
            id:    i + 1,
            user:  item.ownerUsername ? `@${item.ownerUsername}` : '@user',
            text:  item.text || item.comment || '',
            likes: item.likesCount || 0,
          };
        } else {
          return {
            id:    i + 1,
            user:  item.author?.userName ? `@${item.author.userName}` : '@user',
            text:  item.text || item.full_text || '',
            likes: item.likeCount || 0,
          };
        }
      })
      .filter(c => c.text.trim().length > 0);

    return res.status(200).json({ comments, total: comments.length });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
