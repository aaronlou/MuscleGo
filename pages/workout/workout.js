const app = getApp()
const store = require('../../utils/store')
const { getWorkout } = require('../../utils/data')

Page({
  data: { statusBarHeight: 20, workout: {}, current: {}, index: 0, remaining: 40, running: false, finished: false, summary: {} },

  onLoad(options) {
    const day = Math.max(0, Math.min(6, Number(options.day) || 0))
    const workout = getWorkout(day)
    this.day = day
    this.setData({ statusBarHeight: app.globalData.statusBarHeight, workout, current: workout.exercises[0], remaining: workout.exercises[0].seconds })
  },

  onUnload() { this.clearTimer() },
  onHide() { this.pauseTimer() },
  clearTimer() { if (this.timer) clearInterval(this.timer); this.timer = null },
  pauseTimer() { this.clearTimer(); if (this.data.running) this.setData({ running: false }) },

  toggleTimer() {
    if (this.data.running) { this.pauseTimer(); return }
    this.setData({ running: true })
    this.timer = setInterval(() => {
      if (this.data.remaining <= 1) {
        this.clearTimer()
        this.nextExercise()
      } else {
        this.setData({ remaining: this.data.remaining - 1 })
      }
    }, 1000)
  },

  nextExercise() {
    this.clearTimer()
    const next = this.data.index + 1
    if (next >= this.data.workout.exercises.length) {
      const summary = store.completeWorkout(this.day)
      this.setData({ running: false, finished: true, summary })
      wx.vibrateShort({ type: 'light' })
      return
    }
    const current = this.data.workout.exercises[next]
    this.setData({ index: next, current, remaining: current.seconds, running: false })
  },

  previousExercise() {
    if (!this.data.index) return
    this.clearTimer()
    const index = this.data.index - 1
    const current = this.data.workout.exercises[index]
    this.setData({ index, current, remaining: current.seconds, running: false })
  },

  exitWorkout() {
    if (this.data.finished) { wx.navigateBack(); return }
    wx.showModal({ title: '先休息一下？', content: '本次进度不会保存，完成后才会打卡。', confirmText: '退出训练', confirmColor: '#EC6A3B', success: ({ confirm }) => { if (confirm) wx.navigateBack() } })
  },
  backToday() { wx.switchTab({ url: '/pages/today/today' }) },
  viewRecords() { wx.switchTab({ url: '/pages/records/records' }) }
})
