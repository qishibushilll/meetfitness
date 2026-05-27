const store = require("../../utils/store");

Page({
  data: {
    profile: {
      nickName: "",
      role: "user",
      registered: false
    },
    form: {
      nickName: ""
    },
    isAdmin: false,
    isRegistered: false,
    isUnregistered: true,
    displayName: "未注册用户",
    roleText: "登录后可记录训练和饮食",
    roleBadge: "未注册",
    saving: false
  },

  async onShow() {
    await this.refreshProfile();
  },

  async refreshProfile() {
    const profile = await store.getUserProfile();
    this.applyProfile(profile);
  },

  applyProfile(profile) {
    const isAdmin = profile.role === "admin";
    const isRegistered = Boolean(profile.registered);
    this.setData({
      profile,
      isAdmin,
      isRegistered,
      isUnregistered: !isRegistered,
      displayName: isRegistered ? profile.nickName : "未注册用户",
      "form.nickName": profile.nickName || "",
      roleText: isRegistered
        ? isAdmin
          ? "管理员：可进入数据库维护入口"
          : "普通用户：记录训练、饮食和查看历史"
        : "填写昵称完成注册",
      roleBadge: isRegistered ? (isAdmin ? "管理员" : "用户") : "未注册"
    });
  },

  onNicknameInput(event) {
    this.setData({
      "form.nickName": event.detail.value
    });
  },

  async saveProfile() {
    const nickName = this.data.form.nickName.trim();
    if (!nickName) {
      wx.showToast({ title: "请填写昵称", icon: "none" });
      return;
    }

    this.setData({ saving: true });
    try {
      const profile = await store.updateUserProfile({ nickName });
      this.applyProfile(profile);
      wx.showToast({ title: "已保存", icon: "success" });
    } catch (error) {
      wx.showToast({ title: "保存失败", icon: "none" });
    } finally {
      this.setData({ saving: false });
    }
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
