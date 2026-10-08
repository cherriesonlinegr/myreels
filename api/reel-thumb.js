const YOUTUBE_ID = /^[\w-]{11}$/;

export default async function handler(req, res) {
  const id = String(req.query?.v || "");
  if (!YOUTUBE_ID.test(id)) {
    res.status(404).end();
    return;
  }

  const candidates = [
    `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`,
    `https://i.ytimg.com/vi/${id}/sddefault.jpg`,
    `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
  ];

  for (const url of candidates) {
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length < 3000 && url !== candidates[candidates.length - 1]) continue;
      res.setHeader("Content-Type", "image/jpeg");
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.status(200).send(bytes);
      return;
    } catch {
      /* try the next size */
    }
  }

  res.status(404).end();
}
