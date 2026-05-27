const store = require("../../utils/store");
const { displayDate } = require("../../utils/date");

Page({
  data: {
    loading: false,
    history: []
  },

  async onShow() {
    this.setData({ loading: true });
    const summary = await store.summarizeHistory();
    const history = summary.map((item) => ({
      ...item,
      displayDate: displayDate(item.date)
    }));
    this.setData({ history, loading: false });
  }
});
