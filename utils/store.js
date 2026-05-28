const { formatDate } = require("./date");
const { translateExercise } = require("./exerciseTranslate");

const KEYS = {
  workouts: "fitness.workouts",
  meals: "fitness.meals",
  exercises: "fitness.exercises",
  userProfile: "fitness.userProfile",
  exerciseSubmissions: "fitness.exerciseSubmissions",
  learnContents: "fitness.learnContents"
};

const COLLECTIONS = {
  workouts: "workouts",
  meals: "meals",
  exercises: "exercises",
  users: "users",
  exerciseSubmissions: "exerciseSubmissions",
  learnContents: "learnContents"
};
const TEMP_URL_BATCH_SIZE = 50;

const DEFAULT_LEARN_CONTENTS = [
  {
    id: "learn_chest_basics",
    muscle: "胸部",
    title: "胸部训练入门",
    summary: "了解卧推动作、肩胛稳定和推类训练常见错误。",
    type: "guide",
    durationText: "3 分钟",
    coverUrl: "/assets/app-icon-256.png",
    videoUrl: "",
    sort: 10,
    status: "published"
  },
  {
    id: "learn_back_basics",
    muscle: "背阔肌",
    title: "背部发力基础",
    summary: "学习下拉、划船和肩胛控制，减少手臂代偿。",
    type: "guide",
    durationText: "4 分钟",
    coverUrl: "/assets/app-icon-256.png",
    videoUrl: "",
    sort: 10,
    status: "published"
  }
];

const DEFAULT_EXERCISES = [
  {
    id: "bench_press",
    name: "杠铃卧推",
    muscle: "胸",
    equipment: "杠铃",
    imageUrl: "/assets/app-icon-256.png"
  },
  {
    id: "squat",
    name: "深蹲",
    muscle: "腿",
    equipment: "杠铃",
    imageUrl: "/assets/app-icon-256.png"
  },
  {
    id: "deadlift",
    name: "硬拉",
    muscle: "背/腿",
    equipment: "杠铃",
    imageUrl: "/assets/app-icon-256.png"
  },
  {
    id: "pull_up",
    name: "引体向上",
    muscle: "背",
    equipment: "自重",
    imageUrl: "/assets/app-icon-256.png"
  }
];

function canUseCloud() {
  return Boolean(wx.cloud && wx.cloud.database);
}

function db() {
  return wx.cloud.database();
}

function getList(key) {
  return wx.getStorageSync(key) || [];
}

function setList(key, value) {
  wx.setStorageSync(key, value);
}

function ensureSeedData() {
  if (!wx.getStorageSync(KEYS.exercises)) {
    setList(KEYS.exercises, DEFAULT_EXERCISES);
  }
}

function normalizeExercise(item) {
  const imageUrl = item.imageUrl || item.image || item.thumbnail || "/assets/app-icon-256.png";
  const translated = translateExercise(item);
  const cloudName = item.nameZh || item.displayName || "";
  const name = /[\u4e00-\u9fa5]/.test(cloudName)
    ? cloudName
    : translated.nameZh || item.name || item.title || "未命名动作";
  const nameEn = item.name || item.title || "";
  const muscle =
    item.muscleZh ||
    translated.muscleZh ||
    item.muscle ||
    item.primaryMusclesText ||
    (item.primaryMuscles || []).join("/") ||
    "未分类";
  const equipment = item.equipmentZh || translated.equipmentZh || item.equipment || item.equipmentText || "未知器械";

  return {
    ...item,
    id: item.exerciseId || item.id || item._id,
    exerciseId: item.exerciseId || item.id || item._id,
    name,
    nameEn,
    muscle,
    equipment,
    imageUrl
  };
}

function normalizeWorkout(item) {
  return {
    ...item,
    id: item.id || item._id,
    sets: Number(item.sets) || 0,
    reps: Number(item.reps) || 0,
    weight: Number(item.weight) || 0
  };
}

