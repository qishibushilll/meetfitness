App({
  onLaunch() {
    if (wx.cloud) {
      wx.cloud.init({
        traceUser: true
      });
    }

    const store = require("./utils/store");
    store.ensureSeedData();
  }
});
