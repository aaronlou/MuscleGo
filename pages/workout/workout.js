const app = getApp()
const store = require('../../utils/store')
const config = require('../../config')
const api = require('../../utils/api')
const { getWorkout } = require('../../utils/data')
const { dateKey } = require('../../utils/date')

Page({
  data: { statusBarHeight: 20, workout: {}, current: {}, index: 0, remaining: 40, running: false, finished: false, summary: {}, elapsedSeconds: 0, canFinishEarly: false, actualMinutes: 0, completedExercises: 0, finishTitle: '', finishCopy: '' },

  onLoad(options) {
    const day = Math.max(0, Math.min(6, Number(options.day) || 0))
    const mode = options.mode === 'quick' ? 'quick' : 'standard'
    const workout = getWorkout(day, mode)
    const saved = store.getState().draft
    const resume = options.resume === '1' && saved && saved.date === dateKey() && saved.dayIndex === day && saved.mode === mode
    const index = resume ? Math.max(0, Math.min(workout.exercises.length - 1, saved.index || 0)) : 0
    const current = workout.exercises[index]
    const remaining = resume && saved.remaining > 0 ? Math.min(current.seconds, saved.remaining) : current.seconds
    const elapsedSeconds = resume ? saved.elapsedSeconds || 0 : 0
    this.day = day
    this.mode = mode
    this.sessionId = resume && saved.sessionId ? saved.sessionId : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    this.startedAt = Date.now() - elapsedSeconds * 1000
    this.hiddenAt = null
    this.setData({ statusBarHeight: app.globalData.statusBarHeight, workout, current, index, remaining, elapsedSeconds, canFinishEarly: elapsedSeconds >= 60 })
  },

  onShow() {
    if (this.hiddenAt) {
      this.startedAt += Date.now() - this.hiddenAt
      this.hiddenAt = null
    }
    if (this.startedAt && !this.data.finished) this.startSessionClock()
  },
  onHide() {
    this.pauseTimer()
    this.clearSessionClock()
    if (this.startedAt && !this.data.finished) this.saveProgress()
    this.hiddenAt = Date.now()
  },
  onUnload() { this.clearTimer(); this.clearSessionClock() },

  getElapsedSeconds() { return Math.max(0, Math.floor((Date.now() - this.startedAt) / 1000)) },
  startSessionClock() {
    this.clearSessionClock()
    this.updateElapsed()
    this.sessionTimer = setInterval(() => this.updateElapsed(), 1000)
  },
  updateElapsed() {
    const elapsedSeconds = this.getElapsedSeconds()
    if (elapsedSeconds !== this.data.elapsedSeconds) this.setData({ elapsedSeconds, canFinishEarly: elapsedSeconds >= 60 })
  },
  clearSessionClock() { if (this.sessionTimer) clearInterval(this.sessionTimer); this.sessionTimer = null },
  saveProgress() {
    store.saveDraft({ dayIndex: this.day, mode: this.mode, index: this.data.index, remaining: this.data.remaining, elapsedSeconds: this.getElapsedSeconds(), sessionId: this.sessionId })
  },
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
      this.finishWorkout(true)
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

  finishEarly() {
    if (this.getElapsedSeconds() < 60) {
      wx.showToast({ title: '活动满 1 分钟即可保存', icon: 'none' })
      return
    }
    const minutes = Math.max(1, Math.round(this.getElapsedSeconds() / 60))
    wx.showModal({
      title: '保存本次训练？',
      content: `已活动约 ${minutes} 分钟，将按实际时长保存为轻量打卡。`,
      confirmText: '保存打卡',
      success: ({ confirm }) => { if (confirm) this.finishWorkout(false) }
    })
  },

  finishWorkout(full) {
    this.clearTimer()
    this.clearSessionClock()
    const elapsedSeconds = Math.max(60, this.getElapsedSeconds())
    const completedExercises = full ? this.data.workout.exercises.length : Math.max(1, this.data.index)
    const summary = store.completeWorkout(this.day, { mode: this.mode, elapsedSeconds, completedExercises, full })
    this.setData({
      running: false,
      finished: true,
      summary,
      actualMinutes: Math.max(1, Math.round(elapsedSeconds / 60)),
      completedExercises,
      finishTitle: full ? '今日训练已完成' : '本次训练已保存',
      finishCopy: this.mode === 'quick' || !full ? '轻量完成也算坚持，下次继续就好' : '打卡成功，记得补充水分'
    })
    wx.vibrateShort({ type: 'light' })
    this.syncWorkout(elapsedSeconds, completedExercises, full)
  },

  syncWorkout(elapsedSeconds, completedExercises, full) {
    if (!config.apiBaseUrl || !store.getState().settings.partnerSharing) return
    api.ensureLogin()
      .then(() => api.syncWorkout({ sessionId: this.sessionId, clientDate: dateKey(), dayIndex: this.day, mode: this.mode, durationSeconds: elapsedSeconds, completedExercises, full }))
      .catch(() => wx.showToast({ title: '本机已打卡，云端同步失败', icon: 'none' }))
  },

  exitWorkout() {
    if (this.data.finished) { wx.navigateBack(); return }
    wx.showModal({ title: '暂时离开训练？', content: '当前进度会保留，下次可以继续。活动满 1 分钟后也可提前保存打卡。', confirmText: '保留并退出', confirmColor: '#23453B', success: ({ confirm }) => { if (confirm) wx.navigateBack() } })
  },
  onShareAppMessage() {
    const minutes = this.data.actualMinutes || 1
    const weekCount = this.data.summary.weekCount || 0
    return {
      title: `我今天活动了 ${minutes} 分钟，本周已完成 ${weekCount}/4 天，一起练吧`,
      path: '/pages/today/today?from=friend'
    }
  },
  backToday() { wx.switchTab({ url: '/pages/today/today' }) },
  viewRecords() { wx.switchTab({ url: '/pages/records/records' }) }
})
