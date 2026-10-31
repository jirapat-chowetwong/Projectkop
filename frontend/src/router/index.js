import { createRouter,createWebHistory } from "vue-router"
import Home from '../views/Home.vue'
import Products from '../views/Products.vue'
import ProDetail from '../views/ProDetail.vue'
import Cart from '../views/Cart.vue'
import Login from '../views/Login.vue'
import Register from '../views/Register.vue'
import Profile from '../views/Profile.vue'
import AdminMembers from '../views/AdminMembers.vue'
import AdminProducts from '../views/AdminProducts.vue'

const routes = [
    {
        path:'/',
        name: 'home',
        component:Home
    },
    {
        path:'/products',
        name:'products',
        component:Products
    },
    {
        path:'/login',
        name:'login',
        component:Login
    },

    {
        path:'/register',
        name:'register',
        component:Register
    },
    
    {
        path:'/profile',
        name:'profile',
        component:Profile
    },
    {
        path:'/admin/products',
        name:'admin-products',
        component:AdminProducts
    },
    {
        path:'/admin/members',
        name:'admin-members',
        component:AdminMembers
    },
    {
        path:'/prodetail/:id',
        name:'detail',
        component:ProDetail
    },
    {
        path:'/cart',
        name:'cart',
        component:Cart
    }
]
const router = createRouter({
    history:createWebHistory(import.meta.env.BASE_URL),
    routes,
    scrollBehavior() { return { top: 0 } }
})

export default router

