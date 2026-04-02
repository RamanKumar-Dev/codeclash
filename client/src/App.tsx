import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { LobbyPage } from './pages/LobbyPage';
import { BattlePage } from './pages/BattlePage';
import { LeaderboardPage } from './pages/LeaderboardPage';

function App() {
  return (
    <div className="min-h-screen bg-gray-900">
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route 
          path="/lobby" 
          element={
            <ProtectedRoute>
              <LobbyPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/battle/:roomId" 
          element={
            <ProtectedRoute>
              <BattlePage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/leaderboard" 
          element={
            <ProtectedRoute>
              <LeaderboardPage />
            </ProtectedRoute>
          } 
        />
        <Route path="/" element={<Navigate to="/lobby" replace />} />
      </Routes>
    </div>
  );
}

export default App;
