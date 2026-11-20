import { Route, Routes } from 'react-router-dom'
import PublicLayout from '@/layouts/PublicLayout.jsx'
import HomePage from '@/pages/public/HomePage.jsx'
import NotFoundPage from '@/pages/NotFoundPage.jsx'

// Customer (/account/*), admin (/admin/*) and auth routes are added in Phase 3.
export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<HomePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
