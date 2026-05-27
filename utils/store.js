const { formatDate } = require("./date");
const { translateExercise } = require("./exerciseTranslate");

const KEYS = {
  workouts: "fitness.workouts",
  meals: "fitness.meals",
  exercises: "fitness.exercises"
};

const COLLECTIONS = {
  workouts: "workouts",
  meals: "meals",
  exercises: "exercises"
};

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
  const name = item.displayName || item.nameZh || translated.nameZh || item.name || item.title || "未命名动作";
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

async function getExercises(options = {}) {
  ensureSeedData();

  if (!canUseCloud()) {
    return getList(KEYS.exercises).map(normalizeExercise);
  }

  const limit = options.limit || 100;
  const keyword = (options.keyword || "").trim();
  const fallback = options.fallback !== false;

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
    if (data.length) {
      setList(KEYS.exercises, data);
      return data;
    }
  } catch (error) {
    console.warn("Failed to load exercises from cloud", error);
    if (!fallback) {
      throw error;
    }
  }

  if (!fallback) {
    return [];
  }

  return getList(KEYS.exercises).map(normalizeExercise);
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
  const record = {
    id: `w_${Date.now()}`,
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
  const record = {
    id: `m_${Date.now()}`,
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
  getWorkouts,
  getMeals,
  addWorkout,
  addMeal,
  removeWorkout,
  removeMeal,
  byDate,
  summarizeDay,
  summarizeHistory,
  normalizeExercise
};
