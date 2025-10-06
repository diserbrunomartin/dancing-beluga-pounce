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
  const [imageUrl, setImageUrl] = React.useState<string | null>(null);
  const [imageBlob, setImageBlob] = React.useState<Blob | null>(null);

  React.useEffect(() => {
    return () => {
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
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

  const clearImage = () => {
    if (imageUrl) {
      URL.revokeObjectURL(imageUrl);
      setImageUrl(null);
      setImageBlob(null);
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

    const body = {
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
    };

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
      clearImage();
      const url = URL.createObjectURL(blob);
      setImageBlob(blob);
      setImageUrl(url);
      showSuccess("Imagen generada correctamente");
    } catch (e) {
      showError("Error procesando la imagen recibida.");
      console.error("Blob conversion error:", e);
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
            <Button onClick={saveApiKey} className="whitespace-nowrap">
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

        <div className="flex items-center gap-3">
          <Button onClick={handleGenerate} disabled={loading}>
            {loading ? "Generando..." : "Generar imagen"}
          </Button>

          <Button onClick={clearImage} disabled={!imageUrl || loading} className="bg-transparent">
            Limpiar
          </Button>
        </div>

        <div>
          <Label>Vista previa</Label>
          <div className="mt-2">
            {imageUrl ? (
              <div className="flex flex-col sm:flex-row gap-4 items-start">
                <img
                  src={imageUrl}
                  alt="Vista previa generada"
                  className="max-w-full w-80 h-auto rounded-md border"
                />
                <div className="flex flex-col gap-2">
                  <a href={imageUrl} download="gemini-image.png" className="inline-block">
                    <Button>Descargar imagen</Button>
                  </a>
                  <Button
                    onClick={() => {
                      window.open(imageUrl, "_blank");
                    }}
                    className="border"
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