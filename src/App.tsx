/**
 * Clean Ocean Maritime Operations System (COMOS) - (c) 2026
 */
import React, { useState, useEffect } from "react";
import { User, DBStatus } from "./types";
import { Login } from "./components/Login";
import { DeviceRegistration } from "./components/DeviceRegistration";
import { Dashboard } from "./components/Dashboard";
import { 
  healAndSyncDeviceId, 
  isDeviceRegistered, 
  requestStoragePersistence 
} from "./utils/deviceIdentifier";
import { realtimeSync } from "./services/realtimeSync";

export const App = () => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("token"));
  const [user, setUser] = useState<User | null>(() => {
    const cached = localStorage.getItem("user");
    return cached ? JSON.parse(cached) : null;
  });
  const [isVerified, setIsVerified] = useState<boolean>(() => {
    return localStorage.getItem("isDeviceVerified") === "true";
  });
  const [dbStatus, setDbStatus] = useState<DBStatus | null>(null);

  useEffect(() => {
    requestStoragePersistence();
    realtimeSync.setToken(token);
    fetch("/api/db-status")
      .then(res => {
        if (!res.ok) throw new Error("Failed to fetch db status");
        return res.json();
      })
      .then(data => setDbStatus(data))
      .catch(err => console.error("Error checking db status:", err));
  }, [token]);

  const handleRefreshDb = async () => {
    try {
      const res = await fetch("/api/db-status");
      if (res.ok) {
        const data = await res.json();
        setDbStatus(data);
        return data;
      }
    } catch (err) {
      console.error("Error refreshing db status:", err);
    }
  };

  const handleLogin = (newToken: string, newUser: User) => {
    localStorage.setItem("token", newToken);
    localStorage.setItem("user", JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);

    const activeDevId = healAndSyncDeviceId(newUser.device_id);

    if (newUser.role !== "vessel") {
      setIsVerified(true);
      localStorage.setItem("isDeviceVerified", "true");
    } else {
      const verified = isDeviceRegistered(newUser.device_id, activeDevId);
      setIsVerified(verified);
      localStorage.setItem("isDeviceVerified", String(verified));
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("isDeviceVerified");
    setToken(null);
    setUser(null);
    setIsVerified(false);
  };

  const handleVerified = (verified: boolean, activeDeviceId: string) => {
    setIsVerified(verified);
    localStorage.setItem("isDeviceVerified", String(verified));
    if (user) {
      const updatedUser = { ...user, device_id: activeDeviceId };
      localStorage.setItem("user", JSON.stringify(updatedUser));
      setUser(updatedUser);
    }
  };

  if (!token || !user) {
    return <Login onLogin={handleLogin} dbStatus={dbStatus} onRefreshDb={handleRefreshDb} />;
  }

  if (user.role === "vessel" && !isVerified) {
    return (
      <DeviceRegistration
        user={user}
        token={token}
        onLogout={handleLogout}
        onVerified={handleVerified}
      />
    );
  }

  return (
    <Dashboard
      user={user}
      token={token}
      onLogout={handleLogout}
    />
  );
};

export default App;