function normalizeMeal(item) {
  return {
    ...item,
    id: item.id || item._id,
    calories: Number(item.calories) || 0,
    protein: Number(item.protein) || 0
  };
}

async function getTempUrlMap(fileIds) {
  if (!wx.cloud || !wx.cloud.getTempFileURL) {
    return {};
  }

  const uniqueFileIds = Array.from(new Set(fileIds.filter((fileId) => fileId && String(fileId).startsWith("cloud://"))));
  const urlMap = {};

  for (let i = 0; i < uniqueFileIds.length; i += TEMP_URL_BATCH_SIZE) {
    const fileList = uniqueFileIds.slice(i, i + TEMP_URL_BATCH_SIZE);
    try {
      const result = await wx.cloud.getTempFileURL({ fileList });
      (result.fileList || []).forEach((item) => {
        if (item.tempFileURL) {
          urlMap[item.fileID] = item.tempFileURL;
        }
      });
    } catch (error) {
      console.warn("Failed to get temp file URLs", error);
    }
  }

  return urlMap;
}

async function withExerciseTempUrls(items) {
  const fileIds = items.map((item) => item.imageFileId).filter(Boolean);
  const urlMap = await getTempUrlMap(fileIds);
  return items.map((item) => ({
    ...item,
    imageUrl: urlMap[item.imageFileId] || item.imageUrl || item.rawImageUrl
  }));
}

async function loadExercisesFromDb(options = {}) {
  const limit = Math.min(Math.max(Number(options.limit) || 100, 1), 1000);
  const keyword = (options.keyword || "").trim().toLowerCase();
  const pageSize = 100;
  const rows = [];

  for (let offset = 0; offset < limit; offset += pageSize) {
    const result = await db()
      .collection(COLLECTIONS.exercises)
      .orderBy("name", "asc")
      .skip(offset)
      .limit(Math.min(pageSize, limit - offset))
      .get();
    rows.push(...(result.data || []));
    if (!result.data || result.data.length < pageSize) {
      break;
    }
  }

  let data = await withExerciseTempUrls(rows);

  if (keyword) {
    data = data.filter((item) => {
      const fields = [
        item.name,
        item.nameZh,
        item.displayName,
        item.muscle,
        item.muscleZh,
        item.equipment,
        item.equipmentZh,
        item.categoryZh,
        item.levelZh,
        item.primaryMusclesText
      ];
      return fields.some((field) => String(field || "").toLowerCase().includes(keyword));
    });
  }

  return data.map(normalizeExercise);
}

function normalizeUserProfile(item = {}) {
  return {
    id: item._id || item.id || "",
    openid: item._openid || item.openid || "",
    nickName: item.nickName || "",
    avatarUrl: item.avatarUrl || "",
    avatarFileId: item.avatarFileId || "",
    gender: item.gender || "",
    role: item.role === "admin" ? "admin" : "user",
    registered: Boolean(item.registered),
    createdAt: item.createdAt || Date.now(),
    updatedAt: item.updatedAt || Date.now()
  };
}

function normalizeExerciseSubmission(item = {}) {
  const createdAt = item.createdAt || Date.now();
  const createdAtDate = new Date(createdAt);
  const createdAtText = Number.isNaN(createdAtDate.getTime())
    ? ""
    : `${createdAtDate.getFullYear()}-${String(createdAtDate.getMonth() + 1).padStart(2, "0")}-${String(
        createdAtDate.getDate()
      ).padStart(2, "0")} ${String(createdAtDate.getHours()).padStart(2, "0")}:${String(
        createdAtDate.getMinutes()
      ).padStart(2, "0")}`;

  return {
    ...item,
    id: item._id || item.id || "",
    name: item.nameZh || item.name || "未命名动作",
    muscle: item.muscleZh || item.muscle || "其他",
    equipment: item.equipmentZh || item.equipment || "其他",
    note: item.note || "",
    imageUrl: item.imageUrl || "/assets/app-icon-256.png",
    imageFileId: item.imageFileId || "",
    status: item.status || "pending",
    createdAt,
    createdAtText
  };
}

