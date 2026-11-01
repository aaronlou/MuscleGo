const app = getApp()
const store = require('../../utils/store')
const config = require('../../config')
const api = require('../../utils/api')

Page({
  data: { statusBarHeight: 20, settings: {}, summary: {}, member: null },

  onLoad() { this.setData({ statusBarHeight: app.globalData.statusBarHeight }) },
  onShow() {
    const state = store.getState()
    this.setData({ settings: state.settings, summary: store.getSummary(), member: state.member })
  },

  async toggleReminder(event) {
    const enabled = event.detail.value
    if (!enabled) {
      store.saveSettings({ reminder: false })
      this.setData({ 'settings.reminder': false })
      if (config.apiBaseUrl) {
        try { await api.scheduleReminder(this.data.settings.reminderTime, false) }
        catch (error) { wx.showToast({ title: '本机已关闭，云端同步失败', icon: 'none' }); return }
      }
      wx.showToast({ title: '提醒偏好已关闭', icon: 'none' })
      return
    }
    try {
      if (config.subscribeTemplateIds.length) {
        const result = await new Promise((resolve, reject) => wx.requestSubscribeMessage({ tmplIds: config.subscribeTemplateIds, success: resolve, fail: reject }))
        if (!config.subscribeTemplateIds.every(id => result[id] === 'accept')) throw new Error('未接受订阅消息')
      }
      store.saveSettings({ reminder: true })
      this.setData({ 'settings.reminder': true })
      if (config.apiBaseUrl) {
        const result = await api.scheduleReminder(this.data.settings.reminderTime)
        if (result && result.scheduled === false) {
          wx.showModal({ title: '提醒偏好已保存', content: result.message || '服务端尚未配置微信订阅消息，当前不会发送通知。', showCancel: false })
        } else {
          wx.showToast({ title: '提醒已设置', icon: 'success' })
        }
      } else {
        wx.showModal({ title: '提醒偏好已保存', content: '正式推送需接入服务端和订阅消息模板，当前不会发送微信通知。', showCancel: false })
      }
    } catch (error) {
      store.saveSettings({ reminder: false })
      this.setData({ 'settings.reminder': false })
      wx.showToast({ title: '提醒设置失败，请重试', icon: 'none' })
    }
  },

  async changeTime(event) {
    const reminderTime = event.detail.value
    store.saveSettings({ reminderTime })
    this.setData({ 'settings.reminderTime': reminderTime })
    if (this.data.settings.reminder && config.apiBaseUrl) {
      try { await api.scheduleReminder(reminderTime); wx.showToast({ title: '提醒时间已保存', icon: 'success' }) }
      catch (error) { wx.showToast({ title: '时间保存成功，同步失败', icon: 'none' }) }
    }
  },

  onShareAppMessage() {
    return { title: '每天几分钟，一起轻松锻炼、互相陪伴', path: '/pages/today/today?from=invite' }
  },
  openPartners() { wx.navigateTo({ url: '/pages/partners/partners' }) },
  openMembership() { wx.navigateTo({ url: '/pages/membership/membership' }) },
  showSafety() { wx.showModal({ title: '训练安全须知', content: '训练前先活动关节，训练中保持自然呼吸。慢性病患者、术后恢复期人群请先咨询医生；出现胸痛、眩晕或明显疼痛时立即停止。', showCancel: false, confirmText: '我知道了' }) },
  showPrivacy() { wx.showModal({ title: '隐私说明', content: '训练与打卡默认仅保存在当前设备。只有你主动开启锻炼搭子后，才会同步昵称及打卡进度用于好友互相查看。支付和提醒等正式服务也应在隐私协议中说明用途并取得授权。', showCancel: false }) }
})
