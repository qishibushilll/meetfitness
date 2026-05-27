const store = require("../../utils/store");

const MUSCLE_OPTIONS = [
  "胸部",
  "背部",
  "肩部",
  "腹部",
  "臀部",
  "腿部",
  "手臂",
  "小腿",
  "全身",
  "其他"
];

function defaultForm() {
  return {
    name: "",
    muscle: "胸部",
    equipment: "",
    note: "",
    imageUrl: "",
    imageFileId: ""
  };
}

Page({
  data: {
    form: defaultForm(),
    muscleOptions: MUSCLE_OPTIONS,
    muscleIndex: 0,
    imagePreviewUrl: "",
    submitting: false
  },

  onInput(event) {
    const field = event.currentTarget.dataset.field;
    this.setData({
      [`form.${field}`]: event.detail.value
    });
  },

  onMuscleChange(event) {
    const index = Number(event.detail.value);
    this.setData({
      muscleIndex: index,
      "form.muscle": this.data.muscleOptions[index]
    });
  },

  chooseImage() {
    if (wx.chooseMedia) {
      wx.chooseMedia({
        count: 1,
        mediaType: ["image"],
        sourceType: ["album", "camera"],
        success: (result) => {
          const filePath = result.tempFiles[0] && result.tempFiles[0].tempFilePath;
          this.applyLocalImage(filePath);
        }
      });
      return;
    }

    wx.chooseImage({
      count: 1,
      sourceType: ["album", "camera"],
      success: (result) => {
        this.applyLocalImage(result.tempFilePaths[0]);
      }
    });
  },

  applyLocalImage(filePath) {
    if (!filePath) {
      return;
    }

    this.setData({
      imagePreviewUrl: filePath,
      "form.imageUrl": filePath,
      "form.imageFileId": ""
    });
  },

  async uploadImageIfNeeded() {
    const imageUrl = this.data.form.imageUrl;
    if (!imageUrl || this.data.form.imageFileId || imageUrl.startsWith("cloud://") || imageUrl.startsWith("http")) {
      return {
        imageUrl,
        imageFileId: this.data.form.imageFileId
      };
    }

    if (!wx.cloud || !wx.cloud.uploadFile) {
      return {
        imageUrl,
        imageFileId: ""
      };
    }

    const extMatch = imageUrl.match(/\.(png|jpg|jpeg|webp)$/i);
    const ext = extMatch ? extMatch[1].toLowerCase() : "jpg";
    const cloudPath = `exercise-submissions/exercise_${Date.now()}.${ext}`;
    const result = await wx.cloud.uploadFile({
      cloudPath,
      filePath: imageUrl
    });

    return {
      imageUrl: result.fileID,
      imageFileId: result.fileID
    };
  },

  async submitExercise() {
    const name = this.data.form.name.trim();
    const muscle = this.data.form.muscle.trim();

    if (!name || !muscle) {
      wx.showToast({ title: "请填写动作名和训练部位", icon: "none" });
      return;
    }

    this.setData({ submitting: true });
    try {
      const image = await this.uploadImageIfNeeded();
      await store.submitExerciseSubmission({
        ...this.data.form,
        name,
        muscle,
        imageUrl: image.imageUrl,
        imageFileId: image.imageFileId
      });
      wx.showToast({ title: "已提交审核", icon: "success" });
      setTimeout(() => {
        wx.navigateBack();
      }, 500);
    } catch (error) {
      wx.showToast({ title: "提交失败，请检查云函数", icon: "none" });
    } finally {
      this.setData({ submitting: false });
    }
  }
});
