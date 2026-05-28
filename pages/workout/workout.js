const store = require("../../utils/store");
const auth = require("../../utils/auth");
const { formatDate } = require("../../utils/date");

function defaultForm() {
  return {
    date: formatDate(),
    sets: "3",
    reps: "10",
    weight: "",
    note: ""
  };
}

Page({
  data: {
    selectedExercise: null,
    selectedExerciseName: "选择动作",
    selectedExerciseMeta: "从动作库中选择",
    form: defaultForm(),
    recommendedExercises: [],
    hasRecommendedExercises: false,
    selectedDateWorkouts: []
  },

  async onShow() {
    const selectedExercise = wx.getStorageSync("fitness.selectedExercise");
    if (selectedExercise) {
      this.setSelectedExercise(selectedExercise);
    } else if (!this.data.selectedExercise) {
      try {
        const exercises = await store.getExercises({ limit: 1, fallback: false });
        this.setSelectedExercise(exercises[0] || null);
      } catch (error) {
        this.setSelectedExercise(null);
      }
    }

    if (!this.data.recommendedExercises.length) {
      await this.loadRecommendedExercises();
    }

    await this.refreshWorkouts(this.data.form.date);
  },

  async loadRecommendedExercises() {
    try {
      const exercises = await store.getExercises({ limit: 10, fallback: true });
      this.setData({
        recommendedExercises: exercises,
        hasRecommendedExercises: Boolean(exercises.length)
      });
    } catch (error) {
      this.setData({
        recommendedExercises: [],
        hasRecommendedExercises: false
      });
    }
  },

  setSelectedExercise(exercise) {
    this.setData({
      selectedExercise: exercise,
      selectedExerciseName: exercise ? exercise.name : "选择动作",
      selectedExerciseMeta: exercise ? `${exercise.muscle} · ${exercise.equipment}` : "从动作库中选择"
    });
  },

  async refreshWorkouts(date) {
    const day = await store.byDate(date);
    this.setData({
      selectedDateWorkouts: day.workouts
    });
  },

  async onDateChange(event) {
    const date = event.detail.value;
    this.setData({
      "form.date": date
    });
    await this.refreshWorkouts(date);
  },

  chooseExercise() {
    wx.navigateTo({ url: "/pages/exercise-select/exercise-select" });
  },

  selectRecommendedExercise(event) {
    const exercise = this.data.recommendedExercises[event.currentTarget.dataset.index];
    if (!exercise) {
      return;
    }

    wx.setStorageSync("fitness.selectedExercise", exercise);
    this.setSelectedExercise(exercise);
  },

  onInput(event) {
    const field = event.currentTarget.dataset.field;
    this.setData({
      [`form.${field}`]: event.detail.value
    });
  },

  async saveWorkout() {
    const profile = await auth.requireRegistered();
    if (!profile) {
      return;
    }

    const exercise = this.data.selectedExercise;
    const { sets, reps } = this.data.form;

    if (!exercise || !sets || !reps) {
      wx.showToast({ title: "请先选择动作并填写组数次数", icon: "none" });
      return;
    }

    await store.addWorkout({
      ...this.data.form,
      exerciseId: exercise.exerciseId || exercise.id,
      exerciseName: exercise.name,
      exerciseNameEn: exercise.nameEn || "",
      exerciseImageUrl: exercise.imageUrl
    });

    this.setData({
      form: {
        ...defaultForm(),
        date: this.data.form.date
      }
    });
    await this.refreshWorkouts(this.data.form.date);
    wx.showToast({ title: "已保存", icon: "success" });
  },

  async removeWorkout(event) {
    const profile = await auth.requireRegistered();
    if (!profile) {
      return;
    }

    await store.removeWorkout(event.currentTarget.dataset.id);
    await this.refreshWorkouts(this.data.form.date);
  }
});
