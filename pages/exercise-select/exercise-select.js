const store = require("../../utils/store");

Page({
  data: {
    keyword: "",
    loading: false,
    errorText: "",
    exercises: []
  },

  onLoad() {
    this.loadExercises();
  },

  onKeywordInput(event) {
    this.setData({
      keyword: event.detail.value
    });
  },

  async searchExercises() {
    await this.loadExercises(this.data.keyword);
  },

  async loadExercises(keyword = "") {
    this.setData({ loading: true, errorText: "" });

    try {
      const exercises = await store.getExercises({
        keyword,
        limit: 60,
        fallback: false
      });
      this.setData({
        exercises,
        loading: false,
        errorText: exercises.length ? "" : "云端动作库为空，请先部署云函数并导入 free-exercise-db 数据。"
      });
    } catch (error) {
      this.setData({
        exercises: [],
        loading: false,
        errorText: "动作库加载失败，请检查云开发环境、exerciseApi 云函数和 exercises 集合。"
      });
    }
  },

  selectExercise(event) {
    const exercise = this.data.exercises[event.currentTarget.dataset.index];
    wx.setStorageSync("fitness.selectedExercise", exercise);
    wx.navigateBack();
  }
});
