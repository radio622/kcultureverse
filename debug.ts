import { getArtistFull } from './src/lib/spotify';

async function main() {
  const result = await getArtistFull('4Kxlr1PRlDKEB0ekOCyHgX'); // 검정치마
  console.log("검정치마:", JSON.stringify(result, null, 2));

  const nmixx = await getArtistFull('28ot3wh4oNmoFOdVajibBl'); // NMIXX
  console.log("NMIXX:", JSON.stringify(nmixx, null, 2));
}

require('dotenv').config({ path: '.env.local' });
main().catch(console.error);
