const store = require("../../utils/store");
const { formatDate } = require("../../utils/date");

const MEAL_TYPES = ["早餐", "午餐", "晚餐", "加餐", "训练前", "训练后"];

function defaultForm() {
  return {
    date: formatDate(),
    food: "",
    calories: "",
    protein: "",
    note: ""
  };
}

Page({
  data: {
    mealTypes: MEAL_TYPES,
    mealTypeIndex: 0,
    selectedMealType: MEAL_TYPES[0],
    form: defaultForm(),
    selectedDateMeals: []
  },

  onShow() {
    this.setData({
      selectedDateMeals: store.byDate(this.data.form.date).meals
    });
  },

  onDateChange(event) {
    this.setData({
      "form.date": event.detail.value,
      selectedDateMeals: store.byDate(event.detail.value).meals
    });
  },

  onMealTypeChange(event) {
    const mealTypeIndex = Number(event.detail.value);
    this.setData({
      mealTypeIndex,
      selectedMealType: this.data.mealTypes[mealTypeIndex]
    });
  },

  onInput(event) {
    const field = event.currentTarget.dataset.field;
    this.setData({
      [`form.${field}`]: event.detail.value
    });
  },

  saveMeal() {
    if (!this.data.form.food) {
      wx.showToast({ title: "请填写食物", icon: "none" });
      return;
    }

    store.addMeal({
      ...this.data.form,
      type: this.data.mealTypes[this.data.mealTypeIndex]
    });

    this.setData({
      form: {
        ...defaultForm(),
        date: this.data.form.date
      },
      selectedDateMeals: store.byDate(this.data.form.date).meals
    });
    wx.showToast({ title: "已保存", icon: "success" });
  },

  removeMeal(event) {
    store.removeMeal(event.currentTarget.dataset.id);
    this.setData({
      selectedDateMeals: store.byDate(this.data.form.date).meals
    });
  }
});
