import './assets/main.css'

import { createApp }  from 'vue'
import { initState }  from './state'
import App            from './App.vue'

initState().then(() => createApp(App).mount('#app'))
