const fs = require('fs');

async function checkGenius() {
  const envContent = fs.readFileSync('/Users/ji/Documents/Jitigravity/.env.local', 'utf-8');
  let token = '';
  envContent.split('\n').forEach(line => {
    if (line.startsWith('GENIUS_ACCESS_TOKEN=')) {
      token = line.split('=')[1].trim();
    }
  });

  if (!token) {
    console.log("NO GENIUS TOKEN FOUND IN .env.local");
    return;
  }
  
  const q = encodeURIComponent(`Love wins all IU`);
  const res = await fetch(`https://api.genius.com/search?q=${q}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  
  const data = await res.json();
  console.log("GENIUS SEARCH STATUS:", res.status);
  if (data.response && data.response.hits) {
    const hits = data.response.hits;
    if (hits.length > 0) {
      const topHit = hits[0].result;
      console.log("Top Hit:", topHit.id, topHit.title, topHit.primary_artist.name);
      
      const songRes = await fetch(`https://api.genius.com/songs/${topHit.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const songData = await songRes.json();
      console.log("Song Credits:");
      const song = songData.response.song;
      console.log("Producers:", song.producer_artists.map(a => a.name));
      console.log("Writers:", song.writer_artists.map(a => a.name));
    } else {
      console.log("No hits found");
    }
  } else {
    console.log("Error in response:", data);
  }
}

checkGenius().catch(console.error);
