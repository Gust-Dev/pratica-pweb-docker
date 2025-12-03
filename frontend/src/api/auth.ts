import { API_BASE_URL } from "@/utils/apiBaseUrl";
import { showSuccess, showError, showLoading, dismissToast } from "@/utils/toast";

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  photo?: string;
}

export interface ProfileUpdateRequest {
  name?: string;
  email?: string;
  photo?: string;
}

export const login = async (email: string, password: string): Promise<LoginResponse | null> => {
  const loadingToastId = showLoading("Fazendo login...");
  try {
    const response = await fetch(`${API_BASE_URL}/signin`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    if (response.ok) {
      const data: LoginResponse = await response.json();
      dismissToast(loadingToastId);
      showSuccess("Login realizado com sucesso!");
      return data;
    } else {
      throw new Error("Credenciais inválidas");
    }
  } catch (error) {
    dismissToast(loadingToastId);
    showError("Erro ao fazer login. Verifique suas credenciais.");
    console.error("Erro no login:", error);
    return null;
  }
};

export const getProfile = async (accessToken: string): Promise<User | null> => {
  try {
    const response = await fetch(`${API_BASE_URL}/profile`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (response.ok) {
      const data: User = await response.json();
      return data;
    } else {
      throw new Error("Falha ao carregar perfil");
    }
  } catch (error) {
    console.error("Erro ao carregar perfil:", error);
    return null;
  }
};

export const updateProfile = async (
  accessToken: string,
  profileData: ProfileUpdateRequest
): Promise<User | null> => {
  const loadingToastId = showLoading("Atualizando perfil...");
  try {
    const response = await fetch(`${API_BASE_URL}/profile`, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(profileData),
    });

    if (response.ok) {
      const data: User = await response.json();
      dismissToast(loadingToastId);
      showSuccess("Perfil atualizado com sucesso!");
      return data;
    } else {
      throw new Error("Falha ao atualizar perfil");
    }
  } catch (error) {
    dismissToast(loadingToastId);
    showError("Erro ao atualizar perfil.");
    console.error("Erro ao atualizar perfil:", error);
    return null;
  }
};
