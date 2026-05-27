const store = require("../../utils/store");
const { formatDate, displayDate } = require("../../utils/date");

Page({
  data: {
    date: formatDate(),
    displayDate: "",
    summary: {
      workouts: [],
      meals: [],
      workoutSets: 0,
      calories: 0,
      protein: 0
    }
  },

  onShow() {
    const date = formatDate();
    this.setData({
      date,
      displayDate: displayDate(date),
      summary: store.summarizeDay(date)
    });
  },

  goWorkout() {
    wx.switchTab({ url: "/pages/workout/workout" });
  },

  goDiet() {
    wx.switchTab({ url: "/pages/diet/diet" });
  }
});
