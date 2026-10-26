const app = getApp()
const { weekly, getWorkout } = require('../../utils/data')

Page({
  data: { statusBarHeight: 20, weekly, selected: 0, workout: {}, activeExercise: -1 },
  onLoad() {
    const selected = new Date().getDay()
    this.setData({ statusBarHeight: app.globalData.statusBarHeight, selected, workout: getWorkout(selected) })
  },
  selectDay(event) {
    const selected = Number(event.currentTarget.dataset.day)
    this.setData({ selected, workout: getWorkout(selected), activeExercise: -1 })
  },
  toggleExercise(event) {
    const index = Number(event.currentTarget.dataset.index)
    this.setData({ activeExercise: this.data.activeExercise === index ? -1 : index })
  },
  startWorkout() {
    wx.navigateTo({ url: `/pages/workout/workout?day=${this.data.selected}` })
  }
})
