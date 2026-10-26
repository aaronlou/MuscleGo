const app = getApp()
const store = require('../../utils/store')
const { dateKey, pad } = require('../../utils/date')

Page({
  data: { statusBarHeight: 20, summary: {}, year: 0, month: 0, calendar: [], records: [], monthCount: 0 },
  onLoad() { this.setData({ statusBarHeight: app.globalData.statusBarHeight }) },
  onShow() {
    const now = new Date()
    this.renderMonth(now.getFullYear(), now.getMonth())
  },
  renderMonth(year, monthIndex) {
    const state = store.getState()
    const first = new Date(year, monthIndex, 1)
    const days = new Date(year, monthIndex + 1, 0).getDate()
    const today = dateKey()
    const prefix = (first.getDay() + 6) % 7
    const calendar = Array.from({ length: prefix }, () => ({ blank: true }))
    for (let day = 1; day <= days; day += 1) {
      const key = `${year}-${pad(monthIndex + 1)}-${pad(day)}`
      calendar.push({ day, key, checked: !!state.records[key], today: key === today })
    }
    const records = Object.values(state.records).filter(item => {
      const date = new Date(item.completedAt)
      return date.getFullYear() === year && date.getMonth() === monthIndex
    }).sort((a, b) => b.completedAt - a.completedAt).map(item => ({ ...item, label: `${Number(item.date.slice(5, 7))}月${Number(item.date.slice(8))}日` }))
    this.setData({ year, month: monthIndex + 1, cursorYear: year, cursorMonth: monthIndex, calendar, records, monthCount: records.length, summary: store.getSummary() })
  },
  changeMonth(event) {
    const offset = Number(event.currentTarget.dataset.offset)
    const date = new Date(this.data.cursorYear, this.data.cursorMonth + offset, 1)
    if (date > new Date()) return
    this.renderMonth(date.getFullYear(), date.getMonth())
  },
  goToday() { wx.switchTab({ url: '/pages/today/today' }) }
})