function normalizeLearnContent(item = {}) {
  return {
    ...item,
    id: item._id || item.id || "",
    title: item.title || "未命名学习内容",
    summary: item.summary || "",
    muscle: item.muscle || "",
    type: item.type || "video",
    durationText: item.durationText || "",
    coverUrl: item.coverUrl || "/assets/app-icon-256.png",
    coverFileId: item.coverFileId || "",
    videoUrl: item.videoUrl || "",
    videoFileId: item.videoFileId || "",
    sort: Number(item.sort) || 0,
    status: item.status || "published",
    hasVideo: Boolean(item.videoUrl || item.videoFileId)
  };
}

function normalizeAdminUser(item = {}) {
  const updatedAt = item.updatedAt || item.createdAt || Date.now();
  const updatedAtDate = new Date(updatedAt);
  const updatedAtText = Number.isNaN(updatedAtDate.getTime())
    ? ""
    : `${updatedAtDate.getFullYear()}-${String(updatedAtDate.getMonth() + 1).padStart(2, "0")}-${String(
        updatedAtDate.getDate()
      ).padStart(2, "0")}`;

  return {
    ...item,
    id: item._id || item.id || "",
    openid: item._openid || item.openid || "",
    nickName: item.nickName || "未命名用户",
    role: item.role === "admin" ? "admin" : "user",
    roleText: item.role === "admin" ? "管理员" : "用户",
    registered: Boolean(item.registered),
    registeredText: item.registered ? "已登录" : "未完成",
    avatarUrl: item.avatarUrl || "/assets/app-icon-256.png",
    updatedAtText
  };
}

function normalizeAdminWorkout(item = {}) {
  const normalized = normalizeWorkout(item);
  return {
    ...normalized,
    docId: item._id || item.docId || normalized.id,
    ownerOpenid: item._openid || item.ownerOpenid || "",
    title: normalized.exerciseName || "未命名训练",
    meta: `${normalized.date || "未设置日期"} · ${normalized.sets} 组 x ${normalized.reps} 次 · ${normalized.weight} kg`
  };
}

function normalizeAdminMeal(item = {}) {
  const normalized = normalizeMeal(item);
  return {
    ...normalized,
    docId: item._id || item.docId || normalized.id,
    ownerOpenid: item._openid || item.ownerOpenid || "",
    title: `${normalized.type || "饮食"} · ${normalized.food || "未命名食物"}`,
    meta: `${normalized.date || "未设置日期"} · ${normalized.calories} kcal · 蛋白质 ${normalized.protein} g`
  };
}

function normalizeAdminExercise(item = {}) {
  const normalized = normalizeExercise(item);
  return {
    ...normalized,
    docId: item._id || item.docId || normalized.id,
    title: normalized.name,
    meta: `${normalized.muscle} · ${normalized.equipment}`
  };
}

function normalizeAdminLearnContent(item = {}) {
  const normalized = normalizeLearnContent(item);
  return {
    ...normalized,
    docId: item._id || item.docId || normalized.id,
    title: normalized.title,
    meta: `${normalized.muscle} · ${normalized.status === "draft" ? "草稿" : "已发布"} · 排序 ${normalized.sort}`
  };
}

async function callAdminApi(action, data = {}) {
  if (!canUseCloud()) {
    throw new Error("Cloud admin API is unavailable");
  }

  const result = await wx.cloud.callFunction({
    name: "adminApi",
    data: {
      ...data,
      action
    }
  });
  return result.result || {};
}

async function getUserProfile() {
  const cached = wx.getStorageSync(KEYS.userProfile);

  if (!canUseCloud()) {
    return cached || normalizeUserProfile();
  }

  try {
    const result = await wx.cloud.callFunction({
      name: "userApi",
      data: {
        action: "login"
      }
    });
    const profile = normalizeUserProfile(result.result.user);
    if (!profile.registered && cached && cached.registered && cached.nickName) {
      return updateUserProfile({
        nickName: cached.nickName,
        avatarUrl: cached.avatarUrl || "",
        avatarFileId: cached.avatarFileId || "",
        gender: cached.gender || ""
      });
    }
    wx.setStorageSync(KEYS.userProfile, profile);
    return profile;
  } catch (error) {
    console.warn("Failed to load user profile from cloud", error);
    return cached || normalizeUserProfile();
  }
}

