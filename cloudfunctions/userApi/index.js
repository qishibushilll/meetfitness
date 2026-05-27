const cloud = require("wx-server-sdk");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
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

function normalizeUser(user, openid) {
  return {
    id: user._id || "",
    openid,
    nickName: user.nickName || "",
    avatarUrl: user.avatarUrl || "",
    gender: user.gender || "",
    role: user.role === "admin" ? "admin" : "user",
    registered: Boolean(user.registered),
    createdAt: user.createdAt || Date.now(),
    updatedAt: user.updatedAt || Date.now()
  };
}

async function getOrCreateUser(openid) {
  await ensureCollection(USERS);

  const result = await db.collection(USERS).where({ _openid: openid }).limit(1).get();
  if (result.data.length) {
    return normalizeUser(result.data[0], openid);
  }

  const data = {
    nickName: "",
    avatarUrl: "",
    gender: "",
    role: "user",
    registered: false,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  const created = await db.collection(USERS).add({ data });
  return normalizeUser({ _id: created._id, ...data }, openid);
}

async function updateProfile(openid, payload) {
  await ensureCollection(USERS);

  const user = await getOrCreateUser(openid);
  const data = {
    nickName: String(payload.nickName || "").trim(),
    avatarUrl: payload.avatarUrl || "",
    gender: payload.gender || "",
    registered: true,
    updatedAt: Date.now()
  };

  if (!data.nickName) {
    throw new Error("nickName is required");
  }

  await db.collection(USERS).doc(user.id).update({ data });
  return normalizeUser({ ...user, ...data, _id: user.id }, openid);
}

exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext();
  const action = event.action || "login";

  if (action === "updateProfile") {
    return {
      user: await updateProfile(OPENID, event.profile || {})
    };
  }

  return {
    user: await getOrCreateUser(OPENID)
  };
};
