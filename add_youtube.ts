import fs from "fs";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const artistNames = [
  "10CM", "BABYMONSTER", "Crush", "DAVICHI", "ILLIT", "ITZY", "IVE", "JENNIE", "LE SSERAFIM", "Loco",
  "Parc Jae Jung", "Punch", "Sik-K", "TXT", "TWS", "Tei", "Woo Won Jae", "WOODZ",
  "YOUNHA", "Yerin Baek", "Zion.T", "fromis_9", "이영지", "임영웅", "웬디", "하온", "창모", "키드밀리"
];

async function run() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return;
  
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  const token = (await res.json() as any).access_token;
  
  let target = fs.readFileSync("src/data/hub-artists.ts", "utf-8");
  let added = 0;
  
  const COLORS = [
    { accent: "#38bdf8", nebula: "#082f49", nebula2: "#0c4a6e" },
    { accent: "#a78bfa", nebula: "#2e1065", nebula2: "#4c1d95" },
    { accent: "#f472b6", nebula: "#831843", nebula2: "#be185d" },
    { accent: "#fb923c", nebula: "#7c2d12", nebula2: "#9a3412" },
  ];

  for (let i = 0; i < artistNames.length; i++) {
    const q = artistNames[i];
    const sRes = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=artist&limit=1`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!sRes.ok) {
      console.log("Failed API", sRes.status);
      continue;
    }
    const body = await sRes.json() as any;
    const a = body.artists?.items?.[0];
    if (!a) {
      console.log("No artist found for", q);
      continue;
    }

    if (target.includes(a.id)) {
      console.log(`Skipping ${a.name}, exists`);
      continue;
    }
    
    const c = COLORS[added % COLORS.length];
    const block = `  // ── YouTube Additions ──
  {
    spotifyId: "${a.id}",
    name: "${a.name}",
    nameKo: "${a.name}",
    accent: "${c.accent}",
    nebula: "${c.nebula}",
    nebula2: "${c.nebula2}",
  },
`;
    target = target.replace("];\n\n/**", block + "];\n\n/**");
    added++;
    console.log(`Added ${a.name} (${a.id})`);
  }

  fs.writeFileSync("src/data/hub-artists.ts", target);
  console.log(`Total added: ${added}`);
}
run();
