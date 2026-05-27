const { formatDate } = require("./date");

const KEYS = {
  workouts: "fitness.workouts",
  meals: "fitness.meals",
  exercises: "fitness.exercises"
};

const DEFAULT_EXERCISES = [
  { id: "bench_press", name: "杠铃卧推", muscle: "胸", equipment: "杠铃" },
  { id: "squat", name: "深蹲", muscle: "腿", equipment: "杠铃" },
  { id: "deadlift", name: "硬拉", muscle: "背/腿", equipment: "杠铃" },
  { id: "pull_up", name: "引体向上", muscle: "背", equipment: "自重" },
  { id: "shoulder_press", name: "肩推", muscle: "肩", equipment: "哑铃" },
  { id: "row", name: "俯身划船", muscle: "背", equipment: "杠铃" },
  { id: "plank", name: "平板支撑", muscle: "核心", equipment: "自重" }
];

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

function getExercises() {
  ensureSeedData();
  return getList(KEYS.exercises);
}

function getWorkouts() {
  return getList(KEYS.workouts);
}

function getMeals() {
  return getList(KEYS.meals);
}

function addWorkout(payload) {
  const workouts = getWorkouts();
  const record = {
    id: `w_${Date.now()}`,
    date: payload.date || formatDate(),
    exerciseId: payload.exerciseId,
    exerciseName: payload.exerciseName,
    sets: Number(payload.sets) || 0,
    reps: Number(payload.reps) || 0,
    weight: Number(payload.weight) || 0,
    note: payload.note || "",
    createdAt: Date.now()
  };
  workouts.unshift(record);
  setList(KEYS.workouts, workouts);
  return record;
}

function addMeal(payload) {
  const meals = getMeals();
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
  meals.unshift(record);
  setList(KEYS.meals, meals);
  return record;
}

function removeWorkout(id) {
  setList(KEYS.workouts, getWorkouts().filter((item) => item.id !== id));
}

function removeMeal(id) {
  setList(KEYS.meals, getMeals().filter((item) => item.id !== id));
}

function byDate(date) {
  return {
    workouts: getWorkouts().filter((item) => item.date === date),
    meals: getMeals().filter((item) => item.date === date)
  };
}

function summarizeDay(date) {
  const day = byDate(date);
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

function summarizeHistory() {
  const dates = new Set();
  getWorkouts().forEach((item) => dates.add(item.date));
  getMeals().forEach((item) => dates.add(item.date));

  return Array.from(dates)
    .sort((a, b) => (a < b ? 1 : -1))
    .map((date) => summarizeDay(date));
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
  summarizeHistory
};
