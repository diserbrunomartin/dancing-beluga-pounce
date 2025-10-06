"use client";

import React from "react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { cn } from "../lib/utils";
import { showSuccess, showError, showLoading, dismissToast } from "../utils/toast";

const ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent";

function base64ToBlob(base64: string, contentType = "image/png") {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: contentType });
}

const STORAGE_KEY = "gemini_api_key";

async function fileToBase64WithoutPrefix(file: File): Promise<{ base64: string; mime: string }> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => {
      reader.abort();
      reject(new Error("Error reading file"));
    };
    reader.onload = () => {
      const result = reader.result as string;
      // result is data:<mime>;base64,<DATA>
      const match = result.match(/^data:(.*);base64,(.*)$/);
      if (!match) {
        reject(new Error("Unexpected file result format"));
        return;
      }
      const mime = match[1];
      const base64 = match[2];
      resolve({ base64, mime });
    };
    reader.readAsDataURL(file);
  });
}

const GeminiImageGenerator: React.FC = () => {
  const [apiKey, setApiKey] = React.useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const [prompt, setPrompt] = React.useState<string>(
    "Create a picture of a nano banana dish in a fancy restaurant with a Gemini theme"
  );
  const [loading, setLoading] = React.useState(false);

  // Generated image state
  const [generatedImageUrl, setGeneratedImageUrl] = React.useState<string | null>(null);
  const [generatedImageBlob, setGeneratedImageBlob] = React.useState<Blob | null>(null);

  // Source/uploaded image state (for inline_data)
  const [sourceFile, setSourceFile] = React.useState<File | null>(null);
  const [sourceBase64, setSourceBase64] = React.useState<string | null>(null);
  const [sourceMime, setSourceMime] = React.useState<string | null>(null);
  const [sourcePreviewUrl, setSourcePreviewUrl] = React.useState<string | null>(null);

  // Cleanup object URLs on unmount
  React.useEffect(() => {
    return () => {
      if (generatedImageUrl) URL.revokeObjectURL(generatedImageUrl);
      if (sourcePreviewUrl) URL.revokeObjectURL(sourcePreviewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveApiKey = () => {
    try {
      localStorage.setItem(STORAGE_KEY, apiKey);
      showSuccess("API key guardada en localStorage");
    } catch {
      showError("No se pudo guardar la API key en localStorage");
    }
  };

  const clearGeneratedImage = () => {
    if (generatedImageUrl) {
      URL.revokeObjectURL(generatedImageUrl);
      setGeneratedImageUrl(null);
      setGeneratedImageBlob(null);
    }
  };

  const clearSourceImage = () => {
    setSourceFile(null);
    setSourceBase64(null);
    setSourceMime(null);
    if (sourcePreviewUrl) {
      URL.revokeObjectURL(sourcePreviewUrl);
      setSourcePreviewUrl(null);
    }
  };

  const onSourceFileChange = async (file?: File) => {
    if (!file) {
      clearSourceImage();
      return;
    }
    try {
      const { base64, mime } = await fileToBase64WithoutPrefix(file);
      // create preview URL
      const preview = URL.createObjectURL(file);
      // revoke old preview if present
      if (sourcePreviewUrl) {
        URL.revokeObjectURL(sourcePreviewUrl);
      }
      setSourceFile(file);
      setSourceBase64(base64);
      setSourceMime(mime);
      setSourcePreviewUrl(preview);
    } catch (e) {
      showError("No se pudo procesar la imagen de entrada.");
      console.error("fileToBase64 error:", e);
    }
  };

  const handleGenerate = async () => {
    if (!apiKey) {
      showError("Introduce la API key antes de generar la imagen.");
      return;
    }
    if (!prompt) {
      showError("Escribe un prompt para generar la imagen.");
      return;
    }

    setLoading(true);
    const loadingId = showLoading("Generando imagen...");

    // Build parts: always include prompt text first
    const parts: any[] = [{ text: prompt }];

    // If there's a source image, include inline_data part
    if (sourceBase64 && sourceMime) {
      parts.push({
        inline_data: {
          mime_type: sourceMime,
          data: sourceBase64,
        },
      });
    }

    const body = {
      contents: [
        {
          parts,
        },
      ],
    };

    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify(body),
      });

      dismissToast(loadingId);

      if (!res.ok) {
        const text = await res.text();
        showError(`Error en la API: ${res.status} ${res.statusText}`);
        console.error("Response text:", text);
        setLoading(false);
        return;
      }

      const text = await res.text();

      // Extraer campo "data": "BASE64..." si existe en la respuesta
      const match = text.match(/"data"\s*:\s*"([^"]*)"/);
      let base64: string | null = null;

      if (match && match[1]) {
        base64 = match[1];
      } else {
        // Intentar parsear JSON y buscar recursivamente
        try {
          const parsed = JSON.parse(text);
          const findData = (obj: any): string | null => {
            if (!obj || typeof obj !== "object") return null;
            if (typeof obj.data === "string") return obj.data;
            for (const key of Object.keys(obj)) {
              const val = obj[key];
              if (typeof val === "object") {
                const found = findData(val);
                if (found) return found;
              }
            }
            return null;
          };
          base64 = findData(parsed);
        } catch (e) {
          // ignore
        }
      }

      if (!base64) {
        showError("No se encontró datos de imagen en la respuesta.");
        console.error("Respuesta completa:", text);
        setLoading(false);
        return;
      }

      try {
        const blob = base64ToBlob(base64);
        clearGeneratedImage();
        const url = URL.createObjectURL(blob);
        setGeneratedImageBlob(blob);
        setGeneratedImageUrl(url);
        showSuccess("Imagen generada correctamente");
      } catch (e) {
        showError("Error procesando la imagen recibida.");
        console.error("Blob conversion error:", e);
      }
    } catch (e) {
      // network or unexpected error
      dismissToast(loadingId);
      showError("Error al conectar con la API.");
      console.error("Fetch error:", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 bg-white rounded-lg shadow-sm">
      <h2 className="text-2xl font-semibold mb-4">Generador de imágenes Gemini</h2>

      <div className="grid gap-4">
        <div>
          <Label className="mb-1">API Key (x-goog-api-key)</Label>
          <div className="flex gap-2">
            <Input
              type="password"
              value={apiKey}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setApiKey(e.target.value)
              }
              placeholder="Introduce tu API key de Gemini"
              className="flex-1"
            />
            <Button onClick={saveApiKey} className="whitespace-nowrap" variant="default">
              Guardar
            </Button>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            La API key se guarda localmente en tu navegador.
          </p>
        </div>

        <div>
          <Label className="mb-1">Prompt</Label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            className={cn(
              "w-full rounded-md border px-3 py-2 text-sm resize-vertical",
              "border-border bg-card text-card-foreground"
            )}
          />
        </div>

        <div>
          <Label className="mb-1">Imagen de entrada (opcional)</Label>
          <div className="flex items-center gap-2">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  onSourceFileChange(file);
                } else {
                  clearSourceImage();
                }
              }}
              className="text-sm"
            />
            {sourceFile && (
              <Button onClick={clearSourceImage} variant="ghost">
                Eliminar imagen
              </Button>
            )}
          </div>
          {sourcePreviewUrl ? (
            <div className="mt-2 flex items-start gap-4">
              <img
                src={sourcePreviewUrl}
                alt="Preview entrada"
                className="w-40 h-auto rounded-md border"
              />
              <div className="text-sm text-gray-600">
                <div><strong>{sourceFile?.name}</strong></div>
                <div>{sourceMime}</div>
                <div className="mt-2">
                  <Button
                    onClick={() => {
                      // descargar la imagen de entrada
                      if (!sourcePreviewUrl) return;
                      const a = document.createElement("a");
                      a.href = sourcePreviewUrl;
                      a.download = sourceFile?.name ?? "source-image";
                      a.click();
                    }}
                    variant="secondary"
                  >
                    Descargar entrada
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500 mt-2">No hay imagen de entrada seleccionada.</p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={handleGenerate} disabled={loading} variant="default">
            {loading ? "Generando..." : "Generar imagen"}
          </Button>

          <Button
            onClick={() => {
              clearGeneratedImage();
            }}
            disabled={!generatedImageUrl || loading}
            variant="ghost"
          >
            Limpiar resultado
          </Button>
        </div>

        <div>
          <Label>Vista previa</Label>
          <div className="mt-2">
            {generatedImageUrl ? (
              <div className="flex flex-col sm:flex-row gap-4 items-start">
                <img
                  src={generatedImageUrl}
                  alt="Vista previa generada"
                  className="max-w-full w-80 h-auto rounded-md border"
                />
                <div className="flex flex-col gap-2">
                  <a
                    href={generatedImageUrl}
                    download="gemini-image.png"
                    className="inline-block"
                  >
                    <Button variant="secondary">Descargar imagen</Button>
                  </a>
                  <Button
                    onClick={() => {
                      // abrir en nueva pestaña
                      window.open(generatedImageUrl, "_blank");
                    }}
                    variant="outline"
                  >
                    Abrir en nueva pestaña
                  </Button>
                </div>
              </div>
            ) : (
              <div className="p-6 rounded-md border border-dashed text-sm text-gray-500">
                No hay imagen generada todavía.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GeminiImageGenerator;