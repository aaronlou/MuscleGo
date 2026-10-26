const app = getApp()
const api = require('../../utils/api')
const store = require('../../utils/store')

const plans = [
  { id: 'musclego_quarterly_auto', name: '连续包季', price: 68, days: 90, description: '每天不到 0.8 元', autoRenew: true, badge: '推荐' },
  { id: 'musclego_yearly', name: '年度会员', price: 198, days: 365, description: '一次支付，全年有效', autoRenew: false, badge: '更省心' },
  { id: 'musclego_monthly', name: '月度会员', price: 28, days: 30, description: '单次支付，不自动续费', autoRenew: false, badge: '' }
]

Page({
  data: { statusBarHeight: 20, plans, selected: 0, agreed: false, paying: false },
  onLoad() { this.setData({ statusBarHeight: app.globalData.statusBarHeight }) },
  goBack() { wx.navigateBack() },
  selectPlan(event) { this.setData({ selected: Number(event.currentTarget.dataset.index) }) },
  toggleAgreement() { this.setData({ agreed: !this.data.agreed }) },
  showAgreement() { wx.showModal({ title: '会员服务说明', content: '会员有效期以支付结果为准。连续包季将通过微信支付签约并在每个周期到期前自动扣款，可在微信支付管理中随时关闭。具体金额和扣款时间以支付签约页为准。', showCancel: false }) },
  async pay() {
    if (this.data.paying) return
    if (!this.data.agreed) { wx.showToast({ title: '请先阅读并同意服务说明', icon: 'none' }); return }
    const plan = plans[this.data.selected]
    this.setData({ paying: true })
    wx.showLoading({ title: '正在创建订单', mask: true })
    try {
      const payment = await api.createMembershipOrder(plan)
      wx.hideLoading()
      await new Promise((resolve, reject) => wx.requestPayment({
        timeStamp: payment.timeStamp,
        nonceStr: payment.nonceStr,
        package: payment.package,
        signType: payment.signType || 'RSA',
        paySign: payment.paySign,
        success: resolve,
        fail: reject
      }))
      store.saveMember({ productId: plan.id, autoRenew: plan.autoRenew, startedAt: Date.now() })
      wx.showToast({ title: '支付成功', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 1200)
    } catch (error) {
      wx.hideLoading()
      const cancelled = error.errMsg && error.errMsg.includes('cancel')
      wx.showModal({ title: cancelled ? '已取消支付' : '暂时无法支付', content: cancelled ? '订单未支付，你可以稍后重试。' : (error.message === '服务尚未配置' ? '请先配置服务端支付接口。真实支付与自动扣款不会在客户端模拟。' : '请稍后重试，如已扣款请联系客服核查。'), showCancel: false })
    } finally {
      this.setData({ paying: false })
    }
  }
})
