import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'

// PR0007 Q2: 顶层 import echarts 注册 LineChart/BarChart/Heatmap 等
import '@/composables/echartsCore'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')