const store = require("../../utils/store");
const backTop = require("../../utils/back-top");

const MUSCLE_ORDER = [
  "胸部",
  "背阔肌",
  "中背部",
  "下背部",
  "肩部",
  "腹肌",
  "股四头肌",
  "腘绳肌",
  "臀部",
  "小腿",
  "肱二头肌",
  "肱三头肌",
  "前臂",
  "斜方肌",
  "颈部",
  "髋内收肌",
  "髋外展肌"
];

function firstMuscle(muscleText) {
  return (muscleText || "其他").split("/")[0] || "其他";
}

function buildMuscleGroups(exercises) {
  const groupMap = {};
  exercises.forEach((exercise) => {
    const muscle = firstMuscle(exercise.muscle);
    if (!groupMap[muscle]) {
      groupMap[muscle] = {
        name: muscle,
        count: 0,
        coverImageUrl: exercise.imageUrl,
        exercises: []
      };
    }
    groupMap[muscle].count += 1;
    groupMap[muscle].exercises.push(exercise);
    if (!groupMap[muscle].coverImageUrl && exercise.imageUrl) {
      groupMap[muscle].coverImageUrl = exercise.imageUrl;
    }
  });

  return Object.values(groupMap).sort((a, b) => {
    const orderA = MUSCLE_ORDER.indexOf(a.name);
    const orderB = MUSCLE_ORDER.indexOf(b.name);
    const rankA = orderA === -1 ? 999 : orderA;
    const rankB = orderB === -1 ? 999 : orderB;
    return rankA === rankB ? a.name.localeCompare(b.name) : rankA - rankB;
  });
}

function prepareExercises(exercises) {
  return exercises.map((exercise) => ({
    ...exercise,
    showNameEn: Boolean(exercise.nameEn && exercise.nameEn !== exercise.name)
  }));
}

Page({
  data: {
    keyword: "",
    loading: false,
    errorText: "",
    mode: "muscles",
    selectedMuscle: "",
    listTitle: "",
    showBackButton: false,
    allExercises: [],
    muscleGroups: [],
    exercises: [],
    showBackTop: false
  },

  async onLoad() {
    await this.loadMuscleGroups();
  },

  onKeywordInput(event) {
    this.setData({
      keyword: event.detail.value
    });
  },

  onPageScroll(event) {
    const showBackTop = backTop.shouldShowBackTop(event.scrollTop);
    if (showBackTop !== this.data.showBackTop) {
      this.setData({ showBackTop });
    }
  },

  scrollToTop() {
    backTop.scrollToTop();
  },

  async searchExercises() {
    const keyword = this.data.keyword.trim();
    if (!keyword) {
      this.setData({
        mode: "muscles",
        selectedMuscle: "",
        listTitle: "",
        showBackButton: false,
        exercises: []
      });
      return;
    }

    await this.loadExercises({
      keyword,
      mode: "search",
      title: ""
    });
  },

  async loadMuscleGroups() {
    this.setData({ loading: true, errorText: "", mode: "muscles" });

    try {
      const exercises = await store.getExercises({
        limit: 1000,
        minExpected: 800,
        fallback: false
      });
      const prepared = prepareExercises(exercises);
      this.setData({
        allExercises: prepared,
        muscleGroups: buildMuscleGroups(prepared),
        loading: false,
        errorText: exercises.length ? "" : "云端动作库为空，请先部署云函数并导入 free-exercise-db 数据。"
      });
    } catch (error) {
      this.setData({
        allExercises: [],
        muscleGroups: [],
        loading: false,
        errorText: "动作库加载失败，请检查云开发环境、exerciseApi 云函数和 exercises 集合。"
      });
    }
  },

  async loadExercises(options) {
    this.setData({ loading: true, errorText: "" });

    try {
      const exercises = await store.getExercises({
        keyword: options.keyword,
        limit: 100,
        fallback: false
      });
      const prepared = prepareExercises(exercises);
      this.setData({
        exercises: prepared,
        mode: options.mode,
        selectedMuscle: options.title,
        listTitle: options.mode === "search" ? "搜索结果" : options.title,
        showBackButton: options.mode !== "search",
        loading: false,
        errorText: prepared.length ? "" : "没有找到动作"
      });
    } catch (error) {
      this.setData({
        exercises: [],
        loading: false,
        errorText: "动作加载失败，请稍后重试。"
      });
    }
  },

  selectMuscle(event) {
    const index = event.currentTarget.dataset.index;
    const group = this.data.muscleGroups[index];
    this.setData({
      mode: "exercises",
      selectedMuscle: group.name,
      listTitle: group.name,
      showBackButton: true,
      exercises: group.exercises
    });
    backTop.scrollToTop();
  },

  backToMuscles() {
    this.setData({
      mode: "muscles",
      selectedMuscle: "",
      listTitle: "",
      showBackButton: false,
      exercises: []
    });
    backTop.scrollToTop();
  },

  goSubmitExercise() {
    wx.navigateTo({ url: "/pages/exercise-submit/exercise-submit" });
  },

  goLearn(event) {
    const group = this.data.muscleGroups[event.currentTarget.dataset.index];
    wx.navigateTo({
      url: `/pages/learn/learn?muscle=${encodeURIComponent(group.name)}`
    });
  },

  selectExercise(event) {
    const exercise = this.data.exercises[event.currentTarget.dataset.index];
    wx.setStorageSync("fitness.selectedExercise", exercise);
    wx.navigateBack();
  },

  onImageError(event) {
    console.warn("Exercise image failed to load", event.currentTarget.dataset.url);
  }
});
