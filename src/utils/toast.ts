import { toast } from "sonner";

export const showSuccess = (message: string) => {
  toast.success(message);
};

export const showError = (message: string) => {
  toast.error(message);
};

export const showLoading = (message: string) => {
  return toast.loading(message);
};

// Accept string or number (and optional) because sonner may return either type for a toast id.
// Passing through to toast.dismiss with the same value.
export const dismissToast = (toastId?: string | number) => {
  toast.dismiss(toastId as any);
};