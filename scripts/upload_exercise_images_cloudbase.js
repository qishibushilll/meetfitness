#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const cloudbase = require("@cloudbase/node-sdk");

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

function requireValue(value, name) {
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeSegment(value, fallback) {
  return String(value || fallback)
    .trim()
    .replace(/[\\/:*?"<>|#\s]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function findLocalImage(outDir, item) {
  const exerciseId = safeSegment(item.exerciseId || item.id || item._id, "exercise");
  const imagePath = Array.isArray(item.images) && item.images.length ? item.images[0] : "";
  const imageBase = imagePath ? safeSegment(path.basename(imagePath, path.extname(imagePath)), "image") : "0";
  const localDir = path.join(outDir, exerciseId);
  if (!fs.existsSync(localDir)) return null;

  const filePath = fs
    .readdirSync(localDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(localDir, entry.name))
    .find((candidate) => path.basename(candidate, path.extname(candidate)) === imageBase);

  if (!filePath) return null;
  return {
    exerciseId,
    localPath: filePath,
    cloudPath: `exercise-images/${exerciseId}/${path.basename(filePath)}`
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const env = requireValue(args.env || process.env.TCB_ENV_ID, "--env or TCB_ENV_ID");
  const secretId = requireValue(args["secret-id"] || process.env.TENCENTCLOUD_SECRETID, "--secret-id or TENCENTCLOUD_SECRETID");
  const secretKey = requireValue(args["secret-key"] || process.env.TENCENTCLOUD_SECRETKEY, "--secret-key or TENCENTCLOUD_SECRETKEY");
  const dataPath = path.resolve(args.data || path.join(__dirname, "..", "cloudfunctions", "importExercises", "data", "exercises.json"));
  const outDir = path.resolve(args.out || path.join(__dirname, "..", ".local", "exercise-images"));
  const limit = Math.max(Number(args.limit) || 20, 1);
  const offset = Math.max(Number(args.offset) || 0, 0);
  const retries = Math.max(Number(args.retries) || 3, 0);
  const delay = Math.max(Number(args.delay) || 300, 0);

  const app = cloudbase.init({ env, secretId, secretKey });
  const db = app.database();
  const raw = readJson(dataPath);
  const allItems = Array.isArray(raw) ? raw : raw.exercises || [];
  const items = allItems.slice(offset, offset + limit);
  const details = [];

  console.log(`env: ${env}`);
  for (const item of items) {
    const localImage = findLocalImage(outDir, item);
    if (!localImage) {
      const exerciseId = item.exerciseId || item.id || item._id || "";
      console.log(`skipped: ${exerciseId} no-local-image`);
      details.push({ status: "skipped", exerciseId, reason: "no-local-image" });
      continue;
    }

    try {
      let uploaded = null;
      for (let attempt = 0; attempt <= retries; attempt += 1) {
        try {
          uploaded = await app.uploadFile({
            cloudPath: localImage.cloudPath,
            fileContent: fs.createReadStream(localImage.localPath)
          });
          break;
        } catch (error) {
          if (attempt >= retries) throw error;
          console.log(`retry: ${localImage.exerciseId} attempt=${attempt + 1} ${error.message || error}`);
          await sleep(delay * (attempt + 1));
        }
      }
      const fileID = uploaded.fileID;
      const exerciseId = item.exerciseId || item.id;
      const existing = await db.collection("exercises").where({ exerciseId }).limit(1).get();
      if (existing.data.length) {
        await db.collection("exercises").doc(existing.data[0]._id).update({
          imageFileId: fileID,
          imageUrl: fileID,
          rawImageUrl: item.rawImageUrl || item.imageUrl || "",
          imageMigratedAt: Date.now(),
          updatedAt: Date.now()
        });
        console.log(`uploaded: ${localImage.exerciseId} updated-db`);
        details.push({ status: "uploaded", exerciseId: localImage.exerciseId, fileID, upload: "updated-db" });
      } else {
        console.log(`uploaded: ${localImage.exerciseId} no-db-record`);
        details.push({ status: "uploaded", exerciseId: localImage.exerciseId, fileID, upload: "no-db-record" });
      }
    } catch (error) {
      console.error(`failed: ${localImage.exerciseId} ${error.message || error}`);
      details.push({ status: "failed", exerciseId: localImage.exerciseId, message: error.message || String(error) });
    }
  }

  const manifestPath = path.join(outDir, `upload_manifest_${offset}_${offset + items.length}.json`);
  fs.writeFileSync(manifestPath, JSON.stringify({ env, offset, limit, details }, null, 2));
  console.log(`manifest: ${manifestPath}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
