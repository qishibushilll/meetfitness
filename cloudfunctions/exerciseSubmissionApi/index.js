const cloud = require("wx-server-sdk");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const SUBMISSIONS = "exerciseSubmissions";

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

function cleanText(value) {
  return String(value || "").trim();
}

exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext();
  const action = event.action || "submit";

  if (action !== "submit") {
    throw new Error("Unsupported action");
  }

  await ensureCollection(SUBMISSIONS);

  const payload = event.exercise || {};
  const name = cleanText(payload.name);
  const muscle = cleanText(payload.muscle);
  const equipment = cleanText(payload.equipment);

  if (!name || !muscle) {
    throw new Error("name and muscle are required");
  }

  const record = {
    name,
    nameZh: name,
    muscle,
    muscleZh: muscle,
    equipment: equipment || "其他",
    equipmentZh: equipment || "其他",
    note: cleanText(payload.note),
    imageUrl: cleanText(payload.imageUrl),
    imageFileId: cleanText(payload.imageFileId),
    status: "pending",
    submittedBy: OPENID,
    reviewedBy: "",
    reviewNote: "",
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  const result = await db.collection(SUBMISSIONS).add({ data: record });
  return {
    id: result._id,
    ...record
  };
};
