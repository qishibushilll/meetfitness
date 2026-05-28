const cloud = require("wx-server-sdk");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

const COLLECTIONS = {
  submissions: "exerciseSubmissions",
  exercises: "exercises",
  learnContents: "learnContents",
  users: "users",
  workouts: "workouts",
  meals: "meals"
};
const TEMP_URL_BATCH_SIZE = 50;

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

function cleanNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function limitFromEvent(event) {
  return Math.min(Math.max(Number(event.limit) || 50, 1), 1000);
}

function skipFromEvent(event) {
  return Math.max(Number(event.skip) || Number(event.offset) || 0, 0);
}

async function ensureAdmin(openid) {
  await ensureCollection(COLLECTIONS.users);

  const bySystemOpenid = await db
    .collection(COLLECTIONS.users)
    .where({ _openid: openid, role: "admin", registered: true })
    .limit(1)
    .get();

  if (bySystemOpenid.data.length) {
    return bySystemOpenid.data[0];
  }

  const byOpenid = await db
    .collection(COLLECTIONS.users)
    .where({ openid, role: "admin", registered: true })
    .limit(1)
    .get();

  if (!byOpenid.data.length) {
    throw new Error("Permission denied");
  }

  return byOpenid.data[0];
}

async function findUserByOpenid(openid) {
  const bySystemOpenid = await db.collection(COLLECTIONS.users).where({ _openid: openid }).limit(1).get();
  if (bySystemOpenid.data.length) {
    return bySystemOpenid.data[0];
  }

  const byOpenid = await db.collection(COLLECTIONS.users).where({ openid }).limit(1).get();
  return byOpenid.data[0] || null;
}

async function countCollection(name) {
  await ensureCollection(name);
  const result = await db.collection(name).count();
  return result.total || 0;
}

async function dashboard() {
  const [exercises, learnContents, meals, workouts, users, submissions] = await Promise.all([
    countCollection(COLLECTIONS.exercises),
    countCollection(COLLECTIONS.learnContents),
    countCollection(COLLECTIONS.meals),
    countCollection(COLLECTIONS.workouts),
    countCollection(COLLECTIONS.users),
    countCollection(COLLECTIONS.submissions)
  ]);

  return {
    stats: {
      exercises,
      learnContents,
      meals,
      workouts,
      users,
      submissions
    }
  };
}

async function withTempUrls(data, sourceField, targetField) {
  const fileIds = data
    .map((item) => item[sourceField] || item[targetField])
    .filter((fileId) => fileId && String(fileId).startsWith("cloud://"));

  if (!fileIds.length) {
    return data;
  }

  const urlMap = {};
  const uniqueFileIds = Array.from(new Set(fileIds));
  const tasks = [];

  for (let i = 0; i < uniqueFileIds.length; i += TEMP_URL_BATCH_SIZE) {
    const fileList = uniqueFileIds.slice(i, i + TEMP_URL_BATCH_SIZE);
    tasks.push(
      cloud
        .getTempFileURL({ fileList })
        .then((result) => result.fileList || [])
        .catch((error) => {
          console.warn("Failed to get temp file URLs", error);
          return [];
        })
    );
  }

  const results = await Promise.all(tasks);
  results.flat().forEach((item) => {
    if (item.tempFileURL) {
      urlMap[item.fileID] = item.tempFileURL;
    }
  });

  return data.map((item) => {
    const fileId = item[sourceField] || item[targetField];
    return {
      ...item,
      [targetField]: urlMap[fileId] || item[targetField]
    };
  });
}

