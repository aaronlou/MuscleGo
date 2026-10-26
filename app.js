const store = require('./utils/store')

App({
  globalData: {
    statusBarHeight: 20,
    navBarHeight: 44
  },

  onLaunch() {
    store.init()
    const system = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
    this.globalData.statusBarHeight = system.statusBarHeight || 20
  }
})