async function updateUserProfile(payload) {
  if (!canUseCloud()) {
    const profile = normalizeUserProfile({
      ...payload,
      registered: true,
      role: "user"
    });
    wx.setStorageSync(KEYS.userProfile, profile);
    return profile;
  }

  const result = await wx.cloud.callFunction({
    name: "userApi",
    data: {
      action: "updateProfile",
      profile: payload
    }
  });
  const profile = normalizeUserProfile(result.result.user);
  wx.setStorageSync(KEYS.userProfile, profile);
  return profile;
}

async function getAdminStats() {
  if (!canUseCloud()) {
    const workouts = getList(KEYS.workouts);
    const meals = getList(KEYS.meals);
    const exercises = getList(KEYS.exercises);
    return {
      exercises: exercises.length,
      meals: meals.length,
      workouts: workouts.length,
      users: 0,
      submissions: getList(KEYS.exerciseSubmissions || "fitness.exerciseSubmissions").length
    };
  }

  const result = await callAdminApi("dashboard");
  return result.stats || { exercises: 0, learnContents: 0, meals: 0, workouts: 0, users: 0, submissions: 0 };
}

async function getPendingExerciseSubmissions() {
  if (!canUseCloud()) {
    return getList(KEYS.exerciseSubmissions || "fitness.exerciseSubmissions")
      .filter((item) => item.status === "pending")
      .map(normalizeExerciseSubmission);
  }

  const result = await wx.cloud.callFunction({
    name: "adminApi",
    data: {
      action: "listPending"
    }
  });

  return (result.result.submissions || []).map(normalizeExerciseSubmission);
}

async function reviewExerciseSubmission(id, decision, reviewNote = "") {
  if (!canUseCloud()) {
    return { id, decision };
  }

  const result = await wx.cloud.callFunction({
    name: "adminApi",
    data: {
      action: decision === "reject" ? "reject" : "approve",
      id,
      reviewNote
    }
  });

  wx.removeStorageSync(KEYS.exercises);
  return result.result;
}

async function getAdminUsers() {
  const result = await callAdminApi("listUsers");
  return (result.users || []).map(normalizeAdminUser);
}

async function setAdminUserRole(id, role) {
  return callAdminApi("setUserRole", { id, role });
}

async function deleteAdminUser(id) {
  return callAdminApi("deleteUser", { id });
}

async function getAdminExercises() {
  if (!canUseCloud()) {
    return getList(KEYS.exercises).map(normalizeAdminExercise);
  }

  const result = await callAdminApi("listExercises");
  return (result.exercises || []).map(normalizeAdminExercise);
}

async function saveAdminExercise(exercise) {
  const result = await callAdminApi("saveExercise", { exercise });
  wx.removeStorageSync(KEYS.exercises);
  return result;
}

async function deleteAdminExercise(id) {
  const result = await callAdminApi("deleteExercise", { id });
  wx.removeStorageSync(KEYS.exercises);
  return result;
}

async function getAdminLearnContents() {
  const result = await callAdminApi("listLearnContents");
  return (result.learnContents || []).map(normalizeAdminLearnContent);
}

async function saveAdminLearnContent(learnContent) {
  return callAdminApi("saveLearnContent", { learnContent });
}

async function deleteAdminLearnContent(id) {
  return callAdminApi("deleteLearnContent", { id });
}

async function getAdminWorkouts() {
  if (!canUseCloud()) {
    return getList(KEYS.workouts).map(normalizeAdminWorkout);
  }

  const result = await callAdminApi("listWorkouts");
  return (result.workouts || []).map(normalizeAdminWorkout);
}

