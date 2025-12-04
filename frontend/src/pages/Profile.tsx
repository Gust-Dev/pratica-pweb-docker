import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { getProfile, updateProfile } from '@/api/auth';
import { handlePhotoUpload } from '@/api/storage';
import { dismissToast, showError, showLoading, showSuccess } from '@/utils/toast';
import { Loader2, User, Edit3, Save, X, RefreshCw } from 'lucide-react';

const profileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z
    .string()
    .trim()
    .email('Email inválido'),
  photo: z
    .union([
      z.literal(''),
      z
        .string()
        .trim()
        .url('URL da foto inválida'),
    ]),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

const emptyForm: ProfileFormValues = {
  name: '',
  email: '',
  photo: '',
};

const Profile = () => {
  const [formValues, setFormValues] = useState<ProfileFormValues>(emptyForm);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof ProfileFormValues, string>>>({});
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const { user, tokens, updateUser } = useAuth();

  const accessToken = tokens?.accessToken ?? '';
  const updateUserRef = useRef(updateUser);
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    updateUserRef.current = updateUser;
  }, [updateUser]);

  const resolvedUserValues = useMemo<ProfileFormValues>(() => ({
    name: user?.name ?? '',
    email: user?.email ?? '',
    photo: user?.photo ?? '',
  }), [user]);

  useEffect(() => {
    setFormValues(resolvedUserValues);
    setFormErrors({});
  }, [resolvedUserValues]);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!accessToken) {
        setIsLoadingProfile(false);
        return;
      }

      setIsLoadingProfile(true);
      try {
        const latestProfile = await getProfile(accessToken);
        if (latestProfile) {
          updateUserRef.current(latestProfile);
        }
      } finally {
        setIsLoadingProfile(false);
      }
    };

    fetchProfile();
  }, [accessToken]);

  const handleInputChange = (field: keyof ProfileFormValues) => (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setFormValues(prev => ({
      ...prev,
      [field]: value,
    }));
    setFormErrors(prev => ({
      ...prev,
      [field]: undefined,
    }));
  };

  useEffect(() => {
    if (isEditing) {
      // focus first field when entering edit mode to improve UX
      nameInputRef.current?.focus();
    }
  }, [isEditing]);

  const onPhotoFileSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    event.target.value = '';

    if (!user?.id) {
      showError('Sessão inválida. Faça login novamente para enviar a foto.');
      return;
    }

    setIsUploadingPhoto(true);
    const loadingToastId = showLoading('Enviando foto...');

    try {
      const uploadResult = await handlePhotoUpload(file, {
        accessToken,
        userId: user.id,
      });

      if (!uploadResult.success) {
        showError(uploadResult.error);
        return;
      }

      setFormValues(prev => ({
        ...prev,
        photo: uploadResult.publicUrl,
      }));

      if (uploadResult.user) {
        updateUser(uploadResult.user);
      } else {
        updateUser({ photo: uploadResult.publicUrl });
      }
      showSuccess('Foto enviada com sucesso.');
    } finally {
      dismissToast(loadingToastId);
      setIsUploadingPhoto(false);
    }
  };

  const handleCancel = () => {
    setFormValues(resolvedUserValues);
    setFormErrors({});
    setIsEditing(false);
  };

  const handleEditClick = () => {
    setFormErrors({});
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!isEditing) {
      return;
    }

    const result = profileSchema.safeParse(formValues);
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof ProfileFormValues, string>> = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof ProfileFormValues;
        fieldErrors[field] = issue.message;
      }
      setFormErrors(fieldErrors);
      return;
    }

    if (!accessToken) {
      showError('Sessão expirada. Faça login novamente.');
      return;
    }

    const baselineResult = profileSchema.safeParse(resolvedUserValues);
    const baselineValues = baselineResult.success ? baselineResult.data : resolvedUserValues;
    const didChange = (Object.keys(result.data) as Array<keyof ProfileFormValues>).some(
      key => baselineValues[key]?.trim?.() !== result.data[key]?.trim?.(),
    );

    if (!didChange) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      const updatedUser = await updateProfile(accessToken, {
        name: result.data.name,
        email: result.data.email,
        photo: result.data.photo || undefined,
      });

      if (!updatedUser) {
        return;
      }

      updateUser(updatedUser);
      setIsEditing(false);
      setFormErrors({});
    } catch (error) {
      console.error('Erro ao atualizar perfil:', error);
      showError('Não foi possível atualizar o perfil.');
    } finally {
      setIsSaving(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-bold">Meu Perfil</CardTitle>
            <CardDescription>
              Gerencie suas informações pessoais
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {isLoadingProfile && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Carregando dados do perfil...
              </div>
            )}
            {/* Avatar Section */}
            <div className="flex items-center space-x-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src={formValues.photo || user?.photo} alt={user?.name} />
                <AvatarFallback className="text-lg">
                  {user?.name ? getInitials(user.name) : <User className="h-8 w-8" />}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="text-lg font-semibold">{formValues.name || user?.name}</h3>
                <p className="text-gray-600">{formValues.email || user?.email}</p>
              </div>
            </div>

            {/* Form */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <Input
                  id="name"
                  ref={nameInputRef}
                  value={formValues.name}
                  onChange={handleInputChange('name')}
                  disabled={!isEditing}
                  className={formErrors.name ? 'border-red-500' : ''}
                />
                {formErrors.name && (
                  <p className="text-sm text-red-500">{formErrors.name}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formValues.email}
                  onChange={handleInputChange('email')}
                  disabled={!isEditing}
                  className={formErrors.email ? 'border-red-500' : ''}
                />
                {formErrors.email && (
                  <p className="text-sm text-red-500">{formErrors.email}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="photo">URL da Foto</Label>
                <Input
                  id="photo"
                  type="url"
                  placeholder="https://exemplo.com/foto.jpg"
                  value={formValues.photo}
                  onChange={handleInputChange('photo')}
                  disabled={!isEditing}
                  className={formErrors.photo ? 'border-red-500' : ''}
                />
                {formErrors.photo && (
                  <p className="text-sm text-red-500">{formErrors.photo}</p>
                )}
                <div className="space-y-2">
                  <Label htmlFor="photo-file" className="sr-only">
                    Upload de foto
                  </Label>
                  <Input
                    id="photo-file"
                    type="file"
                    accept="image/*"
                    disabled={!isEditing || isUploadingPhoto}
                    onChange={onPhotoFileSelected}
                  />
                  {isUploadingPhoto && (
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Enviando foto para o Supabase...
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Escolha uma imagem para enviar ao Supabase Storage. O link público será preenchido automaticamente.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-2">
                <Button
                  type="button"
                  onClick={handleEditClick}
                  className={`flex items-center space-x-2 ${isEditing ? 'hidden' : ''}`}
                >
                  <Edit3 className="h-4 w-4" />
                  <span>Editar</span>
                </Button>
                <div className={`flex space-x-2 ${isEditing ? '' : 'hidden'}`}>
                  <Button
                    type="button"
                    disabled={isSaving}
                    className="flex items-center space-x-2"
                    onClick={handleSave}
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Salvando...</span>
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4" />
                        <span>Salvar</span>
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancel}
                    className="flex items-center space-x-2"
                  >
                    <X className="h-4 w-4" />
                    <span>Cancelar</span>
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Profile;
