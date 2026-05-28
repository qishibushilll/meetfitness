const store = require("../../utils/store");
const auth = require("../../utils/auth");

const TABS = [
  { value: "submissions", label: "审核队列" },
  { value: "users", label: "账户" },
  { value: "exercises", label: "动作库" },
  { value: "learn", label: "学习内容" },
  { value: "workouts", label: "训练记录" },
  { value: "meals", label: "饮食记录" }
];

const SUBMISSION_STATUS_OPTIONS = [
  { value: "pending", label: "待审核" },
  { value: "all", label: "全部" },
  { value: "approved", label: "已通过" },
  { value: "rejected", label: "已拒绝" }
];

function tabTitle(tab) {
  const titles = {
    submissions: "审核队列",
    users: "账户管理",
    exercises: "动作库",
    learn: "学习内容",
    workouts: "训练记录",
    meals: "饮食记录"
  };
  return titles[tab] || "控制台";
}

function emptyExerciseForm() {
  return {
    id: "",
    docId: "",
    nameZh: "",
    nameEn: "",
    muscleZh: "",
    equipmentZh: "",
    imageUrl: "",
    imageFileId: ""
  };
}

function emptyWorkoutForm() {
  return {
    id: "",
    docId: "",
    date: "",
    exerciseName: "",
    exerciseNameEn: "",
    exerciseId: "",
    exerciseImageUrl: "",
    sets: "",
    reps: "",
    weight: "",
    note: ""
  };
}

function emptyMealForm() {
  return {
    id: "",
    docId: "",
    date: "",
    type: "",
    food: "",
    calories: "",
    protein: "",
    note: ""
  };
}

function emptyLearnForm() {
  return {
    id: "",
    docId: "",
    title: "",
    muscle: "",
    summary: "",
    type: "video",
    durationText: "",
    coverUrl: "",
    coverFileId: "",
    videoUrl: "",
    videoFileId: "",
    status: "published",
    sort: "10"
  };
}

