const app = getApp()
const store = require('../../utils/store')
const config = require('../../config')
const api = require('../../utils/api')
const { getWorkout } = require('../../utils/data')
const { dateKey, formatToday } = require('../../utils/date')

Page({
  data: { statusBarHeight: 20, greeting: '你好', dateText: '', workout: {}, week: [], summary: {}, completed: false, doneText: '', draft: null, weekTarget: 4, incomingNudge: null },

  onLoad() {
    this.setData({ statusBarHeight: app.globalData.statusBarHeight })
  },

  onShow() {
    const now = new Date()
    const today = dateKey(now)
    const hour = now.getHours()
    const dayIndex = now.getDay()
    const monday = new Date(now)
    monday.setDate(now.getDate() - ((dayIndex + 6) % 7))
    const state = store.getState()
    const draft = state.draft && state.draft.date === today ? state.draft : null
    const week = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(monday)
      date.setDate(monday.getDate() + index)
      const key = dateKey(date)
      const record = state.records[key]
      return { label: ['一', '二', '三', '四', '五', '六', '日'][index], day: date.getDate(), checked: !!record, light: record && record.type === 'light', today: key === today }
    })
    const todayRecord = state.records[today]
    this.setData({
      greeting: hour < 11 ? '早上好' : hour < 18 ? '下午好' : '晚上好',
      dateText: formatToday(now),
      workout: getWorkout(draft ? draft.dayIndex : dayIndex, draft ? draft.mode : 'standard'),
      week,
      summary: store.getSummary(),
      completed: !!todayRecord,
      doneText: todayRecord && todayRecord.type === 'light' ? '✓ 今日已轻量打卡' : '✓ 今日已打卡',
      draft
    })
    this.refreshNudge()
  },

  async refreshNudge() {
    const state = store.getState()
    if (!config.apiBaseUrl || !state.settings.partnerSharing) {
      this.setData({ incomingNudge: null })
      return
    }
    try {
      await api.ensureLogin()
      const result = await api.getPartnerOverview()
      const incomingNudge = (result.incomingNudges || [])[0] || null
      this.setData({ incomingNudge })
    } catch (error) {
      this.setData({ incomingNudge: null })
    }
  },

  openPartners() { wx.navigateTo({ url: '/pages/partners/partners' }) },

  startWorkout() {
    const draft = this.data.draft
    const day = draft ? draft.dayIndex : new Date().getDay()
    const mode = draft ? draft.mode : 'standard'
    wx.navigateTo({ url: `/pages/workout/workout?day=${day}&mode=${mode}${draft ? '&resume=1' : ''}` })
  },

  startQuick() {
    wx.navigateTo({ url: `/pages/workout/workout?day=${new Date().getDay()}&mode=quick` })
  },

  openPlan() {
    wx.switchTab({ url: '/pages/plan/plan' })
  }
})
