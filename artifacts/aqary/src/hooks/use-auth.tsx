import { createContext, useContext, useEffect, useState } from "react";
import { useGetMe, useLogin, useRegister } from "@workspace/api-client-react";
import type { UserProfile, LoginBody, RegisterBody } from "@workspace/api-client-react";
import { useToast } from "./use-toast";
import { useLocation } from "wouter";

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isLoading: boolean;
  login: (data: LoginBody) => Promise<void>;
  register: (data: RegisterBody) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("token"));
  const { data: user, isLoading: isUserLoading, refetch } = useGetMe({
    query: {
      queryKey: ["auth", "me"],
      enabled: !!token,
      retry: false,
    }
  });
  
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const loginMutation = useLogin();
  const registerMutation = useRegister();

  const handleLogin = async (data: LoginBody) => {
    try {
      const response = await loginMutation.mutateAsync({ data });
      localStorage.setItem("token", response.token);
      setToken(response.token);
      await refetch();
      toast({ title: "تم تسجيل الدخول بنجاح" });
      setLocation("/");
    } catch (error: unknown) {
      const errData = error && typeof error === "object" && "data" in error ? (error as { data?: { error?: string } }).data : undefined;
      toast({ 
        title: "خطأ في تسجيل الدخول", 
        description: errData?.error || "يرجى التأكد من البريد الإلكتروني وكلمة المرور",
        variant: "destructive"
      });
      throw error;
    }
  };

  const handleRegister = async (data: RegisterBody) => {
    try {
      const response = await registerMutation.mutateAsync({ data });
      localStorage.setItem("token", response.token);
      setToken(response.token);
      await refetch();
      toast({ title: "تم إنشاء الحساب بنجاح" });
      setLocation("/");
    } catch (error: unknown) {
      const errData = error && typeof error === "object" && "data" in error ? (error as { data?: { error?: string } }).data : undefined;
      toast({ 
        title: "خطأ في إنشاء الحساب", 
        description: errData?.error || "حدث خطأ غير متوقع",
        variant: "destructive"
      });
      throw error;
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setLocation("/login");
  };

  return (
    <AuthContext.Provider
      value={{
        user: user || null,
        token,
        isLoading: isUserLoading && !!token,
        login: handleLogin,
        register: handleRegister,
        logout: handleLogout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
