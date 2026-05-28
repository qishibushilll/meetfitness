App({
  onLaunch() {
    if (wx.cloud) {
      wx.cloud.init({
        env: "cloud1-d9g61j638d8e3d6fc",
        traceUser: true
      });
    }

    const store = require("./utils/store");
    store.ensureSeedData();
  }
});
