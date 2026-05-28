const store = require("../../utils/store");
const { displayDate } = require("../../utils/date");
const backTop = require("../../utils/back-top");

Page({
  data: {
    loading: false,
    history: [],
    showBackTop: false
  },

  async onShow() {
    this.setData({ loading: true });
    const summary = await store.summarizeHistory();
    const history = summary.map((item) => ({
      ...item,
      displayDate: displayDate(item.date)
    }));
    this.setData({ history, loading: false });
  },

  onPageScroll(event) {
    const showBackTop = backTop.shouldShowBackTop(event.scrollTop);
    if (showBackTop !== this.data.showBackTop) {
      this.setData({ showBackTop });
    }
  },

  scrollToTop() {
    backTop.scrollToTop();
  }
});
