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

  async onShow() {
    await this.refreshMeals(this.data.form.date);
  },

  async refreshMeals(date) {
    const day = await store.byDate(date);
    this.setData({
      selectedDateMeals: day.meals
    });
  },

  async onDateChange(event) {
    const date = event.detail.value;
    this.setData({
      "form.date": date
    });
    await this.refreshMeals(date);
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

  async saveMeal() {
    if (!this.data.form.food) {
      wx.showToast({ title: "请填写食物", icon: "none" });
      return;
    }

    await store.addMeal({
      ...this.data.form,
      type: this.data.mealTypes[this.data.mealTypeIndex]
    });

    this.setData({
      form: {
        ...defaultForm(),
        date: this.data.form.date
      }
    });
    await this.refreshMeals(this.data.form.date);
    wx.showToast({ title: "已保存", icon: "success" });
  },

  async removeMeal(event) {
    await store.removeMeal(event.currentTarget.dataset.id);
    await this.refreshMeals(this.data.form.date);
  }
});