async function resolveDocId(collection, id) {
  const value = cleanText(id);
  if (!value) {
    throw new Error("id is required");
  }

  try {
    const result = await db.collection(collection).doc(value).get();
    if (result.data && result.data._id) {
      return result.data._id;
    }
  } catch (error) {
    // Fall through to record-id lookups for legacy records.
  }

  const byId = await db.collection(collection).where({ id: value }).limit(1).get();
  if (byId.data.length) {
    return byId.data[0]._id;
  }

  if (collection === COLLECTIONS.exercises) {
    const byExerciseId = await db.collection(collection).where({ exerciseId: value }).limit(1).get();
    if (byExerciseId.data.length) {
      return byExerciseId.data[0]._id;
    }
  }

  return value;
}

async function removeById(collection, id) {
  await ensureCollection(collection);
  const docId = await resolveDocId(collection, id);
  await db.collection(collection).doc(docId).remove();
  return { id: docId };
}

async function updateById(collection, id, data) {
  await ensureCollection(collection);
  const docId = await resolveDocId(collection, id);
  await db.collection(collection).doc(docId).update({ data });
  return { id: docId, ...data };
}

async function listUsers(event) {
  await ensureCollection(COLLECTIONS.users);
  const result = await db
    .collection(COLLECTIONS.users)
    .orderBy("updatedAt", "desc")
    .limit(limitFromEvent(event))
    .get();

  const users = result.data.map((item) => ({
    ...item,
    id: item._id,
    openid: item._openid || item.openid || ""
  }));

  return {
    users: await withTempUrls(users, "avatarFileId", "avatarUrl")
  };
}

async function setUserRole(openid, event) {
  const id = cleanText(event.id);
  const role = event.role === "admin" ? "admin" : "user";
  if (!id) {
    throw new Error("id is required");
  }

  const current = await findUserByOpenid(openid);
  if (current && current._id === id && role !== "admin") {
    throw new Error("Cannot remove your own admin role");
  }

  return updateById(COLLECTIONS.users, id, {
    role,
    updatedAt: Date.now()
  });
}

async function deleteUser(openid, event) {
  const id = cleanText(event.id);
  const current = await findUserByOpenid(openid);
  if (current && current._id === id) {
    throw new Error("Cannot delete your own account");
  }

  return removeById(COLLECTIONS.users, id);
}

function keywordCondition(keyword) {
  const value = cleanText(keyword);
  if (!value) {
    return null;
  }

  const matcher = db.RegExp({
    regexp: value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    options: "i"
  });

  return _.or([
    { name: matcher },
    { displayName: matcher },
    { nameZh: matcher },
    { muscle: matcher },
    { muscleZh: matcher },
    { equipment: matcher },
    { equipmentZh: matcher },
    { primaryMusclesText: matcher }
  ]);
}

async function listExercises(event) {
  await ensureCollection(COLLECTIONS.exercises);
  const condition = keywordCondition(event.keyword);
  let query = db.collection(COLLECTIONS.exercises);
  if (condition) {
    query = query.where(condition);
  }

  const result = await query.orderBy("name", "asc").skip(skipFromEvent(event)).limit(limitFromEvent(event)).get();

  return {
    exercises: await withTempUrls(result.data, "imageFileId", "imageUrl")
  };
}

function buildExercisePayload(payload = {}) {
  const name = cleanText(payload.nameZh || payload.displayName || payload.name);
  const muscle = cleanText(payload.muscleZh || payload.muscle) || "其他";
  const equipment = cleanText(payload.equipmentZh || payload.equipment) || "其他";

  if (!name) {
    throw new Error("exercise name is required");
  }

  return {
    name: cleanText(payload.nameEn || payload.name) || name,
    displayName: name,
    nameZh: name,
    muscle,
    muscleZh: muscle,
    equipment,
    equipmentZh: equipment,
    imageUrl: cleanText(payload.imageUrl),
    imageFileId: cleanText(payload.imageFileId),
    rawImageUrl: cleanText(payload.rawImageUrl || payload.imageUrl),
    category: cleanText(payload.category) || "custom",
    categoryZh: cleanText(payload.categoryZh) || "管理员维护",
    level: cleanText(payload.level),
    levelZh: cleanText(payload.levelZh),
    updatedAt: Date.now()
  };
}

