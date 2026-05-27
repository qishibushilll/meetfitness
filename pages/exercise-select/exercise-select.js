const store = require("../../utils/store");

Page({
  data: {
    keyword: "",
    loading: false,
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
    this.setData({ loading: true });
    const exercises = await store.getExercises({
      keyword,
      limit: 60
    });
    this.setData({
      exercises,
      loading: false
    });
  },

  selectExercise(event) {
    const exercise = this.data.exercises[event.currentTarget.dataset.index];
    wx.setStorageSync("fitness.selectedExercise", exercise);
    wx.navigateBack();
  }
});