async function saveAdminWorkout(workout) {
  return callAdminApi("saveWorkout", { workout });
}

async function deleteAdminWorkout(id) {
  return callAdminApi("deleteWorkout", { id });
}

async function getAdminMeals() {
  if (!canUseCloud()) {
    return getList(KEYS.meals).map(normalizeAdminMeal);
  }

  const result = await callAdminApi("listMeals");
  return (result.meals || []).map(normalizeAdminMeal);
}

async function saveAdminMeal(meal) {
  return callAdminApi("saveMeal", { meal });
}

async function deleteAdminMeal(id) {
  return callAdminApi("deleteMeal", { id });
}

async function getAdminExerciseSubmissions(status = "all") {
  if (!canUseCloud()) {
    return getList(KEYS.exerciseSubmissions || "fitness.exerciseSubmissions")
      .filter((item) => status === "all" || item.status === status)
      .map(normalizeExerciseSubmission);
  }

  const result = await callAdminApi("listSubmissions", { status });
  return (result.submissions || []).map(normalizeExerciseSubmission);
}

async function deleteAdminExerciseSubmission(id) {
  return callAdminApi("deleteSubmission", { id });
}

async function submitExerciseSubmission(payload) {
  const record = {
    name: (payload.name || "").trim(),
    muscle: (payload.muscle || "").trim(),
    equipment: (payload.equipment || "").trim(),
    note: (payload.note || "").trim(),
    imageUrl: payload.imageUrl || "",
    imageFileId: payload.imageFileId || ""
  };

  if (!canUseCloud()) {
    const submissionsKey = KEYS.exerciseSubmissions || "fitness.exerciseSubmissions";
    const item = normalizeExerciseSubmission({
      ...record,
      id: `s_${Date.now()}`,
      status: "pending",
      createdAt: Date.now()
    });
    const submissions = getList(submissionsKey);
    submissions.unshift(item);
    setList(submissionsKey, submissions);
    return item;
  }

  const result = await wx.cloud.callFunction({
    name: "exerciseSubmissionApi",
    data: {
      action: "submit",
      exercise: record
    }
  });

  return normalizeExerciseSubmission(result.result);
}

async function getExercises(options = {}) {
  ensureSeedData();

  if (!canUseCloud()) {
    return getList(KEYS.exercises).map(normalizeExercise);
  }

  const limit = options.limit || 100;
  const keyword = (options.keyword || "").trim();
  const fallback = options.fallback !== false;
  const minExpected = Math.min(Number(options.minExpected) || 0, limit);

  try {
    const result = await wx.cloud.callFunction({
      name: "exerciseApi",
      data: {
        action: keyword ? "search" : "list",
        keyword,
        limit
      }
    });
    const data = (result.result.data || []).map(normalizeExercise);
    if (data.length && (!minExpected || data.length >= minExpected)) {
      setList(KEYS.exercises, data);
      return data;
    }
    if (data.length && minExpected && data.length < minExpected) {
      console.warn(`Exercise API returned ${data.length}, expected at least ${minExpected}; using database fallback`);
    }
  } catch (error) {
    console.warn("Failed to load exercises from cloud", error);
    try {
      const data = await loadExercisesFromDb({ keyword, limit });
      if (data.length) {
        setList(KEYS.exercises, data);
        return data;
      }
    } catch (dbError) {
      console.warn("Failed to load exercises from database fallback", dbError);
    }
    if (!fallback) {
      throw error;
    }
  }

  if (!fallback) {
    return [];
  }

  return getList(KEYS.exercises).map(normalizeExercise);
}

