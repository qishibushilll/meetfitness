const cloud = require("wx-server-sdk");
const https = require("https");
const http = require("http");
const path = require("path");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const EXERCISES = "exercises";
const MAX_REDIRECTS = 4;

function cleanText(value) {
  return String(value || "").trim();
}

function isRemoteImageUrl(value) {
  const url = cleanText(value);
  return /^https?:\/\//i.test(url);
}

function pickSourceUrl(item) {
  const candidates = [item.rawImageUrl, item.imageUrl, item.image, item.thumbnail];
  return candidates.find((value) => isRemoteImageUrl(value)) || "";
}

function safeSegment(value, fallback) {
  return cleanText(value || fallback)
    .replace(/[\\/:*?"<>|#\s]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120);
}

function extensionFromUrl(url, contentType) {
  const parsed = new URL(url);
  const ext = path.extname(parsed.pathname).replace(".", "").toLowerCase();
  if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) {
    return ext;
  }

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
        timeout: 20000
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

          const nextUrl = new URL(location, url).toString();
          requestBuffer(nextUrl, redirects + 1).then(resolve).catch(reject);
          return;
        }

        if (status < 200 || status >= 300) {
          response.resume();
          reject(new Error(`Image request failed with status ${status}`));
          return;
        }

        const chunks = [];
        response.on("data", (chunk) => {
          chunks.push(chunk);
        });
        response.on("end", () => {
          resolve({
            buffer: Buffer.concat(chunks),
            contentType: response.headers["content-type"] || ""
          });
        });
      }
    );

    request.on("timeout", () => {
      request.destroy(new Error("Image request timeout"));
    });
    request.on("error", reject);
  });
}

async function migrateOne(item, options) {
  if (!options.force && item.imageFileId && String(item.imageFileId).startsWith("cloud://")) {
    return { status: "skipped", reason: "already_uploaded", id: item._id };
  }

  const sourceUrl = pickSourceUrl(item);
  if (!sourceUrl) {
    return { status: "skipped", reason: "no_remote_image", id: item._id };
  }

  const downloaded = await requestBuffer(sourceUrl);
  const exerciseId = safeSegment(item.exerciseId || item.id || item._id, item._id);
  const fileNameBase = safeSegment(path.basename(new URL(sourceUrl).pathname, path.extname(sourceUrl)), "image");
  const ext = extensionFromUrl(sourceUrl, downloaded.contentType);
  const cloudPath = `exercise-images/${exerciseId}/${fileNameBase}.${ext}`;
  const uploaded = await cloud.uploadFile({
    cloudPath,
    fileContent: downloaded.buffer
  });

  await db.collection(EXERCISES).doc(item._id).update({
    data: {
      imageFileId: uploaded.fileID,
      imageUrl: uploaded.fileID,
      rawImageUrl: item.rawImageUrl || sourceUrl,
      imageMigratedAt: Date.now(),
      updatedAt: Date.now()
    }
  });

  return {
    status: "migrated",
    id: item._id,
    exerciseId: item.exerciseId || item.id || "",
    sourceUrl,
    fileID: uploaded.fileID
  };
}

exports.main = async (event = {}) => {
  const limit = Math.min(Math.max(Number(event.limit) || 5, 1), 20);
  const offset = Math.max(Number(event.offset) || 0, 0);
  const force = Boolean(event.force);

  const result = await db.collection(EXERCISES).skip(offset).limit(limit).get();
  const items = result.data || [];
  const details = [];
  const summary = {
    scanned: items.length,
    migrated: 0,
    skipped: 0,
    failed: 0
  };

  for (const item of items) {
    try {
      const detail = await migrateOne(item, { force });
      details.push(detail);
      if (detail.status === "migrated") {
        summary.migrated += 1;
      } else {
        summary.skipped += 1;
      }
    } catch (error) {
      summary.failed += 1;
      details.push({
        status: "failed",
        id: item._id,
        exerciseId: item.exerciseId || item.id || "",
        sourceUrl: pickSourceUrl(item),
        message: error.message || String(error)
      });
    }
  }

  return {
    offset,
    limit,
    nextOffset: offset + items.length,
    force,
    ...summary,
    details
  };
};
