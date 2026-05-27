const muscleMap = {
  abdominals: "腹肌",
  abductors: "髋外展肌",
  adductors: "髋内收肌",
  biceps: "肱二头肌",
  calves: "小腿",
  chest: "胸部",
  forearms: "前臂",
  glutes: "臀部",
  hamstrings: "腘绳肌",
  lats: "背阔肌",
  "lower back": "下背部",
  "middle back": "中背部",
  neck: "颈部",
  quadriceps: "股四头肌",
  shoulders: "肩部",
  traps: "斜方肌",
  triceps: "肱三头肌"
};

const equipmentMap = {
  bands: "弹力带",
  barbell: "杠铃",
  "body only": "自重",
  cable: "绳索器械",
  dumbbell: "哑铃",
  "e-z curl bar": "曲杆",
  "exercise ball": "健身球",
  "foam roll": "泡沫轴",
  kettlebells: "壶铃",
  machine: "固定器械",
  "medicine ball": "药球",
  other: "其他",
  null: "无器械"
};

const categoryMap = {
  cardio: "有氧",
  olympic_weightlifting: "奥举",
  plyometrics: "增强式训练",
  powerlifting: "力量举",
  strength: "力量训练",
  stretching: "拉伸",
  strongman: "大力士训练"
};

const levelMap = {
  beginner: "初级",
  intermediate: "中级",
  expert: "高级"
};

const namePhraseMap = [
  ["Barbell Bench Press - Medium Grip", "杠铃卧推"],
  ["Barbell Full Squat", "杠铃深蹲"],
  ["Barbell Deadlift", "杠铃硬拉"],
  ["Bent Over Barbell Row", "俯身杠铃划船"],
  ["Standing Military Press", "站姿推举"],
  ["Dumbbell Bicep Curl", "哑铃弯举"],
  ["Walking Lunge", "行走箭步蹲"],
  ["Pullups", "引体向上"],
  ["Pushups", "俯卧撑"],
  ["Plank", "平板支撑"]
];

const wordMap = [
  ["Alternating", "交替"],
  ["Alternate", "交替"],
  ["Assisted", "辅助"],
  ["Backward", "后向"],
  ["Behind The Neck", "颈后"],
  ["Bent Over", "俯身"],
  ["Close-Grip", "窄握"],
  ["Close Grip", "窄握"],
  ["Decline", "下斜"],
  ["Incline", "上斜"],
  ["Seated", "坐姿"],
  ["Standing", "站姿"],
  ["Single-Arm", "单臂"],
  ["Single Arm", "单臂"],
  ["One-Arm", "单臂"],
  ["One Arm", "单臂"],
  ["Reverse", "反向"],
  ["Front", "前"],
  ["Side", "侧"],
  ["Lateral", "侧平"],
  ["Rear", "后束"],
  ["Barbell", "杠铃"],
  ["Dumbbell", "哑铃"],
  ["Kettlebell", "壶铃"],
  ["Cable", "绳索"],
  ["Band", "弹力带"],
  ["Machine", "器械"],
  ["Medicine Ball", "药球"],
  ["Bench", "卧推凳"],
  ["Ball", "球"],
  ["Press", "推举"],
  ["Bench Press", "卧推"],
  ["Shoulder Press", "肩推"],
  ["Military Press", "军式推举"],
  ["Squat", "深蹲"],
  ["Deadlift", "硬拉"],
  ["Row", "划船"],
  ["Curl", "弯举"],
  ["Hammer Curl", "锤式弯举"],
  ["Extension", "伸展"],
  ["Raise", "平举"],
  ["Flyes", "飞鸟"],
  ["Fly", "飞鸟",
  ],
  ["Crunch", "卷腹"],
  ["Sit-Up", "仰卧起坐"],
  ["Sit Up", "仰卧起坐"],
  ["Lunge", "箭步蹲"],
  ["Pull-Up", "引体向上"],
  ["Pullup", "引体向上"],
  ["Push-Up", "俯卧撑"],
  ["Pushup", "俯卧撑"],
  ["Dip", "臂屈伸"],
  ["Calf Raise", "提踵"],
  ["Leg Press", "腿举"],
  ["Leg Curl", "腿弯举"],
  ["Leg Extension", "腿屈伸"],
  ["Hip Thrust", "臀推"],
  ["Good Morning", "早安式"],
  ["Shrug", "耸肩"],
  ["Pulldown", "下拉"],
  ["Pushdown", "下压"],
  ["Kickback", "后踢"],
  ["Bridge", "桥式"],
  ["Stretch", "拉伸"],
  ["Rotation", "旋转"],
  ["Twist", "转体"],
  ["Walk", "行走"],
  ["Run", "跑"],
  ["Jump", "跳"],
  ["Step-Up", "登阶"],
  ["Step Up", "登阶"],
  ["Clean", "翻举"],
  ["Snatch", "抓举"],
  ["Jerk", "挺举"]
];

function translateList(values, map) {
  return (values || []).map((item) => map[item] || item).join("/");
}

function translateName(name) {
  if (!name) {
    return "";
  }

  const phrase = namePhraseMap.find(([source]) => source.toLowerCase() === name.toLowerCase());
  if (phrase) {
    return phrase[1];
  }

  let result = name;
  wordMap.forEach(([source, target]) => {
    result = result.replace(new RegExp(source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), target);
  });

  result = result
    .replace(/\s*-\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return /[\u4e00-\u9fa5]/.test(result) ? result : "";
}

function translateExercise(item) {
  const primaryMuscles = item.primaryMuscles || [];
  return {
    nameZh: translateName(item.name),
    muscleZh: translateList(primaryMuscles, muscleMap),
    equipmentZh: equipmentMap[item.equipment] || item.equipment || "无器械",
    categoryZh: categoryMap[item.category] || item.category || "",
    levelZh: levelMap[item.level] || item.level || ""
  };
}

module.exports = {
  translateExercise,
  muscleMap,
  equipmentMap,
  categoryMap,
  levelMap
};
