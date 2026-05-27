const store = require("../../utils/store");

Page({
  data: {
    isAdmin: false,
    isUserOnly: true,
    loading: false,
    reviewingId: "",
    stats: {
      exercises: 0,
      meals: 0,
      workouts: 0,
      users: 0
    },
    submissions: [],
    hasSubmissions: false
  },

  async onShow() {
    const profile = await store.getUserProfile();
    const isAdmin = profile.role === "admin";
    this.setData({ isAdmin, isUserOnly: !isAdmin });

    if (isAdmin) {
      await this.loadAdminData();
    }
  },

  async loadAdminData() {
    this.setData({ loading: true });
    try {
      const [stats, submissions] = await Promise.all([
        store.getAdminStats(),
        store.getPendingExerciseSubmissions()
      ]);
      this.setData({
        stats,
        submissions,
        hasSubmissions: Boolean(submissions.length)
      });
    } catch (error) {
      wx.showToast({ title: "管理员数据加载失败", icon: "none" });
    } finally {
      this.setData({ loading: false });
    }
  },

  async approveSubmission(event) {
    await this.reviewSubmission(event.currentTarget.dataset.id, "approve");
  },

  async rejectSubmission(event) {
    await this.reviewSubmission(event.currentTarget.dataset.id, "reject");
  },

  async reviewSubmission(id, decision) {
    if (!id || this.data.reviewingId) {
      return;
    }

    this.setData({ reviewingId: id });
    try {
      await store.reviewExerciseSubmission(id, decision);
      wx.showToast({
        title: decision === "reject" ? "已拒绝" : "已通过",
        icon: "success"
      });
      await this.loadAdminData();
    } catch (error) {
      wx.showToast({ title: "审核失败，请检查 adminApi", icon: "none" });
    } finally {
      this.setData({ reviewingId: "" });
    }
  }
});
