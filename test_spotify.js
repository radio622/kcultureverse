const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

async function run() {
  const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + Buffer.from(SPOTIFY_CLIENT_ID + ':' + SPOTIFY_CLIENT_SECRET).toString('base64'),
    },
    body: 'grant_type=client_credentials',
  });
  const tokenData = await tokenRes.json();
  const token = tokenData.access_token;
  
  const FALLBACK_KPOP_IDS = [
    "3Nrfpe0tUJi4K4DXYWgMUX", "41MozSoPIsD1dJM0CLPjZF", "2NjfORmSVGQtwmFjaBYQoo", 
    "0gxyHStUsqpMadRV0Di1Qt", "3HqSLMAZ3g3d5poNaI7GOU", "6qqNVTkY8uBg9cP3Jd7DAH", 
    "1z4g3DjTBBZKhvAroFlhOM", "3cjEqqelV9zb41pAfcwrPM", "7n2Ycct7Beij7Dj7meI4X0", 
    "3PtYh2yEXz8D8WbK6sNshF", "6Tz3hD2EDyT2TDB1s3rK6m", "747I2aLekrRjFheM9Xj3Fm", 
    "2auC28zjQyVTsiOUAUpPfK", "7gChT3BqB1jBSOavw91hU7", "2dIgFjalVxs4ThymZ67YCE"
  ];
  
  const chunkIds = FALLBACK_KPOP_IDS.slice(0, 50).join(',');
  const res = await fetch(`https://api.spotify.com/v1/artists?ids=${chunkIds}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  
  const txt = await res.text();
  console.log('Status:', res.status);
  console.log('Response:', txt);
}

run().catch(console.error);
