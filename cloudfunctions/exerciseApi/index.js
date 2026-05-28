const cloud = require("wx-server-sdk");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;
const EXERCISES = "exercises";
const LEARN_CONTENTS = "learnContents";
const DB_PAGE_SIZE = 100;
const TEMP_URL_BATCH_SIZE = 50;
const zhKeywordMap = {
  腹肌: "abdominals",
  腹部: "abdominals",
  胸: "chest",
  胸部: "chest",
  背: "back",
  背部: "back",
  背阔肌: "lats",
  下背: "lower back",
  中背: "middle back",
  肩: "shoulders",
  肩部: "shoulders",
  腿: "quadriceps",
  股四头肌: "quadriceps",
  腘绳肌: "hamstrings",
  臀: "glutes",
  臀部: "glutes",
  小腿: "calves",
  二头: "biceps",
  肱二头肌: "biceps",
  三头: "triceps",
  肱三头肌: "triceps",
  杠铃: "barbell",
  哑铃: "dumbbell",
  自重: "body only",
  绳索: "cable",
  壶铃: "kettlebells",
  弹力带: "bands",
  器械: "machine",
  卧推: "bench press",
  深蹲: "squat",
  硬拉: "deadlift",
  划船: "row",
  弯举: "curl",
  引体: "pullup",
  俯卧撑: "pushup",
  箭步蹲: "lunge",
  平板支撑: "plank"
};

function normalizeKeyword(value) {
  return String(value || "").trim();
}

function keywordVariants(keyword) {
  const mapped = zhKeywordMap[keyword];
  return mapped && mapped !== keyword ? [keyword, mapped] : [keyword];
}

async function withTempImageUrls(data) {
  const fileIds = data
    .map((item) => item.imageFileId)
    .filter((fileId) => fileId && fileId.startsWith("cloud://"));

  if (!fileIds.length) {
    return data;
  }

  const urlMap = await getTempUrlMap(fileIds);
  return data.map((item) => ({
    ...item,
    imageUrl: urlMap[item.imageFileId] || item.imageUrl || item.rawImageUrl
  }));
}

async function getTempUrlMap(fileIds) {
  const uniqueFileIds = Array.from(new Set(fileIds));
  const urlMap = {};
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

  return urlMap;
}

async function withTempMediaUrls(data) {
  const fileIds = [];
  data.forEach((item) => {
    ["coverFileId", "videoFileId"].forEach((field) => {
      const fileId = item[field];
      if (fileId && String(fileId).startsWith("cloud://")) {
        fileIds.push(fileId);
      }
    });
  });

  if (!fileIds.length) {
    return data;
  }

  const urlMap = await getTempUrlMap(fileIds);

  return data.map((item) => ({
    ...item,
    coverUrl: urlMap[item.coverFileId] || item.coverUrl || "",
    videoUrl: urlMap[item.videoFileId] || item.videoUrl || ""
  }));
}

async function getExerciseRows({ condition = null, limit }) {
  const rows = [];

  for (let offset = 0; offset < limit; offset += DB_PAGE_SIZE) {
    let query = db.collection(EXERCISES);
    if (condition) {
      query = query.where(condition);
    }

    const pageLimit = Math.min(DB_PAGE_SIZE, limit - rows.length);
    const result = await query.orderBy("name", "asc").skip(offset).limit(pageLimit).get();
    const page = result.data || [];
    rows.push(...page);

    if (page.length < pageLimit || rows.length >= limit) {
      break;
    }
  }

  return rows;
}

exports.main = async (event) => {
  const action = event.action || "list";
  const limit = Math.min(Math.max(Number(event.limit) || 60, 1), 1000);

  if (action === "learnByMuscle") {
    const muscle = normalizeKeyword(event.muscle);
    if (!muscle) {
      return { data: [] };
    }

    const result = await db
      .collection(LEARN_CONTENTS)
      .where({
        muscle,
        status: "published"
      })
      .orderBy("sort", "asc")
      .limit(limit)
      .get();

    return { data: await withTempMediaUrls(result.data) };
  }

  if (action === "search") {
    const keyword = normalizeKeyword(event.keyword);
    if (!keyword) {
      const data = await getExerciseRows({ limit });
      return { data: await withTempImageUrls(data) };
    }

    const matchers = keywordVariants(keyword).map((value) =>
      db.RegExp({
        regexp: value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        options: "i"
      })
    );
    const conditions = [];
    matchers.forEach((matcher) => {
      conditions.push(
        { name: matcher },
        { nameZh: matcher },
        { displayName: matcher },
        { muscle: matcher },
        { muscleZh: matcher },
        { equipment: matcher },
        { equipmentZh: matcher },
        { categoryZh: matcher },
        { levelZh: matcher },
        { primaryMusclesText: matcher }
      );
    });

    const data = await getExerciseRows({ condition: _.or(conditions), limit });
    return { data: await withTempImageUrls(data) };
  }

  const data = await getExerciseRows({ limit });
  return { data: await withTempImageUrls(data) };
};
