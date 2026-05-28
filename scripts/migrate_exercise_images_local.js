#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");

const IMAGE_BASE = "https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises";
const DEFAULT_DATA_PATH = path.join(__dirname, "..", "cloudfunctions", "importExercises", "data", "exercises.json");
const DEFAULT_OUT_DIR = path.join(__dirname, "..", ".local", "exercise-images");
const MAX_REDIRECTS = 4;

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const current = argv[i];
    if (!current.startsWith("--")) continue;
    const key = current.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

function cleanText(value) {
  return String(value || "").trim();
}

function safeSegment(value, fallback) {
  return cleanText(value || fallback)
    .replace(/[\\/:*?"<>|#\s]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function firstImage(item) {
  return Array.isArray(item.images) && item.images.length ? item.images[0] : "";
}

function buildSourceUrl(item, imageBase) {
  const remote = [item.rawImageUrl, item.imageUrl, item.image, item.thumbnail].find((value) =>
    /^https?:\/\//i.test(cleanText(value))
  );
  if (remote) return remote;

  const imagePath = firstImage(item);
  return imagePath ? `${imageBase}/${imagePath}` : "";
}

function extensionFromUrl(url, contentType) {
  const parsed = new URL(url);
  const ext = path.extname(parsed.pathname).replace(".", "").toLowerCase();
  if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) return ext;
  if ((contentType || "").includes("png")) return "png";
  if ((contentType || "").includes("webp")) return "webp";
  if ((contentType || "").includes("gif")) return "gif";
  return "jpg";
}

function requestBuffer(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("http://") ? http : https;
    const request = client.get(
      url,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 FitnessImageMigrator"
        },
        timeout: 30000
      },
      (response) => {
        const status = response.statusCode || 0;
        const location = response.headers.location;

        if (status >= 300 && status < 400 && location) {
          response.resume();
          if (redirects >= MAX_REDIRECTS) {
            reject(new Error("Too many redirects"));
            return;
          }
          requestBuffer(new URL(location, url).toString(), redirects + 1).then(resolve).catch(reject);
          return;
        }

        if (status < 200 || status >= 300) {
          response.resume();
          reject(new Error(`Request failed with status ${status}`));
          return;
        }

        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => {
          resolve({
            buffer: Buffer.concat(chunks),
            contentType: response.headers["content-type"] || ""
          });
        });
      }
    );

    request.on("timeout", () => request.destroy(new Error("Request timeout")));
    request.on("error", reject);
  });
}

async function downloadImage(item, options) {
  const exerciseId = safeSegment(item.exerciseId || item.id || item._id, "exercise");
  const sourceUrl = buildSourceUrl(item, options.imageBase);
  if (!sourceUrl) {
    return { status: "skipped", reason: "no_image", exerciseId };
  }

  const urlPath = new URL(sourceUrl).pathname;
  const sourceBase = safeSegment(path.basename(urlPath, path.extname(urlPath)), "image");
  const localDir = path.join(options.outDir, exerciseId);
  ensureDir(localDir);

  const existing = fs
    .readdirSync(localDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(localDir, entry.name))
    .find((filePath) => path.basename(filePath, path.extname(filePath)) === sourceBase);
  if (existing && !options.force) {
    return {
      status: "cached",
      exerciseId,
      sourceUrl,
      localPath: existing,
      cloudPath: `exercise-images/${exerciseId}/${path.basename(existing)}`
    };
  }

  const downloaded = await requestBuffer(sourceUrl);
  const ext = extensionFromUrl(sourceUrl, downloaded.contentType);
  const fileName = `${sourceBase}.${ext}`;
  const localPath = path.join(localDir, fileName);
  fs.writeFileSync(localPath, downloaded.buffer);

  return {
    status: "downloaded",
    exerciseId,
    sourceUrl,
    localPath,
    cloudPath: `exercise-images/${exerciseId}/${fileName}`
  };
}

function initCloudbase(args) {
  const env = args.env || process.env.TCB_ENV_ID;
  const secretId = args["secret-id"] || process.env.TENCENTCLOUD_SECRETID;
  const secretKey = args["secret-key"] || process.env.TENCENTCLOUD_SECRETKEY;

  if (!env || !secretId || !secretKey) {
    throw new Error("Missing --env/--secret-id/--secret-key or TCB_ENV_ID/TENCENTCLOUD_SECRETID/TENCENTCLOUD_SECRETKEY");
  }

  let cloudbase;
  try {
    cloudbase = require("@cloudbase/node-sdk");
  } catch (error) {
    throw new Error("Missing dependency @cloudbase/node-sdk. Run: npm install @cloudbase/node-sdk");
  }

  return cloudbase.init({
    env,
    secretId,
    secretKey
  });
}

async function main() {
  const args = parseArgs(process.argv);
  const dataPath = path.resolve(args.data || DEFAULT_DATA_PATH);
  const outDir = path.resolve(args.out || DEFAULT_OUT_DIR);
  const imageBase = args["image-base"] || IMAGE_BASE;
  const limit = Math.max(Number(args.limit) || 20, 1);
  const offset = Math.max(Number(args.offset) || 0, 0);
  const force = Boolean(args.force);
  const upload = Boolean(args.upload);
  const dryRun = Boolean(args["dry-run"]);

  const raw = readJson(dataPath);
  const allItems = Array.isArray(raw) ? raw : raw.exercises || [];
  const items = allItems.slice(offset, offset + limit);
  ensureDir(outDir);

  let app = null;
  let db = null;
  if (upload && !dryRun) {
    app = initCloudbase(args);
    db = app.database();
  }

  const details = [];
  for (const item of items) {
    try {
      const detail = await downloadImage(item, { outDir, imageBase, force });
      if ((upload || dryRun) && detail.localPath && detail.cloudPath) {
        if (dryRun) {
          detail.upload = "dry-run";
        } else {
          const uploaded = await app.uploadFile({
            cloudPath: detail.cloudPath,
            fileContent: fs.createReadStream(detail.localPath)
          });
          const fileID = uploaded.fileID;
          const exerciseId = item.exerciseId || item.id;
          const existing = await db.collection("exercises").where({ exerciseId }).limit(1).get();
          if (existing.data.length) {
            await db.collection("exercises").doc(existing.data[0]._id).update({
              imageFileId: fileID,
              imageUrl: fileID,
              rawImageUrl: detail.sourceUrl,
              imageMigratedAt: Date.now(),
              updatedAt: Date.now()
            });
            detail.upload = "updated-db";
          } else {
            detail.upload = "uploaded-no-db-record";
          }
          detail.fileID = fileID;
        }
      }
      details.push(detail);
      console.log(`${detail.status}: ${detail.exerciseId} ${detail.upload || ""}`);
    } catch (error) {
      const exerciseId = item.exerciseId || item.id || item._id || "";
      details.push({ status: "failed", exerciseId, message: error.message });
      console.error(`failed: ${exerciseId} ${error.message}`);
    }
  }

  const manifestPath = path.join(outDir, `manifest_${offset}_${offset + items.length}.json`);
  fs.writeFileSync(manifestPath, JSON.stringify({ offset, limit, upload, dryRun, details }, null, 2));
  console.log(`manifest: ${manifestPath}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
