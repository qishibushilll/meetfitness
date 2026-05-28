const store = require("../../utils/store");
const backTop = require("../../utils/back-top");

Page({
  data: {
    muscle: "",
    loading: false,
    contents: [],
    hasContents: false,
    activeVideoUrl: "",
    activeTitle: "",
    showBackTop: false
  },

  async onLoad(options = {}) {
    const muscle = decodeURIComponent(options.muscle || "");
    this.setData({ muscle });
    await this.loadContents(muscle);
  },

  async loadContents(muscle) {
    this.setData({ loading: true });
    try {
      const contents = await store.getLearnContents(muscle);
      this.setData({
        contents,
        hasContents: Boolean(contents.length),
        loading: false
      });
    } catch (error) {
      this.setData({
        contents: [],
        hasContents: false,
        loading: false
      });
      wx.showToast({ title: "学习内容加载失败", icon: "none" });
    }
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

  playContent(event) {
    const item = this.data.contents[event.currentTarget.dataset.index];
    if (!item || !item.videoUrl) {
      wx.showToast({ title: "视频暂未配置", icon: "none" });
      return;
    }

    this.setData({
      activeVideoUrl: item.videoUrl,
      activeTitle: item.title
    });
  }
});
