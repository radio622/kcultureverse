import fs from "fs";
import path from "path";
import { HUB_ARTISTS } from "./src/data/hub-artists";

async function run() {
  console.log("Starting Core patch...");
  for (const hub of HUB_ARTISTS) {
    const file = path.join(process.cwd(), "public", "data", "hub", `${hub.spotifyId}.json`);
    if (!fs.existsSync(file)) continue;

    const data = JSON.parse(fs.readFileSync(file, "utf-8"));
    // Always fix core name
    data.core.name = hub.nameKo;

    const term = encodeURIComponent(hub.nameKo);
    try {
      const res = await fetch(`https://itunes.apple.com/search?term=${term}&entity=song&limit=1&country=KR`);
      if (!res.ok) continue;
      const body = await res.json() as any;
      if (body.results?.[0]) {
        const img = body.results[0].artworkUrl100?.replace('100x100bb', '600x600bb');
        if (img) {
           data.core.imageUrl = img;
           data.core.previewUrl = body.results[0].previewUrl;
           data.core.previewTrackName = body.results[0].trackName;
           fs.writeFileSync(file, JSON.stringify(data, null, 2));
           console.log(`[+] Patched ${hub.nameKo}`);
        }
      }
    } catch (e: any) {
      console.error(e.message);
    }
  }
  console.log("Done patching cores!");
}

run();
