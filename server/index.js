const path = require('node:path')
const { createApp } = require('./app')

const port = Number(process.env.PORT) || 3000
const dataFile = process.env.DATA_FILE || path.join(__dirname, 'data', 'musclego.json')
const app = createApp({ dataFile })

app.listen(port, '0.0.0.0', () => {
  console.log(`MuscleGo 服务端已启动：http://127.0.0.1:${port}`)
  console.log(`数据文件：${dataFile}`)
  if (!process.env.WX_APPID || !process.env.WX_SECRET) {
    console.log('当前为本地开发登录模式；正式环境请配置 WX_APPID 和 WX_SECRET。')
  }
})
