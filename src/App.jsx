import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { GuestOnly, RequireAdmin, RequireAuth } from '@/auth/guards.jsx'
import PageLoader from '@/components/feedback/PageLoader.jsx'
import AuthLayout from '@/layouts/AuthLayout.jsx'
import PublicLayout from '@/layouts/PublicLayout.jsx'
import ForgotPasswordPage from '@/pages/auth/ForgotPasswordPage.jsx'
import LoginPage from '@/pages/auth/LoginPage.jsx'
import RegisterPage from '@/pages/auth/RegisterPage.jsx'
import ResetPasswordPage from '@/pages/auth/ResetPasswordPage.jsx'
import NotFoundPage from '@/pages/NotFoundPage.jsx'
import HomePage from '@/pages/public/HomePage.jsx'

// Portal areas are loaded on demand so public visitors download less.
const CustomerLayout = lazy(() => import('@/layouts/CustomerLayout.jsx'))
const CustomerDashboardPage = lazy(() => import('@/pages/customer/CustomerDashboardPage.jsx'))
const ProfilePage = lazy(() => import('@/pages/customer/ProfilePage.jsx'))
const MenuPage = lazy(() => import('@/pages/customer/MenuPage.jsx'))
const AdminLayout = lazy(() => import('@/layouts/AdminLayout.jsx'))
const AdminDashboardPage = lazy(() => import('@/pages/admin/AdminDashboardPage.jsx'))
const DishesPage = lazy(() => import('@/pages/admin/DishesPage.jsx'))
const DishFormPage = lazy(() => import('@/pages/admin/DishFormPage.jsx'))
const CatalogueGroupsPage = lazy(() => import('@/pages/admin/CatalogueGroupsPage.jsx'))

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<HomePage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>

        <Route element={<AuthLayout />}>
          <Route element={<GuestOnly />}>
            <Route path="login" element={<LoginPage />} />
            <Route path="register" element={<RegisterPage />} />
            <Route path="forgot-password" element={<ForgotPasswordPage />} />
          </Route>
          {/* Not guest-only: the reset link signs the user in with a recovery session. */}
          <Route path="reset-password" element={<ResetPasswordPage />} />
        </Route>

        <Route element={<RequireAuth />}>
          <Route path="account" element={<CustomerLayout />}>
            <Route index element={<CustomerDashboardPage />} />
            <Route path="menu" element={<MenuPage />} />
            <Route path="profile" element={<ProfilePage />} />
          </Route>

          <Route path="admin" element={<RequireAdmin />}>
            <Route element={<AdminLayout />}>
              <Route index element={<AdminDashboardPage />} />
              <Route path="dishes" element={<DishesPage />} />
              <Route path="dishes/new" element={<DishFormPage />} />
              <Route path="dishes/:id" element={<DishFormPage />} />
              <Route path="catalogue" element={<CatalogueGroupsPage />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </Suspense>
  )
}