async function getLearnContents(muscle) {
  const targetMuscle = String(muscle || "").trim();
  if (!targetMuscle) {
    return [];
  }

  if (!canUseCloud()) {
    return DEFAULT_LEARN_CONTENTS.filter((item) => item.muscle === targetMuscle).map(normalizeLearnContent);
  }

  try {
    const result = await wx.cloud.callFunction({
      name: "exerciseApi",
      data: {
        action: "learnByMuscle",
        muscle: targetMuscle,
        limit: 50
      }
    });
    const data = (result.result.data || []).map(normalizeLearnContent);
    if (data.length) {
      wx.setStorageSync(`${KEYS.learnContents}.${targetMuscle}`, data);
      return data;
    }
  } catch (error) {
    console.warn("Failed to load learn contents from cloud", error);
  }

  const cached = wx.getStorageSync(`${KEYS.learnContents}.${targetMuscle}`) || [];
  if (cached.length) {
    return cached.map(normalizeLearnContent);
  }

  return DEFAULT_LEARN_CONTENTS.filter((item) => item.muscle === targetMuscle).map(normalizeLearnContent);
}

async function getWorkouts() {
  if (!canUseCloud()) {
    return getList(KEYS.workouts).map(normalizeWorkout);
  }

  try {
    const result = await db()
      .collection(COLLECTIONS.workouts)
      .orderBy("createdAt", "desc")
      .limit(200)
      .get();
    return result.data.map(normalizeWorkout);
  } catch (error) {
    console.warn("Failed to load workouts from cloud", error);
    return getList(KEYS.workouts).map(normalizeWorkout);
  }
}

async function getMeals() {
  if (!canUseCloud()) {
    return getList(KEYS.meals).map(normalizeMeal);
  }

  try {
    const result = await db()
      .collection(COLLECTIONS.meals)
      .orderBy("createdAt", "desc")
      .limit(200)
      .get();
    return result.data.map(normalizeMeal);
  } catch (error) {
    console.warn("Failed to load meals from cloud", error);
    return getList(KEYS.meals).map(normalizeMeal);
  }
}

async function addWorkout(payload) {
  const profile = await getUserProfile();
  const record = {
    id: `w_${Date.now()}`,
    openid: profile.openid || "",
    date: payload.date || formatDate(),
    exerciseId: payload.exerciseId,
    exerciseName: payload.exerciseName,
    exerciseNameEn: payload.exerciseNameEn || "",
    exerciseImageUrl: payload.exerciseImageUrl || "",
    sets: Number(payload.sets) || 0,
    reps: Number(payload.reps) || 0,
    weight: Number(payload.weight) || 0,
    note: payload.note || "",
    createdAt: Date.now()
  };

  if (canUseCloud()) {
    try {
      await db().collection(COLLECTIONS.workouts).add({ data: record });
      return record;
    } catch (error) {
      console.warn("Failed to save workout to cloud", error);
    }
  }

  const workouts = getList(KEYS.workouts);
  workouts.unshift(record);
  setList(KEYS.workouts, workouts);
  return record;
}

async function addMeal(payload) {
  const profile = await getUserProfile();
  const record = {
    id: `m_${Date.now()}`,
    openid: profile.openid || "",
    date: payload.date || formatDate(),
    type: payload.type || "加餐",
    food: payload.food,
    calories: Number(payload.calories) || 0,
    protein: Number(payload.protein) || 0,
    note: payload.note || "",
    createdAt: Date.now()
  };

  if (canUseCloud()) {
    try {
      await db().collection(COLLECTIONS.meals).add({ data: record });
      return record;
    } catch (error) {
      console.warn("Failed to save meal to cloud", error);
    }
  }

  const meals = getList(KEYS.meals);
  meals.unshift(record);
  setList(KEYS.meals, meals);
  return record;
}

async function removeWorkout(id) {
  if (canUseCloud()) {
    try {
      if (String(id).startsWith("w_")) {
        const result = await db().collection(COLLECTIONS.workouts).where({ id }).limit(1).get();
        if (result.data.length) {
          await db().collection(COLLECTIONS.workouts).doc(result.data[0]._id).remove();
        }
      } else {
        await db().collection(COLLECTIONS.workouts).doc(id).remove();
      }
      return;
    } catch (error) {
      console.warn("Failed to remove workout from cloud", error);
    }
  }

  setList(KEYS.workouts, getList(KEYS.workouts).filter((item) => item.id !== id && item._id !== id));
}