Page({
  data: {
    isAdmin: false,
    isUserOnly: true,
    loading: false,
    saving: false,
    activeTab: "submissions",
    activeTabTitle: tabTitle("submissions"),
    tabs: TABS,
    stats: {
      exercises: 0,
      learnContents: 0,
      meals: 0,
      workouts: 0,
      users: 0,
      submissions: 0
    },
    submissionStatusOptions: SUBMISSION_STATUS_OPTIONS.map((item) => item.label),
    submissionStatusIndex: 0,
    submissionStatus: "pending",
    submissions: [],
    users: [],
    exercises: [],
    exerciseKeyword: "",
    learnContents: [],
    workouts: [],
    meals: [],
    hasSubmissions: false,
    hasUsers: false,
    hasExercises: false,
    hasLearnContents: false,
    hasWorkouts: false,
    hasMeals: false,
    reviewingId: "",
    roleChangingId: "",
    deletingId: "",
    exerciseForm: emptyExerciseForm(),
    learnForm: emptyLearnForm(),
    workoutForm: emptyWorkoutForm(),
    mealForm: emptyMealForm(),
    editingExercise: false,
    editingLearn: false,
    editingWorkout: false,
    editingMeal: false
  },

  async onShow() {
    const profile = await auth.requireAdmin();
    if (!profile) {
      this.setData({ isAdmin: false, isUserOnly: true });
      return;
    }

    this.setData({ isAdmin: true, isUserOnly: false });
    await this.loadAdminData();
  },

  noop() {},

  async loadAdminData() {
    await this.refreshDashboard();
    await this.loadActiveTab();
  },

  async refreshDashboard() {
    try {
      const stats = await store.getAdminStats();
      this.setData({ stats });
    } catch (error) {
      wx.showToast({ title: "统计加载失败", icon: "none" });
    }
  },

  async loadActiveTab() {
    const activeTab = this.data.activeTab;
    this.setData({ loading: true });

    try {
      if (activeTab === "submissions") {
        const submissions = await store.getAdminExerciseSubmissions(this.data.submissionStatus);
        this.setData({
          submissions,
          hasSubmissions: Boolean(submissions.length)
        });
      }

      if (activeTab === "users") {
        const users = await store.getAdminUsers();
        this.setData({
          users,
          hasUsers: Boolean(users.length)
        });
      }

      if (activeTab === "exercises") {
        const exercises = await store.getAdminExercises({
          keyword: this.data.exerciseKeyword,
          limit: 100
        });
        this.setData({
          exercises,
          hasExercises: Boolean(exercises.length)
        });
      }

      if (activeTab === "learn") {
        const learnContents = await store.getAdminLearnContents();
        this.setData({
          learnContents,
          hasLearnContents: Boolean(learnContents.length)
        });
      }

      if (activeTab === "workouts") {
        const workouts = await store.getAdminWorkouts();
        this.setData({
          workouts,
          hasWorkouts: Boolean(workouts.length)
        });
      }

      if (activeTab === "meals") {
        const meals = await store.getAdminMeals();
        this.setData({
          meals,
          hasMeals: Boolean(meals.length)
        });
      }
    } catch (error) {
      wx.showToast({ title: "管理员数据加载失败", icon: "none" });
    } finally {
      this.setData({ loading: false });
    }
  },

  async switchTab(event) {
    const tab = event.currentTarget.dataset.tab;
    if (!tab || tab === this.data.activeTab) {
      return;
    }

    this.setData({
      activeTab: tab,
      activeTabTitle: tabTitle(tab),
      editingExercise: false,
      editingLearn: false,
      editingWorkout: false,
      editingMeal: false
    });
    await this.loadActiveTab();
  },

  async onSubmissionStatusChange(event) {
    const index = Number(event.detail.value);
    const option = SUBMISSION_STATUS_OPTIONS[index] || SUBMISSION_STATUS_OPTIONS[0];
    this.setData({
      submissionStatusIndex: index,
      submissionStatus: option.value
    });
    await this.loadActiveTab();
  },

  async refreshCurrent() {
    await this.refreshDashboard();
    await this.loadActiveTab();
  },

  async approveSubmission(event) {
    await this.reviewSubmission(event.currentTarget.dataset.id, "approve");
  },

  async rejectSubmission(event) {
    await this.reviewSubmission(event.currentTarget.dataset.id, "reject");
  },

  async reviewSubmission(id, decision) {
    if (!id || this.data.reviewingId) {
      return;
    }

    this.setData({ reviewingId: id });
    try {
      await store.reviewExerciseSubmission(id, decision);
      wx.showToast({
        title: decision === "reject" ? "已拒绝" : "已通过",
        icon: "success"
      });
      await this.refreshCurrent();
    } catch (error) {
      wx.showToast({ title: "审核失败", icon: "none" });
    } finally {
      this.setData({ reviewingId: "" });
    }
  },

  async deleteSubmission(event) {
    await this.confirmAndDelete({
      id: event.currentTarget.dataset.id,
      title: "删除提交记录？",
      action: () => store.deleteAdminExerciseSubmission(event.currentTarget.dataset.id)
    });
  },

  async promoteUser(event) {
    await this.changeUserRole(event.currentTarget.dataset.id, "admin");
  },

  async demoteUser(event) {
    await this.changeUserRole(event.currentTarget.dataset.id, "user");
  },

  async changeUserRole(id, role) {
    if (!id || this.data.roleChangingId) {
      return;
    }

    this.setData({ roleChangingId: id });
    try {
      await store.setAdminUserRole(id, role);
      wx.showToast({ title: "角色已更新", icon: "success" });
      await this.refreshCurrent();
    } catch (error) {
      wx.showToast({ title: "角色更新失败", icon: "none" });
    } finally {
      this.setData({ roleChangingId: "" });
    }
  },

  async deleteUser(event) {
    await this.confirmAndDelete({
      id: event.currentTarget.dataset.id,
      title: "删除用户？",
      action: () => store.deleteAdminUser(event.currentTarget.dataset.id)
    });
  },

  newExercise() {
    this.setData({
      exerciseForm: emptyExerciseForm(),
      editingExercise: true
    });
  },

  onExerciseKeywordInput(event) {
    this.setData({
      exerciseKeyword: event.detail.value
    });
  },

  async searchAdminExercises() {
    await this.loadActiveTab();
  },

  async clearExerciseSearch() {
    this.setData({ exerciseKeyword: "" });
    await this.loadActiveTab();
  },

  editExercise(event) {
    const item = this.data.exercises[event.currentTarget.dataset.index];
    if (!item) {
      return;
    }

    this.setData({
      editingExercise: true,
      exerciseForm: {
        id: item.id || "",
        docId: item.docId || item.id || "",
        exerciseId: item.exerciseId || "",
        nameZh: item.name || "",
        nameEn: item.nameEn || "",
        muscleZh: item.muscle || "",
        equipmentZh: item.equipment || "",
        imageUrl: item.imageFileId || item.imageUrl || "",
        imageFileId: item.imageFileId || ""
      }
    });
  },

  cancelExerciseEdit() {
    this.setData({
      editingExercise: false,
      exerciseForm: emptyExerciseForm()
    });
  },

  onExerciseInput(event) {
    const field = event.currentTarget.dataset.field;
    this.setData({
      [`exerciseForm.${field}`]: event.detail.value
    });
  },

  async saveExercise() {
    if (!this.data.exerciseForm.nameZh.trim()) {
      wx.showToast({ title: "请填写动作名称", icon: "none" });
      return;
    }

    this.setData({ saving: true });
    try {
      await store.saveAdminExercise({
        ...this.data.exerciseForm,
        id: this.data.exerciseForm.docId || this.data.exerciseForm.id,
        imageFileId: this.data.exerciseForm.imageUrl && this.data.exerciseForm.imageUrl.startsWith("cloud://")
          ? this.data.exerciseForm.imageUrl
          : this.data.exerciseForm.imageFileId
      });
      wx.showToast({ title: "动作已保存", icon: "success" });
      this.cancelExerciseEdit();
      await this.refreshCurrent();
    } catch (error) {
      wx.showToast({ title: "动作保存失败", icon: "none" });
    } finally {
      this.setData({ saving: false });
    }
  },

  async deleteExercise(event) {
    await this.confirmAndDelete({
      id: event.currentTarget.dataset.id,
      title: "删除动作？",
      action: () => store.deleteAdminExercise(event.currentTarget.dataset.id)
    });
  },

  newLearnContent() {
    this.setData({
      learnForm: emptyLearnForm(),
      editingLearn: true
    });
  },

  editLearnContent(event) {
    const item = this.data.learnContents[event.currentTarget.dataset.index];
    if (!item) {
      return;
    }

    this.setData({
      editingLearn: true,
      learnForm: {
        id: item.id || "",
        docId: item.docId || item.id || "",
        title: item.title || "",
        muscle: item.muscle || "",
        summary: item.summary || "",
        type: item.type || "video",
        durationText: item.durationText || "",
        coverUrl: item.coverUrl || "",
        coverFileId: item.coverFileId || "",
        videoUrl: item.videoUrl || "",
        videoFileId: item.videoFileId || "",
        status: item.status || "published",
        sort: String(item.sort || "10")
      }
    });
  },

  cancelLearnEdit() {
    this.setData({
      editingLearn: false,
      learnForm: emptyLearnForm()
    });
  },

  onLearnInput(event) {
    const field = event.currentTarget.dataset.field;
    this.setData({
      [`learnForm.${field}`]: event.detail.value
    });
  },

  async saveLearnContent() {
    if (!this.data.learnForm.title.trim() || !this.data.learnForm.muscle.trim()) {
      wx.showToast({ title: "请填写标题和部位", icon: "none" });
      return;
    }

    this.setData({ saving: true });
    try {
      await store.saveAdminLearnContent({
        ...this.data.learnForm,
        id: this.data.learnForm.docId || this.data.learnForm.id
      });
      wx.showToast({ title: "学习内容已保存", icon: "success" });
      this.cancelLearnEdit();
      await this.refreshCurrent();
    } catch (error) {
      wx.showToast({ title: "学习内容保存失败", icon: "none" });
    } finally {
      this.setData({ saving: false });
    }
  },

  async deleteLearnContent(event) {
    await this.confirmAndDelete({
      id: event.currentTarget.dataset.id,
      title: "删除学习内容？",
      action: () => store.deleteAdminLearnContent(event.currentTarget.dataset.id)
    });
  },

  editWorkout(event) {
    const item = this.data.workouts[event.currentTarget.dataset.index];
    if (!item) {
      return;
    }

    this.setData({
      editingWorkout: true,
      workoutForm: {
        id: item.id || "",
        docId: item.docId || item.id || "",
        date: item.date || "",
        exerciseName: item.exerciseName || "",
        exerciseNameEn: item.exerciseNameEn || "",
        exerciseId: item.exerciseId || "",
        exerciseImageUrl: item.exerciseImageUrl || "",
        sets: String(item.sets || ""),
        reps: String(item.reps || ""),
        weight: String(item.weight || ""),
        note: item.note || ""
      }
    });
  },

  cancelWorkoutEdit() {
    this.setData({
      editingWorkout: false,
      workoutForm: emptyWorkoutForm()
    });
  },

  onWorkoutInput(event) {
    const field = event.currentTarget.dataset.field;
    this.setData({
      [`workoutForm.${field}`]: event.detail.value
    });
  },

  async saveWorkout() {
    if (!this.data.workoutForm.exerciseName.trim()) {
      wx.showToast({ title: "请填写训练动作", icon: "none" });
      return;
    }

    this.setData({ saving: true });
    try {
      await store.saveAdminWorkout({
        ...this.data.workoutForm,
        id: this.data.workoutForm.docId || this.data.workoutForm.id
      });
      wx.showToast({ title: "训练已保存", icon: "success" });
      this.cancelWorkoutEdit();
      await this.refreshCurrent();
    } catch (error) {
      wx.showToast({ title: "训练保存失败", icon: "none" });
    } finally {
      this.setData({ saving: false });
    }
  },

  async deleteWorkout(event) {
    await this.confirmAndDelete({
      id: event.currentTarget.dataset.id,
      title: "删除训练记录？",
      action: () => store.deleteAdminWorkout(event.currentTarget.dataset.id)
    });
  },

  editMeal(event) {
    const item = this.data.meals[event.currentTarget.dataset.index];
    if (!item) {
      return;
    }

    this.setData({
      editingMeal: true,
      mealForm: {
        id: item.id || "",
        docId: item.docId || item.id || "",
        date: item.date || "",
        type: item.type || "",
        food: item.food || "",
        calories: String(item.calories || ""),
        protein: String(item.protein || ""),
        note: item.note || ""
      }
    });
  },

  cancelMealEdit() {
    this.setData({
      editingMeal: false,
      mealForm: emptyMealForm()
    });
  },

  onMealInput(event) {
    const field = event.currentTarget.dataset.field;
    this.setData({
      [`mealForm.${field}`]: event.detail.value
    });
  },

  async saveMeal() {
    if (!this.data.mealForm.food.trim()) {
      wx.showToast({ title: "请填写食物", icon: "none" });
      return;
    }

    this.setData({ saving: true });
    try {
      await store.saveAdminMeal({
        ...this.data.mealForm,
        id: this.data.mealForm.docId || this.data.mealForm.id
      });
      wx.showToast({ title: "饮食已保存", icon: "success" });
      this.cancelMealEdit();
      await this.refreshCurrent();
    } catch (error) {
      wx.showToast({ title: "饮食保存失败", icon: "none" });
    } finally {
      this.setData({ saving: false });
    }
  },

  async deleteMeal(event) {
    await this.confirmAndDelete({
      id: event.currentTarget.dataset.id,
      title: "删除饮食记录？",
      action: () => store.deleteAdminMeal(event.currentTarget.dataset.id)
    });
  },

  async confirmAndDelete(options) {
    if (!options.id || this.data.deletingId) {
      return;
    }

    wx.showModal({
      title: options.title,
      content: "删除后不可恢复",
      confirmText: "删除",
      confirmColor: "#bf3d2c",
      success: async (result) => {
        if (!result.confirm) {
          return;
        }

        this.setData({ deletingId: options.id });
        try {
          await options.action();
          wx.showToast({ title: "已删除", icon: "success" });
          await this.refreshCurrent();
        } catch (error) {
          wx.showToast({ title: "删除失败", icon: "none" });
        } finally {
          this.setData({ deletingId: "" });
        }
      }
    });
  }
});
