import fs from "fs";
import 'dotenv/config';

const GRAPH_FILE = "./scripts/.cache/v5.4/organic-graph.json";

async function getSpotifyToken(): Promise<string> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("No env vars");

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const data = await res.json();
  return data.access_token;
}

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function searchSpotify(query: string, token: string) {
  const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=artist&market=KR&limit=1`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return query; // fallback
  const data = await res.json();
  if (data.artists && data.artists.items.length > 0) {
    return data.artists.items[0].name;
  }
  return query; // fallback
}

// Some known forced localizations to save API requests
const FORWARD_MAP: Record<string, string> = {
  "Stereo Venus;Rumer": "스테레오 비너스",
  "HowL;제이": "하울",
  "변진섭;신해철": "변진섭",
  "EXHIBITION": "전람회",
  "The Jadu": "자두"
};

async function run() {
  const token = await getSpotifyToken();
  const graph = JSON.parse(fs.readFileSync(GRAPH_FILE, "utf-8"));
  
  let localizedCount = 0;
  for (const n of graph.nodes) {
    let nameToSearch = n.nameKo || n.name;
    if (!nameToSearch) continue;

    // Hardcoded fixes for edge cases (like semicolons with multiple artists)
    if (nameToSearch.includes(";")) {
      const parts = nameToSearch.split(";");
      // Just take the first one instead of the compounded one
      nameToSearch = parts[0].trim();
    }
    
    // Explicit map
    for (const [k, v] of Object.entries(FORWARD_MAP)) {
      if ((n.nameKo || n.name || "").toLowerCase() === k.toLowerCase()) {
        nameToSearch = v;
      }
    }

    // Check if name is purely English or changed by hardcode
    if (/^[A-Za-z0-9\s,&.\'-]+$/.test(nameToSearch) || nameToSearch !== (n.nameKo || n.name)) {
      console.log(`[Target] Searching substitution for: ${nameToSearch} (original: ${n.nameKo || n.name})`);
      const officialName = await searchSpotify(nameToSearch, token);
      
      // Only replace if Spotify returned a Korean name or if we just removed the semicolon
      // (Spotify often returns Korean names if market=KR)
      if (officialName && officialName !== (n.nameKo || n.name)) {
        console.log(`  => ✅ ${officialName}`);
        n.nameKo = officialName; // Override nameKo
        localizedCount++;
      } else if (nameToSearch !== (n.nameKo || n.name)) {
        console.log(`  => ✅ ${nameToSearch}`);
        n.nameKo = nameToSearch; 
        localizedCount++;
      }
      await sleep(100);
    }
  }

  if (localizedCount > 0) {
    fs.writeFileSync(GRAPH_FILE, JSON.stringify(graph, null, 2));
    console.log(`Updated ${localizedCount} nodes in organic-graph.json`);
  } else {
    console.log("No nodes needed updating.");
  }
}

run().catch(console.error);
