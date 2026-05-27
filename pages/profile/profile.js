const store = require("../../utils/store");

Page({
  data: {
    profile: {
      nickName: "",
      role: "user",
      registered: false
    },
    form: {
      nickName: "",
      avatarUrl: "",
      avatarFileId: ""
    },
    isAdmin: false,
    isRegistered: false,
    isUnregistered: true,
    displayName: "未注册用户",
    roleText: "登录后可记录训练和饮食",
    roleBadge: "未注册",
    avatarDisplayUrl: "/assets/app-icon-256.png",
    saving: false
  },

  async onShow() {
    await this.refreshProfile();
  },

  async refreshProfile() {
    const profile = await store.getUserProfile();
    await this.applyProfile(profile);
  },

  async applyProfile(profile) {
    const isAdmin = profile.role === "admin";
    const isRegistered = Boolean(profile.registered);
    const avatarDisplayUrl = await this.resolveAvatarUrl(profile.avatarUrl);
    this.setData({
      profile,
      isAdmin,
      isRegistered,
      isUnregistered: !isRegistered,
      displayName: isRegistered ? profile.nickName : "未注册用户",
      "form.nickName": profile.nickName || "",
      "form.avatarUrl": profile.avatarUrl || "",
      "form.avatarFileId": profile.avatarFileId || "",
      avatarDisplayUrl,
      roleText: isRegistered
        ? isAdmin
          ? "管理员：可进入数据库维护入口"
          : "普通用户：记录训练、饮食和查看历史"
        : "填写昵称完成注册",
      roleBadge: isRegistered ? (isAdmin ? "管理员" : "用户") : "未注册"
    });
  },

  async resolveAvatarUrl(avatarUrl) {
    if (!avatarUrl) {
      return "/assets/app-icon-256.png";
    }

    if (!avatarUrl.startsWith("cloud://") || !wx.cloud || !wx.cloud.getTempFileURL) {
      return avatarUrl;
    }

    try {
      const result = await wx.cloud.getTempFileURL({
        fileList: [avatarUrl]
      });
      return result.fileList[0].tempFileURL || avatarUrl;
    } catch (error) {
      return avatarUrl;
    }
  },

  onNicknameInput(event) {
    this.setData({
      "form.nickName": event.detail.value
    });
  },

  onChooseAvatar(event) {
    const avatarUrl = event.detail.avatarUrl;
    this.setData({
      "form.avatarUrl": avatarUrl,
      "form.avatarFileId": "",
      avatarDisplayUrl: avatarUrl || "/assets/app-icon-256.png"
    });
  },

  async uploadAvatarIfNeeded() {
    const avatarUrl = this.data.form.avatarUrl;
    if (!avatarUrl || this.data.form.avatarFileId || avatarUrl.startsWith("cloud://") || avatarUrl.startsWith("http")) {
      return {
        avatarUrl,
        avatarFileId: this.data.form.avatarFileId
      };
    }

    if (!wx.cloud || !wx.cloud.uploadFile) {
      return {
        avatarUrl,
        avatarFileId: ""
      };
    }

    const extMatch = avatarUrl.match(/\.(png|jpg|jpeg|webp)$/i);
    const ext = extMatch ? extMatch[1].toLowerCase() : "jpg";
    const cloudPath = `user-avatars/avatar_${Date.now()}.${ext}`;
    const result = await wx.cloud.uploadFile({
      cloudPath,
      filePath: avatarUrl
    });

    return {
      avatarUrl: result.fileID,
      avatarFileId: result.fileID
    };
  },

  async saveProfile() {
    const nickName = this.data.form.nickName.trim();
    if (!nickName) {
      wx.showToast({ title: "请填写昵称", icon: "none" });
      return;
    }

    this.setData({ saving: true });
    try {
      const avatar = await this.uploadAvatarIfNeeded();
      const profile = await store.updateUserProfile({
        nickName,
        avatarUrl: avatar.avatarUrl,
        avatarFileId: avatar.avatarFileId
      });
      await this.applyProfile(profile);
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
