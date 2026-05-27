const store = require("../../utils/store");

Page({
  data: {
    profile: {
      nickName: "普通用户",
      role: "user"
    },
    isAdmin: false,
    roleText: "普通用户：记录训练、饮食和查看历史",
    roleBadge: "用户"
  },

  async onShow() {
    const profile = await store.getUserProfile();
    const isAdmin = profile.role === "admin";
    this.setData({
      profile,
      isAdmin,
      roleText: isAdmin ? "管理员：可进入数据库维护入口" : "普通用户：记录训练、饮食和查看历史",
      roleBadge: isAdmin ? "管理员" : "用户"
    });
  },

  goHistory() {
    wx.switchTab({ url: "/pages/history/history" });
  },

  goWorkout() {
    wx.switchTab({ url: "/pages/workout/workout" });
  },

  goDiet() {
    wx.switchTab({ url: "/pages/diet/diet" });
  },

  goAdmin() {
    wx.navigateTo({ url: "/pages/admin/admin" });
  }
});
