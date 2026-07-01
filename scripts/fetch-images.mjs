// One-off helper: fetch freely-licensed photos from Wikimedia Commons for the
// Ehime spot catalogue and drop them into public/images/ehime/.
//
// - Uses the Commons API to search for a file per target, prefers JPEG, and
//   downloads a width-capped thumbnail (keeps files reasonably small).
// - Records attribution (author + license) into public/images/ehime/CREDITS.md
//   so the CC-BY / CC-BY-SA obligations are met.
//
// Run: node scripts/fetch-images.mjs
import { writeFile, mkdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const OUT_DIR = path.resolve("public/images/ehime");
const THUMB_WIDTH = 1400;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/124.0 Safari/537.36 ehime-tourism-app/0.1 (dev image fetch)";
const COMMON_HEADERS = {
  "User-Agent": UA,
  Accept: "image/avif,image/webp,image/jpeg,image/png,*/*",
  Referer: "https://commons.wikimedia.org/",
};

// filename -> Commons search query. Queries lean on well-documented landmarks
// so results are on-topic; a few generic scenes fall back to broader terms.
const TARGETS = [
  ["onsen-bath.jpg", "Dogo Onsen Honkan"],
  ["matsuyama-castle.jpg", "Matsuyama Castle keep"],
  ["michi-no-eki.jpg", "mikan mandarin orange fruit"],
  ["kurushima-bridge.jpg", "Kurushima-Kaikyo Bridge"],
  ["kurushima-bridge-aerial.jpg", "Kurushima-Kaikyo Bridge aerial"],
  ["imabari-castle.jpg", "Imabari Castle"],
  ["uwajima-castle.jpg", "Uwajima Castle"],
  ["uchiko-townscape.jpg", "Uchiko machinami"],
  ["dogo-onsen-station.jpg", "Dogo Onsen Station"],
  ["tobe-zoo-polarbear.jpg", "polar bear zoo"],
  ["cattle-karst.jpg", "Shikoku Karst cattle"],
  ["mountain-ridge.jpg", "Mount Ishizuchi"],
  ["omishima-museum.jpg", "Omishima Ehime museum"],
  ["lighthouse.jpg", "Sadamisaki Lighthouse"],
  ["sotodomari-village.jpg", "Sotodomari stone wall village"],
  ["tobeyaki-shop.jpg", "blue white porcelain bowl Japanese"],
  ["autumn-bridge.jpg", "autumn leaves gorge Japan"],
  ["seaside-station.jpg", "Shimonada Station"],
  ["seaside-rails.jpg", "Shimonada Station platform"],
  ["garden-zashiki.jpg", "Japanese garden maple momiji autumn"],
  ["fujiwara-bridge.jpg", "arch bridge valley Japan"],
  ["shipyard.jpg", "Imabari shipbuilding shipyard"],
  ["rice-straw.jpg", "rice straw field Japan"],
  ["setouchi-shrine.jpg", "Oyamazumi Shrine Omishima"],
  ["brick-studio.jpg", "red brick building Japan"],
  ["museum-corridor.jpg", "museum interior corridor"],
  ["museum-stairs.jpg", "museum staircase architecture"],
];

function stripHtml(s) {
  return (s || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// fetch with retry/backoff on 429 + transient errors.
async function fetchRetry(url, tries = 5) {
  let wait = 3000;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: COMMON_HEADERS });
      if (res.status === 429) {
        await sleep(wait);
        wait *= 2;
        continue;
      }
      return res;
    } catch (err) {
      if (i === tries - 1) throw err;
      await sleep(wait);
      wait *= 2;
    }
  }
  throw new Error("HTTP 429 (rate limited after retries)");
}

async function searchImage(query) {
  const url =
    "https://commons.wikimedia.org/w/api.php?" +
    new URLSearchParams({
      action: "query",
      format: "json",
      generator: "search",
      gsrsearch: `filetype:bitmap ${query}`,
      gsrnamespace: "6",
      gsrlimit: "8",
      prop: "imageinfo",
      iiprop: "url|extmetadata|mime|size",
      iiurlwidth: String(THUMB_WIDTH),
    });
  const res = await fetchRetry(url);
  if (!res.ok) throw new Error(`search HTTP ${res.status}`);
  const data = await res.json();
  const pages = Object.values(data?.query?.pages ?? {});
  // Prefer JPEG, reasonably large, sorted by search index.
  pages.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  const pick =
    pages.find((p) => p.imageinfo?.[0]?.mime === "image/jpeg") ?? pages[0];
  const info = pick?.imageinfo?.[0];
  if (!info?.thumburl) return null;
  const meta = info.extmetadata ?? {};
  return {
    title: pick.title,
    thumburl: info.thumburl,
    mime: info.mime,
    author: stripHtml(meta.Artist?.value) || "Unknown",
    license: stripHtml(meta.LicenseShortName?.value) || "see source",
    descUrl: info.descriptionurl || info.descriptionshorturl || "",
  };
}

async function download(u) {
  const res = await fetchRetry(u);
  if (!res.ok) throw new Error(`download HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const creditsPath = path.join(OUT_DIR, "credits.json");
  const creditsMap = existsSync(creditsPath)
    ? JSON.parse(await readFile(creditsPath, "utf8"))
    : {};

  for (const [file, query] of TARGETS) {
    const dest = path.join(OUT_DIR, file);
    if (existsSync(dest)) {
      console.log(`HAVE  ${file} — already present, skipping`);
      continue;
    }
    try {
      const hit = await searchImage(query);
      if (!hit) {
        console.log(`SKIP  ${file} — no result for "${query}"`);
        continue;
      }
      const bytes = await download(hit.thumburl);
      await writeFile(dest, bytes);
      const kb = Math.round(bytes.length / 1024);
      console.log(`OK    ${file} <- ${hit.title} (${kb} KB)`);
      creditsMap[file] = {
        author: hit.author,
        license: hit.license,
        source: hit.descUrl,
      };
    } catch (err) {
      console.log(`FAIL  ${file} — ${err.message}`);
    }
    // Be polite to the API to avoid rate limiting.
    await sleep(1500);
  }

  await writeFile(creditsPath, JSON.stringify(creditsMap, null, 2), "utf8");

  const rows = Object.entries(creditsMap)
    .map(
      ([file, c]) => `| \`${file}\` | ${c.author} | ${c.license} | ${c.source} |`,
    )
    .join("\n");
  const header =
    "# 写真クレジット (public/images/ehime/)\n\n" +
    "以下の写真は Wikimedia Commons から取得しました。各ライセンスの条件" +
    "（表示 / 継承など）に従って利用してください。\n\n" +
    "| filename | author | license | source |\n| --- | --- | --- | --- |\n";
  await writeFile(path.join(OUT_DIR, "CREDITS.md"), header + rows + "\n", "utf8");
  console.log(`\nWrote ${Object.keys(creditsMap).length} entries to CREDITS.md`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
