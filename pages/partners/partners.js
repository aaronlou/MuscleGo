const app = getApp()
const store = require('../../utils/store')
const config = require('../../config')
const api = require('../../utils/api')
const { dateKey } = require('../../utils/date')

const NUDGE_STATUS = { pending: '已邀请，等回应', training: '对方去练了', rest: '对方今天休息' }

function normalizePerson(person = {}) {
  const weekCount = Number(person.weekCount) || 0
  const nudged = !!person.nudgedToday
  const actionKind = nudged ? '' : person.todayCompleted ? 'cheer' : 'quick'
  return {
    ...person,
    nickname: person.nickname || '锻炼搭子',
    weekCount,
    todayStatus: person.todayCompleted ? '今天已打卡' : '今天还未打卡',
    progress: Array.from({ length: 4 }, (_, index) => index < Math.min(weekCount, 4)),
    actionKind,
    actionLabel: nudged ? NUDGE_STATUS[person.nudgeStatus] || '今天已邀请' : person.todayCompleted ? '送一句加油' : '邀请一起练'
  }
}

Page({
  data: {
    statusBarHeight: 20,
    configured: false,
    loading: false,
    error: '',
    inviteCode: '',
    me: { weekCount: 0, progress: [] },
    partners: [],
    totalWeekCount: 0,
    enabled: false,
    showConsent: false,
    myNickname: '',
    incomingNudges: []
  },

  onLoad(options) {
    this.pendingInvite = options.invite || ''
    const enabled = !!store.getState().settings.partnerSharing
    const configured = !!config.apiBaseUrl
    this.setData({ statusBarHeight: app.globalData.statusBarHeight, configured, enabled, showConsent: configured && !enabled })
  },

  onShow() { this.loadPartners() },
  async onPullDownRefresh() {
    await this.loadPartners()
    wx.stopPullDownRefresh()
  },
  goBack() { wx.navigateBack() },
  enablePartners() {
    store.saveSettings({ partnerSharing: true })
    this.setData({ enabled: true, showConsent: false })
    this.loadPartners()
  },

  async loadPartners() {
    if (!config.apiBaseUrl || !this.data.enabled || this.data.loading) return
    this.setData({ loading: true, error: '' })
    try {
      await api.ensureLogin()
      await this.backfillWeek()
      if (this.pendingInvite) {
        await api.acceptInvite(this.pendingInvite)
        this.pendingInvite = ''
        wx.showToast({ title: '已成为锻炼搭子', icon: 'success' })
      }
      const result = await api.getPartnerOverview()
      const me = normalizePerson({ ...result.me, nickname: '我' })
      const partners = (result.partners || []).map(normalizePerson)
      const incomingNudges = result.incomingNudges || []
      const totalWeekCount = me.weekCount + partners.reduce((sum, person) => sum + person.weekCount, 0)
      this.setData({ me, partners, incomingNudges, totalWeekCount, inviteCode: result.inviteCode || '', myNickname: (result.me && result.me.nickname) || '' })
    } catch (error) {
      this.setData({ error: error.message || '暂时无法加载搭子进度' })
    } finally {
      this.setData({ loading: false })
    }
  },

  async backfillWeek() {
    const state = store.getState()
    if (state.settings.partnerBackfillDone) return
    const now = new Date()
    const monday = new Date(now)
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7))
    const start = dateKey(monday)
    const end = dateKey(now)
    const records = Object.values(state.records).filter(record => record.date >= start && record.date <= end)
    for (const record of records) {
      await api.syncWorkout({
        sessionId: `local-${record.date}`,
        clientDate: record.date,
        durationSeconds: record.durationSeconds || record.minutes * 60,
        completedExercises: record.exercises,
        full: record.type === 'complete'
      })
    }
    store.saveSettings({ partnerBackfillDone: true })
  },

  onShareAppMessage() {
    const path = this.data.inviteCode ? `/pages/partners/partners?invite=${encodeURIComponent(this.data.inviteCode)}` : '/pages/partners/partners'
    return { title: '和我一起每周锻炼 4 天，互相陪伴、轻松坚持', path }
  },

  editNickname() {
    wx.showModal({
      title: '搭子看到的昵称',
      editable: true,
      content: this.data.myNickname,
      placeholderText: '请输入 2–12 个字符',
      success: async ({ confirm, content }) => {
        if (!confirm) return
        const nickname = String(content || '').trim()
        if (Array.from(nickname).length < 2) { wx.showToast({ title: '昵称至少需要 2 个字符', icon: 'none' }); return }
        try {
          const result = await api.updateNickname(nickname)
          this.setData({ myNickname: result.user.nickname })
          wx.showToast({ title: '昵称已更新', icon: 'success' })
        } catch (error) {
          wx.showToast({ title: error.message || '昵称更新失败', icon: 'none' })
        }
      }
    })
  },

  async partnerAction(event) {
    const partnerId = event.currentTarget.dataset.id
    const kind = event.currentTarget.dataset.kind
    const partner = this.data.partners.find(item => item.id === partnerId)
    if (!partner || !kind || partner.nudgedToday || (kind === 'cheer' && partner.cheeredToday)) return
    try {
      if (kind === 'cheer') {
        await api.cheerPartner(partnerId)
        this.setData({ partners: this.data.partners.map(item => item.id === partnerId ? { ...item, cheeredToday: true } : item) })
        wx.showToast({ title: '鼓励已送出', icon: 'success' })
      } else {
        await api.nudgePartner(partnerId, 'quick')
        this.setData({ partners: this.data.partners.map(item => item.id === partnerId ? { ...item, nudgedToday: true, nudgeStatus: 'pending', actionKind: '', actionLabel: NUDGE_STATUS.pending } : item) })
        wx.showToast({ title: '一起练邀请已发出', icon: 'success' })
      }
    } catch (error) {
      wx.showToast({ title: error.message || '暂时无法提醒', icon: 'none' })
    }
  },

  async respondNudge(event) {
    const { id, status } = event.currentTarget.dataset
    try {
      await api.respondNudge(id, status)
      this.setData({ incomingNudges: this.data.incomingNudges.filter(item => item.id !== id) })
      if (status === 'training') {
        wx.navigateTo({ url: `/pages/workout/workout?day=${new Date().getDay()}&mode=quick` })
      } else {
        wx.showToast({ title: '已回应，今天好好休息', icon: 'none' })
      }
    } catch (error) {
      wx.showToast({ title: error.message || '回应失败，请重试', icon: 'none' })
    }
  },

  remove(event) {
    const partnerId = event.currentTarget.dataset.id
    wx.showModal({
      title: '解除锻炼搭子？',
      content: '解除后，双方将不再看到彼此的打卡进度。',
      confirmText: '解除关系',
      confirmColor: '#D96B43',
      success: async ({ confirm }) => {
        if (!confirm) return
        try {
          await api.removePartner(partnerId)
          wx.showToast({ title: '已解除关系', icon: 'success' })
          this.loadPartners()
        } catch (error) {
          wx.showToast({ title: error.message || '操作失败，请重试', icon: 'none' })
        }
      }
    })
  }
})
