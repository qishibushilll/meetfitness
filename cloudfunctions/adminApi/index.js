const cloud = require("wx-server-sdk");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const SUBMISSIONS = "exerciseSubmissions";
const EXERCISES = "exercises";
const USERS = "users";

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

async function ensureAdmin(openid) {
  const result = await db.collection(USERS).where({ _openid: openid, role: "admin" }).limit(1).get();
  if (!result.data.length) {
    throw new Error("Permission denied");
  }
}

async function withTempImageUrls(data) {
  const fileIds = data
    .map((item) => item.imageFileId)
    .filter((fileId) => fileId && fileId.startsWith("cloud://"));

  if (!fileIds.length) {
    return data;
  }

  const result = await cloud.getTempFileURL({ fileList: fileIds });
  const urlMap = {};
  result.fileList.forEach((item) => {
    if (item.tempFileURL) {
      urlMap[item.fileID] = item.tempFileURL;
    }
  });

  return data.map((item) => ({
    ...item,
    imageUrl: urlMap[item.imageFileId] || item.imageUrl
  }));
}

async function listPending() {
  const result = await db
    .collection(SUBMISSIONS)
    .where({ status: "pending" })
    .orderBy("createdAt", "desc")
    .limit(50)
    .get();
  return withTempImageUrls(result.data);
}

function buildExercise(submission) {
  const exerciseId = `custom_${submission._id}`;
  return {
    exerciseId,
    id: exerciseId,
    name: submission.name,
    displayName: submission.nameZh || submission.name,
    nameZh: submission.nameZh || submission.name,
    muscle: submission.muscle || submission.muscleZh || "其他",
    muscleZh: submission.muscleZh || submission.muscle || "其他",
    equipment: submission.equipment || submission.equipmentZh || "其他",
    equipmentZh: submission.equipmentZh || submission.equipment || "其他",
    category: "custom",
    categoryZh: "用户提交",
    level: "",
    levelZh: "",
    instructions: submission.note ? [submission.note] : [],
    imageUrl: submission.imageUrl || "",
    imageFileId: submission.imageFileId || "",
    rawImageUrl: submission.imageUrl || "",
    source: "user-submission",
    submissionId: submission._id,
    updatedAt: Date.now()
  };
}

async function approve(openid, id, reviewNote) {
  const submissionResult = await db.collection(SUBMISSIONS).doc(id).get();
  const submission = submissionResult.data;

  if (!submission || submission.status !== "pending") {
    throw new Error("Submission is not pending");
  }

  const exercise = buildExercise(submission);
  await db.collection(EXERCISES).add({ data: exercise });
  await db.collection(SUBMISSIONS).doc(id).update({
    data: {
      status: "approved",
      reviewedBy: openid,
      reviewNote: reviewNote || "",
      approvedExerciseId: exercise.exerciseId,
      updatedAt: Date.now()
    }
  });

  return { exercise };
}

async function reject(openid, id, reviewNote) {
  await db.collection(SUBMISSIONS).doc(id).update({
    data: {
      status: "rejected",
      reviewedBy: openid,
      reviewNote: reviewNote || "",
      updatedAt: Date.now()
    }
  });
  return { id };
}

exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext();
  await ensureAdmin(OPENID);
  await ensureCollection(SUBMISSIONS);

  const action = event.action || "listPending";

  if (action === "approve") {
    await ensureCollection(EXERCISES);
    return approve(OPENID, event.id, event.reviewNote);
  }

  if (action === "reject") {
    return reject(OPENID, event.id, event.reviewNote);
  }

  return {
    submissions: await listPending()
  };
};
