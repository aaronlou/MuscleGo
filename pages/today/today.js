const app = getApp()
const store = require('../../utils/store')
const { getWorkout } = require('../../utils/data')
const { dateKey, formatToday } = require('../../utils/date')

Page({
  data: { navHeight: 88, statusBarHeight: 20, greeting: '你好', dateText: '', workout: {}, week: [], summary: {}, completed: false },

  onLoad() {
    this.setData({ statusBarHeight: app.globalData.statusBarHeight })
  },

  onShow() {
    const now = new Date()
    const hour = now.getHours()
    const dayIndex = now.getDay()
    const monday = new Date(now)
    monday.setDate(now.getDate() - ((dayIndex + 6) % 7))
    const state = store.getState()
    const week = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(monday)
      date.setDate(monday.getDate() + index)
      const key = dateKey(date)
      return { label: ['一', '二', '三', '四', '五', '六', '日'][index], day: date.getDate(), checked: !!state.records[key], today: key === dateKey(now) }
    })
    this.setData({
      greeting: hour < 11 ? '早上好' : hour < 18 ? '下午好' : '晚上好',
      dateText: formatToday(now),
      workout: getWorkout(dayIndex),
      week,
      summary: store.getSummary(),
      completed: !!state.records[dateKey(now)]
    })
  },

  startWorkout() {
    wx.navigateTo({ url: `/pages/workout/workout?day=${new Date().getDay()}` })
  },

  openPlan() {
    wx.switchTab({ url: '/pages/plan/plan' })
  }
})
