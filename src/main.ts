import { createPinia } from 'pinia'
import { createPiniaSimplePersist } from 'pinia-simple-persist'
import { createApp } from 'vue'
import App from './App.vue'
import './styles/main.scss'

const app = createApp(App)
const pinia = createPinia()

pinia.use(createPiniaSimplePersist())

app.use(pinia)
app.mount('#app')