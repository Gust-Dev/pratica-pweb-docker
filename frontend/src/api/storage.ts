import { API_BASE_URL } from "@/utils/apiBaseUrl";
import type { User } from "@/api/auth";

export type UploadResult =
  | { success: true; publicUrl: string; user?: User }
  | { success: false; error: string };

interface UploadOptions {
  accessToken?: string;
  userId: string;
}

export const handlePhotoUpload = async (
  file: File,
  { accessToken, userId }: UploadOptions,
): Promise<UploadResult> => {
  if (!userId) {
    return {
      success: false,
      error: "Sessão inválida. Faça login novamente para enviar a foto.",
    };
  }

  const formData = new FormData();
  formData.append("avatar", file);

  try {
    const response = await fetch(`${API_BASE_URL}/users/${userId}/avatar`, {
      method: "PUT",
      headers: accessToken
        ? {
            Authorization: `Bearer ${accessToken}`,
          }
        : undefined,
      body: formData,
    });

    if (!response.ok) {
      let errorMessage = "Não foi possível enviar a foto.";
      try {
        const errorBody = await response.json();
        if (typeof errorBody?.error === "string") {
          errorMessage = errorBody.error;
        }
      } catch {
        // ignore JSON parse failure, use fallback message
      }
      return { success: false, error: errorMessage };
    }

    const data = await response.json();
    const publicUrl: string | undefined = data?.user?.photo ?? data?.publicUrl;

    if (!publicUrl) {
      return {
        success: false,
        error: "Não foi possível obter a URL pública da foto.",
      };
    }

    return {
      success: true,
      publicUrl,
      user: data?.user,
    };
  } catch (error) {
    console.error("Erro ao enviar foto para o backend:", error);
    return {
      success: false,
      error: "Falha ao conectar ao servidor para enviar a foto.",
    };
  }
};
