// App.js — v5: Added PaymentModal, OrderTracker, Socket.IO
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider }  from './context/AuthContext';
import { CartProvider }  from './context/CartContext';

import ProtectedRoute from './components/ProtectedRoute';
import LandingPage    from './pages/LandingPage';
import LoginPage      from './pages/LoginPage';
import RegisterPage   from './pages/RegisterPage';
import BrandHome      from './pages/BrandHome';
import MenuPage       from './pages/MenuPage';
import CartPage       from './pages/CartPage';
import ProfilePage    from './pages/ProfilePage';
import InvoicePage    from './pages/InvoicePage';
import { OrderSuccessPage, OrderHistoryPage } from './pages/OrderPages';
import {
  AdminLayout, AdminLoginPage, AdminDashboard,
  AdminDishManager, AdminOrderManager, AdminUserManager
} from './pages/AdminPages';

import './index.css';

const P = ({ children, adminOnly }) => (
  <ProtectedRoute adminOnly={adminOnly}>{children}</ProtectedRoute>
);

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <CartProvider>
            <Toaster
              position="top-center"
              toastOptions={{
                duration: 2800,
                style: { fontFamily:'DM Sans,sans-serif', fontSize:14, fontWeight:500, borderRadius:12, boxShadow:'0 8px 24px rgba(0,0,0,.15)' },
                success: { iconTheme:{ primary:'#22c55e', secondary:'#fff' }},
                error:   { iconTheme:{ primary:'#e8294a', secondary:'#fff' }},
              }}
            />
            <Routes>
              {/* Public */}
              <Route path="/login"    element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/invoice/:orderId" element={<InvoicePage />} />

              {/* Protected: Home */}
              <Route path="/"        element={<P><LandingPage /></P>} />
              <Route path="/profile" element={<P><ProfilePage /></P>} />

              {/* Chinese brand */}
              <Route path="/chinese"               element={<P><BrandHome brand="chinese"/></P>} />
              <Route path="/chinese/menu"          element={<P><MenuPage  brand="chinese"/></P>} />
              <Route path="/chinese/cart"          element={<P><CartPage  brand="chinese"/></P>} />
              <Route path="/chinese/order-success" element={<P><OrderSuccessPage brand="chinese"/></P>} />
              <Route path="/chinese/orders"        element={<P><OrderHistoryPage brand="chinese"/></P>} />

              {/* Ice Cream brand */}
              <Route path="/icecream"               element={<P><BrandHome brand="icecream"/></P>} />
              <Route path="/icecream/menu"          element={<P><MenuPage  brand="icecream"/></P>} />
              <Route path="/icecream/cart"          element={<P><CartPage  brand="icecream"/></P>} />
              <Route path="/icecream/order-success" element={<P><OrderSuccessPage brand="icecream"/></P>} />
              <Route path="/icecream/orders"        element={<P><OrderHistoryPage brand="icecream"/></P>} />

              {/* Admin */}
              <Route path="/admin/login" element={<AdminLoginPage />} />
              <Route path="/admin" element={<P adminOnly><AdminLayout /></P>}>
                <Route index         element={<AdminDashboard />} />
                <Route path="dishes" element={<AdminDishManager />} />
                <Route path="orders" element={<AdminOrderManager />} />
                <Route path="users"  element={<AdminUserManager />} />
              </Route>

              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </CartProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
