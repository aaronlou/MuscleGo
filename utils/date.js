function pad(value) {
  return String(value).padStart(2, '0')
}

function dateKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function fromKey(key) {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function formatToday(date = new Date()) {
  const weeks = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
  return `${date.getMonth() + 1}月${date.getDate()}日 · ${weeks[date.getDay()]}`
}

function getStreak(records) {
  let streak = 0
  const cursor = new Date()
  if (!records[dateKey(cursor)]) cursor.setDate(cursor.getDate() - 1)
  while (records[dateKey(cursor)]) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

module.exports = { dateKey, fromKey, formatToday, getStreak, pad }
