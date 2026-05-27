const store = require("../../utils/store");
const { formatDate, displayDate } = require("../../utils/date");

Page({
  data: {
    date: formatDate(),
    displayDate: "",
    loading: false,
    summary: {
      workouts: [],
      meals: [],
      workoutSets: 0,
      calories: 0,
      protein: 0
    }
  },

  async onShow() {
    const date = formatDate();
    this.setData({
      date,
      displayDate: displayDate(date),
      loading: true
    });

    const summary = await store.summarizeDay(date);
    this.setData({
      date,
      displayDate: displayDate(date),
      summary,
      loading: false
    });
  },

  goWorkout() {
    wx.switchTab({ url: "/pages/workout/workout" });
  },

  goDiet() {
    wx.switchTab({ url: "/pages/diet/diet" });
  }
});
