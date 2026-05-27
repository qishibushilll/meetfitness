const cloud = require("wx-server-sdk");
const https = require("https");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const EXERCISES = "exercises";
const DATA_URL =
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json";
const IMAGE_BASE =
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises";

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (response) => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`Request failed with status ${response.statusCode}`));
          response.resume();
          return;
        }

        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => {
          try {
            resolve(JSON.parse(body));
          } catch (error) {
            reject(error);
          }
        });
      })
      .on("error", reject);
  });
}

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (response) => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`Image request failed with status ${response.statusCode}`));
          response.resume();
          return;
        }

        const chunks = [];
        response.on("data", (chunk) => {
          chunks.push(chunk);
        });
        response.on("end", () => {
          resolve(Buffer.concat(chunks));
        });
      })
      .on("error", reject);
  });
}

function toText(value) {
  if (Array.isArray(value)) {
    return value.join("/");
  }
  return value || "";
}

function getImagePath(item) {
  const firstImage = Array.isArray(item.images) && item.images.length ? item.images[0] : "";
  return firstImage || "";
}

function getImageUrl(item) {
  const imagePath = getImagePath(item);
  return imagePath ? `${IMAGE_BASE}/${imagePath}` : "";
}

async function ensureCollection(name) {
  try {
    await db.createCollection(name);
  } catch (error) {
    const message = error && (error.errMsg || error.message || "");
    const code = error && error.errCode;
    const exists =
      code === -501001 ||
      message.includes("already exists") ||
      message.includes("collection exists") ||
      message.includes("ResourceExist") ||
      message.includes("Table exist") ||
      message.includes("DATABASE_COLLECTION_ALREADY_EXIST");

    if (!exists) {
      console.warn(`Failed to create collection ${name}`, error);
    }
  }
}

async function uploadFirstImage(item) {
  const imagePath = getImagePath(item);
  if (!imagePath) {
    return "";
  }

  const imageUrl = `${IMAGE_BASE}/${imagePath}`;
  const fileName = imagePath.split("/").pop();
  const cloudPath = `exercise-images/${item.id}/${fileName}`;
  const fileContent = await fetchBuffer(imageUrl);
  const result = await cloud.uploadFile({
    cloudPath,
    fileContent
  });
  return result.fileID;
}

async function normalizeExercise(item, options = {}) {
  const primaryMusclesText = toText(item.primaryMuscles);
  const secondaryMusclesText = toText(item.secondaryMuscles);
  const imageFileId = options.uploadImages ? await uploadFirstImage(item) : "";
  const rawImageUrl = getImageUrl(item);

  return {
    exerciseId: item.id,
    name: item.name,
    force: item.force || "",
    level: item.level || "",
    mechanic: item.mechanic || "",
    equipment: item.equipment || "body only",
    muscle: primaryMusclesText || "other",
    primaryMuscles: item.primaryMuscles || [],
    primaryMusclesText,
    secondaryMuscles: item.secondaryMuscles || [],
    secondaryMusclesText,
    instructions: item.instructions || [],
    category: item.category || "",
    images: item.images || [],
    imageUrl: imageFileId || rawImageUrl,
    imageFileId,
    rawImageUrl,
    source: "yuhonas/free-exercise-db",
    updatedAt: Date.now()
  };
}

async function upsertExercise(item, options) {
  const data = await normalizeExercise(item, options);
  const exists = await db.collection(EXERCISES).where({ exerciseId: data.exerciseId }).limit(1).get();

  if (exists.data.length) {
    await db.collection(EXERCISES).doc(exists.data[0]._id).update({ data });
    return "updated";
  }

  await db.collection(EXERCISES).add({ data });
  return "created";
}

exports.main = async (event = {}) => {
  await ensureCollection(EXERCISES);

  const limit = event.limit ? Number(event.limit) : 10;
  const offset = event.offset ? Number(event.offset) : 0;
  const uploadImages = Boolean(event.uploadImages);
  const raw = await fetchJson(event.url || DATA_URL);
  const items = Array.isArray(raw) ? raw : raw.exercises || [];
  const selected = limit > 0 ? items.slice(offset, offset + limit) : items.slice(offset);

  let created = 0;
  let updated = 0;
  let failed = 0;

  for (const item of selected) {
    try {
      const result = await upsertExercise(item, { uploadImages });
      if (result === "created") {
        created += 1;
      } else {
        updated += 1;
      }
    } catch (error) {
      failed += 1;
      console.error(`Failed to import ${item.id}`, error);
    }
  }

  return {
    source: event.url || DATA_URL,
    total: items.length,
    offset,
    imported: selected.length,
    created,
    updated,
    failed,
    uploadImages
  };
};
