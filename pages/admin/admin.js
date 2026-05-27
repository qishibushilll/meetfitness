const store = require("../../utils/store");

Page({
  data: {
    isAdmin: false,
    isUserOnly: true,
    stats: {
      exercises: 0,
      meals: 0,
      workouts: 0,
      users: 0
    }
  },

  async onShow() {
    const profile = await store.getUserProfile();
    const isAdmin = profile.role === "admin";
    this.setData({ isAdmin, isUserOnly: !isAdmin });

    if (isAdmin) {
      const stats = await store.getAdminStats();
      this.setData({ stats });
    }
  }
});
