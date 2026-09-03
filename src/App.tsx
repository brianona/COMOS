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

  const handleVerified = (verified: boolean, activeDeviceId: string, updatedUser?: User, newToken?: string) => {
    setIsVerified(verified);
    localStorage.setItem("isDeviceVerified", String(verified));
    if (newToken) {
      localStorage.setItem("token", newToken);
      setToken(newToken);
    }
    if (updatedUser) {
      const u = { ...updatedUser, is_verified: verified };
      localStorage.setItem("user", JSON.stringify(u));
      setUser(u);
    } else if (user) {
      const updatedUser = { ...user, device_id: activeDeviceId, is_verified: verified };
      localStorage.setItem("user", JSON.stringify(updatedUser));
      setUser(updatedUser);
    }
  };

  // Check device verification on session restore or when token changes
  useEffect(() => {
    if (token && user && user.role === "vessel") {
      const activeDevId = healAndSyncDeviceId(user.device_id);
      fetch("/api/device/verify", {
        headers: {
          "Authorization": `Bearer ${token}`,
          "X-Device-Id": activeDevId
        }
      })
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data && data.is_verified) {
            handleVerified(true, data.device_id || user.device_id, data.user, data.token);
          } else if (data && data.is_verified === false && isVerified) {
            setIsVerified(false);
            localStorage.setItem("isDeviceVerified", "false");
          }
        })
        .catch(err => console.warn("Device verification check:", err));
    }
  }, [token]);

  // Listen to realtime device updates in App level
  useEffect(() => {
    if (!token || !user || user.role !== "vessel") return;
    const unsub = realtimeSync.subscribe(['device', 'device_registration_requests', 'users'], (event) => {
      if (!event.userId || event.userId === user.id) {
        const activeDevId = healAndSyncDeviceId(user.device_id);
        fetch("/api/device/verify", {
          headers: {
            "Authorization": `Bearer ${token}`,
            "X-Device-Id": activeDevId
          }
        })
          .then(res => res.ok ? res.json() : null)
          .then(data => {
            if (data && data.is_verified) {
              handleVerified(true, data.device_id || user.device_id, data.user, data.token);
            } else if (data && data.is_verified === false) {
              setIsVerified(false);
              localStorage.setItem("isDeviceVerified", "false");
            }
          })
          .catch(err => console.warn("Realtime device check:", err));
      }
    });

    return () => unsub();
  }, [token, user?.id, user?.role]);

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