async function saveExercise(event) {
  await ensureCollection(COLLECTIONS.exercises);
  const payload = event.exercise || {};
  const id = cleanText(payload.id || payload._id || payload.docId);
  const data = buildExercisePayload(payload);

  if (id) {
    return updateById(COLLECTIONS.exercises, id, data);
  }

  const exerciseId = cleanText(payload.exerciseId) || `custom_admin_${Date.now()}`;
  const record = {
    ...data,
    id: exerciseId,
    exerciseId,
    source: "admin",
    createdAt: Date.now()
  };
  const result = await db.collection(COLLECTIONS.exercises).add({ data: record });
  return { id: result._id, ...record };
}

async function listLearnContents(event) {
  await ensureCollection(COLLECTIONS.learnContents);
  const result = await db
    .collection(COLLECTIONS.learnContents)
    .orderBy("sort", "asc")
    .limit(limitFromEvent(event))
    .get();

  return {
    learnContents: await withTempUrls(result.data, "coverFileId", "coverUrl")
  };
}

function buildLearnContentPayload(payload = {}) {
  const title = cleanText(payload.title);
  const muscle = cleanText(payload.muscle);
  if (!title || !muscle) {
    throw new Error("title and muscle are required");
  }

  return {
    title,
    muscle,
    summary: cleanText(payload.summary),
    type: cleanText(payload.type) || "video",
    durationText: cleanText(payload.durationText),
    coverUrl: cleanText(payload.coverUrl),
    coverFileId: cleanText(payload.coverFileId),
    videoUrl: cleanText(payload.videoUrl),
    videoFileId: cleanText(payload.videoFileId),
    status: payload.status === "draft" ? "draft" : "published",
    sort: cleanNumber(payload.sort),
    updatedAt: Date.now()
  };
}

async function saveLearnContent(event) {
  await ensureCollection(COLLECTIONS.learnContents);
  const payload = event.learnContent || {};
  const id = cleanText(payload.id || payload._id || payload.docId);
  const data = buildLearnContentPayload(payload);

  if (id) {
    return updateById(COLLECTIONS.learnContents, id, data);
  }

  const record = {
    ...data,
    createdAt: Date.now()
  };
  const result = await db.collection(COLLECTIONS.learnContents).add({ data: record });
  return { id: result._id, ...record };
}

async function listWorkouts(event) {
  await ensureCollection(COLLECTIONS.workouts);
  const result = await db
    .collection(COLLECTIONS.workouts)
    .orderBy("createdAt", "desc")
    .limit(limitFromEvent(event))
    .get();

  return {
    workouts: await withTempUrls(result.data, "exerciseImageFileId", "exerciseImageUrl")
  };
}

function buildWorkoutPayload(payload = {}) {
  const exerciseName = cleanText(payload.exerciseName);
  if (!exerciseName) {
    throw new Error("exerciseName is required");
  }

  return {
    date: cleanText(payload.date),
    exerciseId: cleanText(payload.exerciseId),
    exerciseName,
    exerciseNameEn: cleanText(payload.exerciseNameEn),
    exerciseImageUrl: cleanText(payload.exerciseImageUrl),
    sets: cleanNumber(payload.sets),
    reps: cleanNumber(payload.reps),
    weight: cleanNumber(payload.weight),
    note: cleanText(payload.note),
    updatedAt: Date.now()
  };
}

async function saveWorkout(event) {
  const payload = event.workout || {};
  const id = cleanText(payload.id || payload._id || payload.docId);
  if (!id) {
    throw new Error("id is required");
  }

  return updateById(COLLECTIONS.workouts, id, buildWorkoutPayload(payload));
}

async function listMeals(event) {
  await ensureCollection(COLLECTIONS.meals);
  const result = await db
    .collection(COLLECTIONS.meals)
    .orderBy("createdAt", "desc")
    .limit(limitFromEvent(event))
    .get();

  return {
    meals: result.data
  };
}

