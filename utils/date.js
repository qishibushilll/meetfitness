function pad(value) {
  return value < 10 ? `0${value}` : `${value}`;
}

function formatDate(date = new Date()) {
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  return `${year}-${month}-${day}`;
}

function displayDate(dateText) {
  const [year, month, day] = dateText.split("-");
  return `${year}年${Number(month)}月${Number(day)}日`;
}

module.exports = {
  formatDate,
  displayDate
};
