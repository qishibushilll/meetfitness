const cloud = require("wx-server-sdk");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;
const EXERCISES = "exercises";

function normalizeKeyword(value) {
  return String(value || "").trim();
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
    imageUrl: urlMap[item.imageFileId] || item.imageUrl || item.rawImageUrl
  }));
}

exports.main = async (event) => {
  const action = event.action || "list";
  const limit = Math.min(Number(event.limit) || 60, 100);

  if (action === "search") {
    const keyword = normalizeKeyword(event.keyword);
    if (!keyword) {
      const result = await db.collection(EXERCISES).orderBy("name", "asc").limit(limit).get();
      return { data: await withTempImageUrls(result.data) };
    }

    const matcher = db.RegExp({
      regexp: keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      options: "i"
    });

    const result = await db
      .collection(EXERCISES)
      .where(
        _.or([
          { name: matcher },
          { muscle: matcher },
          { equipment: matcher },
          { primaryMusclesText: matcher }
        ])
      )
      .limit(limit)
      .get();

    return { data: await withTempImageUrls(result.data) };
  }

  const result = await db.collection(EXERCISES).orderBy("name", "asc").limit(limit).get();
  return { data: await withTempImageUrls(result.data) };
};
