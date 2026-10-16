"use client";

import { useEffect, useId, useRef, useState, type ChangeEvent } from "react";
import { Upload, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { userImageMimeTypes, validateUserImageFile } from "@/lib/users/image";
import { getInitials } from "@/lib/utils";

export type ProfileImageFieldProps = {
  imageUrl?: string | null;
  displayName?: string;
  disabled?: boolean;
  error?: string;
  onValidityChange?: (valid: boolean) => void;
  onChange?: (changed: boolean) => void;
};

/** Shared optional photo control for account, employee and student forms. */
export function ProfileImageField({ imageUrl, displayName = "Profile", disabled, error, onValidityChange, onChange }: ProfileImageFieldProps) {
  const id = useId();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [localError, setLocalError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const imageError = localError || error;
  const src = previewUrl ?? (removeImage ? null : imageUrl);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  function clearSelection(removing = removeImage) {
    if (fileRef.current) fileRef.current.value = "";
    setSelectedFile(null);
    setPreviewUrl(null);
    setLocalError("");
    onValidityChange?.(true);
    onChange?.(removing);
  }

  function selectImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) { clearSelection(); return; }
    const issue = validateUserImageFile(file);
    if (issue) {
      clearSelection();
      setLocalError(issue);
      onValidityChange?.(false);
      return;
    }
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setRemoveImage(false);
    setLocalError("");
    onValidityChange?.(true);
    onChange?.(true);
  }

  return (
    <fieldset disabled={disabled} className="min-w-0 space-y-5 rounded-lg border border-border bg-card p-5 shadow-sm">
      <legend className="px-2 text-base font-semibold">Profile photo</legend>
      {removeImage && <input type="hidden" name="removeImage" value="true" />}
      <div className="flex flex-col items-center gap-3">
        <Avatar className="size-28 border border-border">
          <AvatarImage src={src ?? undefined} alt={selectedFile ? "Selected profile photo preview" : `Profile photo for ${displayName}`} className="object-cover" />
          <AvatarFallback className="text-3xl">{getInitials(displayName)}</AvatarFallback>
        </Avatar>
        <p className="max-w-full break-all text-center text-sm text-muted-foreground">{selectedFile ? selectedFile.name : removeImage ? "Photo will be removed when you save." : imageUrl ? "Current profile photo" : "No profile photo yet"}</p>
      </div>
      <div className="space-y-2">
        <label htmlFor={id} className="flex items-center gap-2 text-sm font-medium"><Upload aria-hidden="true" className="size-4" />Upload photo (optional)</label>
        <Input ref={fileRef} id={id} name="image" type="file" accept={userImageMimeTypes.join(",")} onChange={selectImage}
          aria-invalid={Boolean(imageError)} aria-describedby={`${id}-hint${imageError ? ` ${id}-error` : ""}`} className="min-w-0 max-w-full cursor-pointer file:mr-3" />
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">JPEG, PNG, or WebP. Maximum 5 MB. Leave blank to keep the current photo or continue without one.</p>
        {imageError && <p id={`${id}-error`} role="alert" className="text-sm text-destructive">{imageError}</p>}
      </div>
      {(selectedFile || localError) && <Button type="button" variant="outline" size="sm" onClick={() => clearSelection()}><X aria-hidden="true" />Clear selection</Button>}
      {imageUrl && <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={removeImage} onChange={(event) => {
          const removing = event.target.checked;
          clearSelection(removing);
          setRemoveImage(removing);
        }} className="size-4 accent-primary" />Remove current photo
      </label>}
    </fieldset>
  );
}