async function removeMeal(id) {
  if (canUseCloud()) {
    try {
      if (String(id).startsWith("m_")) {
        const result = await db().collection(COLLECTIONS.meals).where({ id }).limit(1).get();
        if (result.data.length) {
          await db().collection(COLLECTIONS.meals).doc(result.data[0]._id).remove();
        }
      } else {
        await db().collection(COLLECTIONS.meals).doc(id).remove();
      }
      return;
    } catch (error) {
      console.warn("Failed to remove meal from cloud", error);
    }
  }

  setList(KEYS.meals, getList(KEYS.meals).filter((item) => item.id !== id && item._id !== id));
}

async function byDate(date) {
  if (!canUseCloud()) {
    return {
      workouts: getList(KEYS.workouts).filter((item) => item.date === date).map(normalizeWorkout),
      meals: getList(KEYS.meals).filter((item) => item.date === date).map(normalizeMeal)
    };
  }

  try {
    const [workoutResult, mealResult] = await Promise.all([
      db().collection(COLLECTIONS.workouts).where({ date }).orderBy("createdAt", "desc").get(),
      db().collection(COLLECTIONS.meals).where({ date }).orderBy("createdAt", "desc").get()
    ]);

    return {
      workouts: workoutResult.data.map(normalizeWorkout),
      meals: mealResult.data.map(normalizeMeal)
    };
  } catch (error) {
    console.warn("Failed to load day records from cloud", error);
    return {
      workouts: getList(KEYS.workouts).filter((item) => item.date === date).map(normalizeWorkout),
      meals: getList(KEYS.meals).filter((item) => item.date === date).map(normalizeMeal)
    };
  }
}

function summarizeRecords(date, day) {
  const workoutSets = day.workouts.reduce((sum, item) => sum + item.sets, 0);
  const workoutVolume = day.workouts.reduce((sum, item) => sum + item.sets * item.reps * item.weight, 0);
  const calories = day.meals.reduce((sum, item) => sum + item.calories, 0);
  const protein = day.meals.reduce((sum, item) => sum + item.protein, 0);

  return {
    date,
    workouts: day.workouts,
    meals: day.meals,
    workoutCount: day.workouts.length,
    workoutSets,
    workoutVolume,
    mealCount: day.meals.length,
    calories,
    protein
  };
}

async function summarizeDay(date) {
  const day = await byDate(date);
  return summarizeRecords(date, day);
}

async function summarizeHistory() {
  const [workouts, meals] = await Promise.all([getWorkouts(), getMeals()]);
  const dates = new Set();
  workouts.forEach((item) => dates.add(item.date));
  meals.forEach((item) => dates.add(item.date));

  return Array.from(dates)
    .sort((a, b) => (a < b ? 1 : -1))
    .map((date) =>
      summarizeRecords(date, {
        workouts: workouts.filter((item) => item.date === date),
        meals: meals.filter((item) => item.date === date)
      })
    );
}

module.exports = {
  ensureSeedData,
  getExercises,
  getLearnContents,
  getWorkouts,
  getMeals,
  getUserProfile,
  updateUserProfile,
  getAdminStats,
  getPendingExerciseSubmissions,
  reviewExerciseSubmission,
  getAdminUsers,
  setAdminUserRole,
  deleteAdminUser,
  getAdminExercises,
  saveAdminExercise,
  deleteAdminExercise,
  getAdminLearnContents,
  saveAdminLearnContent,
  deleteAdminLearnContent,
  getAdminWorkouts,
  saveAdminWorkout,
  deleteAdminWorkout,
  getAdminMeals,
  saveAdminMeal,
  deleteAdminMeal,
  getAdminExerciseSubmissions,
  deleteAdminExerciseSubmission,
  submitExerciseSubmission,
  addWorkout,
  addMeal,
  removeWorkout,
  removeMeal,
  byDate,
  summarizeDay,
  summarizeHistory,
  normalizeExercise
};