function buildMealPayload(payload = {}) {
  const food = cleanText(payload.food);
  if (!food) {
    throw new Error("food is required");
  }

  return {
    date: cleanText(payload.date),
    type: cleanText(payload.type) || "加餐",
    food,
    calories: cleanNumber(payload.calories),
    protein: cleanNumber(payload.protein),
    note: cleanText(payload.note),
    updatedAt: Date.now()
  };
}

async function saveMeal(event) {
  const payload = event.meal || {};
  const id = cleanText(payload.id || payload._id || payload.docId);
  if (!id) {
    throw new Error("id is required");
  }

  return updateById(COLLECTIONS.meals, id, buildMealPayload(payload));
}

async function listSubmissions(event) {
  await ensureCollection(COLLECTIONS.submissions);
  const status = cleanText(event.status || "pending");
  let query = db.collection(COLLECTIONS.submissions);
  if (status && status !== "all") {
    query = query.where({ status });
  }

  const result = await query.orderBy("createdAt", "desc").limit(limitFromEvent(event)).get();
  return {
    submissions: await withTempUrls(result.data, "imageFileId", "imageUrl")
  };
}

function buildExerciseFromSubmission(submission) {
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
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}

async function approve(openid, event) {
  await ensureCollection(COLLECTIONS.exercises);

  const id = cleanText(event.id);
  const submissionResult = await db.collection(COLLECTIONS.submissions).doc(id).get();
  const submission = submissionResult.data;

  if (!submission || submission.status !== "pending") {
    throw new Error("Submission is not pending");
  }

  const exercise = buildExerciseFromSubmission(submission);
  await db.collection(COLLECTIONS.exercises).add({ data: exercise });
  await db.collection(COLLECTIONS.submissions).doc(id).update({
    data: {
      status: "approved",
      reviewedBy: openid,
      reviewNote: cleanText(event.reviewNote),
      approvedExerciseId: exercise.exerciseId,
      updatedAt: Date.now()
    }
  });

  return { exercise };
}

async function reject(openid, event) {
  const id = cleanText(event.id);
  await db.collection(COLLECTIONS.submissions).doc(id).update({
    data: {
      status: "rejected",
      reviewedBy: openid,
      reviewNote: cleanText(event.reviewNote),
      updatedAt: Date.now()
    }
  });
  return { id };
}

exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext();
  await ensureAdmin(OPENID);

  const action = event.action || "dashboard";

  if (action === "dashboard") return dashboard();
  if (action === "listUsers") return listUsers(event);
  if (action === "setUserRole") return setUserRole(OPENID, event);
  if (action === "deleteUser") return deleteUser(OPENID, event);

  if (action === "listExercises") return listExercises(event);
  if (action === "saveExercise") return saveExercise(event);
  if (action === "deleteExercise") return removeById(COLLECTIONS.exercises, event.id);

  if (action === "listLearnContents") return listLearnContents(event);
  if (action === "saveLearnContent") return saveLearnContent(event);
  if (action === "deleteLearnContent") return removeById(COLLECTIONS.learnContents, event.id);

  if (action === "listWorkouts") return listWorkouts(event);
  if (action === "saveWorkout") return saveWorkout(event);
  if (action === "deleteWorkout") return removeById(COLLECTIONS.workouts, event.id);

  if (action === "listMeals") return listMeals(event);
  if (action === "saveMeal") return saveMeal(event);
  if (action === "deleteMeal") return removeById(COLLECTIONS.meals, event.id);

  if (action === "listSubmissions" || action === "listPending") return listSubmissions(event);
  if (action === "approve") return approve(OPENID, event);
  if (action === "reject") return reject(OPENID, event);
  if (action === "deleteSubmission") return removeById(COLLECTIONS.submissions, event.id);

  throw new Error(`Unsupported action: ${action}`);
};
