const store = require("../../utils/store");
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
    exercises: [],
    exerciseNames: [],
    exerciseIndex: 0,
    selectedExerciseName: "",
    form: defaultForm(),
    selectedDateWorkouts: []
  },

  onShow() {
    const exercises = store.getExercises();
    const exerciseNames = exercises.map((item) => `${item.name} · ${item.muscle}`);
    this.setData({
      exercises,
      exerciseNames,
      selectedExerciseName: exerciseNames[this.data.exerciseIndex] || "",
      selectedDateWorkouts: store.byDate(this.data.form.date).workouts
    });
  },

  onDateChange(event) {
    this.setData({
      "form.date": event.detail.value,
      selectedDateWorkouts: store.byDate(event.detail.value).workouts
    });
  },

  onExerciseChange(event) {
    const exerciseIndex = Number(event.detail.value);
    this.setData({
      exerciseIndex,
      selectedExerciseName: this.data.exerciseNames[exerciseIndex]
    });
  },

  onInput(event) {
    const field = event.currentTarget.dataset.field;
    this.setData({
      [`form.${field}`]: event.detail.value
    });
  },

  saveWorkout() {
    const exercise = this.data.exercises[this.data.exerciseIndex];
    const { sets, reps } = this.data.form;

    if (!exercise || !sets || !reps) {
      wx.showToast({ title: "请补全动作、组数和次数", icon: "none" });
      return;
    }

    store.addWorkout({
      ...this.data.form,
      exerciseId: exercise.id,
      exerciseName: exercise.name
    });

    this.setData({
      form: {
        ...defaultForm(),
        date: this.data.form.date
      },
      selectedDateWorkouts: store.byDate(this.data.form.date).workouts
    });
    wx.showToast({ title: "已保存", icon: "success" });
  },

  removeWorkout(event) {
    store.removeWorkout(event.currentTarget.dataset.id);
    this.setData({
      selectedDateWorkouts: store.byDate(this.data.form.date).workouts
    });
  }
});
