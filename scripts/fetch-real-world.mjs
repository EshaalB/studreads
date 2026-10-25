// Downloads the real-world timetables and date sheets listed in fixtures/real-world/sources.json.
// They are other universities' public documents, so they are fetched, not committed.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const folder = 'fixtures/real-world';
const sources = JSON.parse(readFileSync(`${folder}/sources.json`, 'utf8'));

for (const { file, url } of sources) {
  if (!url) continue; // a file you added yourself; nothing to download
  if (existsSync(`${folder}/${file}`)) { console.log(`✓ ${file} (already here)`); continue; }
  try {
    const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(90000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    writeFileSync(`${folder}/${file}`, Buffer.from(await response.arrayBuffer()));
    console.log(`✓ ${file}`);
  } catch (error) {
    console.log(`✗ ${file}: ${error.message}`);
  }
}
