const store = require("./store");

function currentRoute() {
  const pages = typeof getCurrentPages === "function" ? getCurrentPages() : [];
  return pages.length ? pages[pages.length - 1].route : "";
}

function goProfile() {
  if (currentRoute() === "pages/profile/profile") {
    return;
  }

  wx.switchTab({
    url: "/pages/profile/profile"
  });
}

async function requireRegistered(options = {}) {
  const profile = await store.getUserProfile();
  if (profile && profile.registered) {
    return profile;
  }

  wx.showToast({
    title: options.message || "请先完成登录",
    icon: "none"
  });
  goProfile();
  return null;
}

async function requireAdmin() {
  const profile = await requireRegistered({
    message: "请先登录管理员账号"
  });

  if (!profile) {
    return null;
  }

  if (profile.role !== "admin") {
    wx.showToast({
      title: "当前账号不是管理员",
      icon: "none"
    });
    goProfile();
    return null;
  }

  return profile;
}

module.exports = {
  requireRegistered,
  requireAdmin
};
