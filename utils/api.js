const config = require('../config')
const TOKEN_KEY = 'musclego_access_token'
const DEVICE_KEY = 'musclego_device_id'

function getDeviceId() {
  let deviceId = wx.getStorageSync(DEVICE_KEY)
  if (!deviceId) {
    deviceId = `dev-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`
    wx.setStorageSync(DEVICE_KEY, deviceId)
  }
  return deviceId
}

function request(path, data) {
  if (!config.apiBaseUrl) return Promise.reject(new Error('服务尚未配置'))
  const token = wx.getStorageSync(TOKEN_KEY)
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${config.apiBaseUrl}${path}`,
      method: 'POST',
      header: token ? { Authorization: `Bearer ${token}` } : {},
      data,
      success: ({ statusCode, data: response }) => {
        if (statusCode >= 200 && statusCode < 300) resolve(response)
        else {
          if (statusCode === 401) wx.removeStorageSync(TOKEN_KEY)
          reject(new Error((response && response.message) || '服务请求失败'))
        }
      },
      fail: reject
    })
  })
}

async function ensureLogin() {
  if (!config.apiBaseUrl) throw new Error('服务尚未配置')
  const saved = wx.getStorageSync(TOKEN_KEY)
  if (saved) return saved
  const { code } = await new Promise((resolve, reject) => wx.login({ success: resolve, fail: reject }))
  if (!code) throw new Error('微信登录失败')
  const result = await request('/auth/login', { code, deviceId: getDeviceId() })
  if (!result.token) throw new Error('登录响应缺少凭证')
  wx.setStorageSync(TOKEN_KEY, result.token)
  return result.token
}

function createMembershipOrder(plan) {
  return request('/payments/membership', { productId: plan.id, autoRenew: plan.autoRenew })
}

function scheduleReminder(time, enabled = true) {
  return request('/reminders/schedule', { time, enabled })
}

function syncWorkout(record) {
  return request('/records/complete', record)
}

function getPartnerOverview() {
  return request('/partners/overview', {})
}

function acceptInvite(inviteCode) {
  return request('/partners/accept', { inviteCode })
}

function cheerPartner(partnerId) {
  return request('/partners/cheer', { partnerId })
}

function nudgePartner(partnerId, type = 'quick') {
  return request('/partners/nudge', { partnerId, type })
}

function respondNudge(nudgeId, status) {
  return request('/partners/nudge/respond', { nudgeId, status })
}

function removePartner(partnerId) {
  return request('/partners/remove', { partnerId })
}

function updateNickname(nickname) {
  return request('/profile/nickname', { nickname })
}

module.exports = { ensureLogin, createMembershipOrder, scheduleReminder, syncWorkout, getPartnerOverview, acceptInvite, cheerPartner, nudgePartner, respondNudge, removePartner, updateNickname }
