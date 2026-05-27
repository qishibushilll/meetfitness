const store = require("../../utils/store");
const { displayDate } = require("../../utils/date");

Page({
  data: {
    history: []
  },

  onShow() {
    const history = store.summarizeHistory().map((item) => ({
      ...item,
      displayDate: displayDate(item.date)
    }));
    this.setData({ history });
  }
});
