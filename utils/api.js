const config = require('../config')

function request(path, data) {
  if (!config.apiBaseUrl) return Promise.reject(new Error('服务尚未配置'))
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${config.apiBaseUrl}${path}`,
      method: 'POST',
      data,
      success: ({ statusCode, data: response }) => statusCode >= 200 && statusCode < 300 ? resolve(response) : reject(new Error(response.message || '服务请求失败')),
      fail: reject
    })
  })
}

function createMembershipOrder(plan) {
  return request('/payments/membership', { productId: plan.id, autoRenew: plan.autoRenew })
}

function scheduleReminder(time, enabled = true) {
  return request('/reminders/schedule', { time, enabled })
}

module.exports = { createMembershipOrder, scheduleReminder }
