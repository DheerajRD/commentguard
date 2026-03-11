module.exports = async function handler(req, res) {
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
    // Use instagram-scraper for Instagram, twitter-scraper for X
    const actorId = isInstagram
      ? 'apify~instagram-scraper'
      : 'quacker~twitter-scraper';

    const inputBody = isInstagram
      ? {
          directUrls: [postUrl],
          resultsType: "comments",
          resultsLimit: maxComments,
          addParentData: false,
        }
      : {
          startUrls: [{ url: postUrl }],
          maxItems: maxComments,
        };

    // 1. Start actor run
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

    // 2. Poll until finished (max 120s)
    let succeeded = false;
    for (let i = 0; i < 40; i++) {
      await new Promise(r => setTimeout(r, 3000));
      const statusRes  = await fetch(
        `https://api.apify.com/v2/actor-runs/${runId}?token=${apifyToken}`
      );
      const statusData = await statusRes.json();
      const status     = statusData.data?.status;
      if (status === 'SUCCEEDED') { succeeded = true; break; }
      if (status === 'FAILED' || status === 'ABORTED') {
        return res.status(500).json({ error: 'Apify run failed. Post may be private or restricted.' });
      }
    }

    if (!succeeded) return res.status(504).json({ error: 'Timed out. Try again or use a different post.' });

    // 3. Fetch results
    const itemsRes = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${apifyToken}&limit=${maxComments}`
    );
    const items = await itemsRes.json();

    // 4. Normalise — instagram-scraper returns different fields
    const comments = (items || [])
      .map((item, i) => {
        if (isInstagram) {
          return {
            id:    i + 1,
            user:  item.ownerUsername
                    ? `@${item.ownerUsername}`
                    : item.owner?.username
                    ? `@${item.owner.username}`
                    : '@user',
            text:  item.text || item.body || item.comment || '',
            likes: item.likesCount || item.likes || 0,
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
      .filter(c => c.text && c.text.trim().length > 0);

    if (comments.length === 0) {
      return res.status(404).json({ error: 'No comments found. Post may be private or have no comments.' });
    }

    return res.status(200).json({ comments, total: comments.length });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
