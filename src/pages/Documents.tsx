import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Plus,
  Upload,
  Edit2,
  Trash2,
  Eye,
  Copy,
  Download,
  CheckCircle,
  FilePlus,
  Loader2,
  FileCheck,
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";

// Tipo local de plantilla de documento
interface DocumentTemplate {
  id: string;
  agentId: string;
  name: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

// Detecta todas las variables {{variable}} dentro del contenido de la plantilla
function extractVariables(content: string): string[] {
  const regex = /\{\{([^}]+)\}\}/g;
  const found = new Set<string>();
  let match;
  while ((match = regex.exec(content)) !== null) {
    found.add(match[1].trim());
  }
  return Array.from(found);
}

// Reemplaza las variables {{variable}} con los valores provistos
function applyVariables(content: string, values: Record<string, string>): string {
  return content.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
    const trimmed = key.trim();
    return values[trimmed] ?? `{{${trimmed}}}`;
  });
}

// Formatea fecha de timestamp
function formatDate(ts: number): string {
  if (!ts) return "";
  return new Date(ts).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function Documents() {
  const { user } = useAuth();

  // Estado de datos
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Estado del modal de edición/creación de plantilla
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<DocumentTemplate | null>(null);
  const [formName, setFormName] = useState("");
  const [formContent, setFormContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Estado del modal de generación de documento
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<DocumentTemplate | null>(null);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [generatedDoc, setGeneratedDoc] = useState<string>("");
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [copied, setCopied] = useState(false);

  // Ref para input de archivo
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Suscripción en tiempo real a documentTemplates del agente
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "documentTemplates"),
      where("agentId", "==", user.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data: DocumentTemplate[] = [];
        snapshot.forEach((d) => {
          data.push({ id: d.id, ...d.data() } as DocumentTemplate);
        });
        // Ordenar por fecha de creación (más recientes primero)
        data.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setTemplates(data);
        setIsLoading(false);
      },
      (error) => {
        console.error("Error cargando plantillas:", error);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // ——— Gestión de plantillas ———

  const handleOpenCreateDialog = () => {
    setEditingTemplate(null);
    setFormName("");
    setFormContent(
      "Este contrato se celebra entre:\n\nPARTE ARRENDADORA: {{nombre_arrendador}}, DNI {{dni_arrendador}}\nPARTE ARRENDATARIA: {{nombre_inquilino}}, DNI {{dni_inquilino}}\n\nInmueble ubicado en: {{direccion_propiedad}}, {{ciudad}}\n\nFecha de inicio: {{fecha_inicio}}\nDuración: {{duracion_meses}} meses\nAlquiler mensual: ${{monto_alquiler}}\n\nFirmado en {{ciudad}}, el día {{fecha_firma}}."
    );
    setIsTemplateDialogOpen(true);
  };

  const handleOpenEditDialog = (template: DocumentTemplate) => {
    setEditingTemplate(template);
    setFormName(template.name);
    setFormContent(template.content);
    setIsTemplateDialogOpen(true);
  };

  const handleSaveTemplate = async () => {
    if (!user || !formName.trim() || !formContent.trim()) return;
    setIsSaving(true);
    try {
      if (editingTemplate) {
        // Actualizar plantilla existente
        await updateDoc(doc(db, "documentTemplates", editingTemplate.id), {
          name: formName.trim(),
          content: formContent.trim(),
          updatedAt: Date.now(),
        });
      } else {
        // Crear nueva plantilla
        await addDoc(collection(db, "documentTemplates"), {
          agentId: user.uid,
          name: formName.trim(),
          content: formContent.trim(),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
      setIsTemplateDialogOpen(false);
    } catch (error) {
      console.error("Error guardando plantilla:", error);
      alert("Hubo un error al guardar la plantilla. Verifica tu conexión.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTemplate = async (template: DocumentTemplate) => {
    if (!confirm(`¿Eliminar la plantilla "${template.name}"? Esta acción no se puede deshacer.`))
      return;
    try {
      await deleteDoc(doc(db, "documentTemplates", template.id));
    } catch (error) {
      console.error("Error eliminando plantilla:", error);
      alert("Error al eliminar la plantilla.");
    }
  };

  // ——— Carga de plantilla desde archivo ———

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.name.endsWith(".txt") && !file.name.endsWith(".md")) {
      alert("Solo se admiten archivos .txt o .md");
      return;
    }

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const name = file.name.replace(/\.(txt|md)$/, "");
        await addDoc(collection(db, "documentTemplates"), {
          agentId: user.uid,
          name,
          content: content.trim(),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        alert(`Plantilla "${name}" importada correctamente.`);
      } catch (error) {
        console.error("Error importando archivo:", error);
        alert("Error al importar el archivo.");
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.onerror = () => {
      alert("No se pudo leer el archivo.");
      setIsUploading(false);
    };
    reader.readAsText(file, "UTF-8");
  };

  // ——— Generación de documento ———

  const handleOpenGenerateDialog = (template: DocumentTemplate) => {
    setSelectedTemplate(template);
    const vars = extractVariables(template.content);
    const initialValues: Record<string, string> = {};
    vars.forEach((v) => (initialValues[v] = ""));
    setVariableValues(initialValues);
    setGeneratedDoc("");
    setIsPreviewMode(false);
    setCopied(false);
    setIsGenerateDialogOpen(true);
  };

  const handleGenerateDocument = () => {
    if (!selectedTemplate) return;
    const result = applyVariables(selectedTemplate.content, variableValues);
    setGeneratedDoc(result);
    setIsPreviewMode(true);
  };

  const handleCopyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(generatedDoc);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      alert("No se pudo copiar al portapapeles.");
    }
  };

  const handleDownload = () => {
    if (!generatedDoc || !selectedTemplate) return;
    const blob = new Blob([generatedDoc], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedTemplate.name.replace(/\s+/g, "_")}_generado.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Variables detectadas de la plantilla seleccionada
  const detectedVars = selectedTemplate ? extractVariables(selectedTemplate.content) : [];
  const allVarsFilled = detectedVars.every((v) => variableValues[v]?.trim());

  // ——— Render ———

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">
            Formularios y Docs
          </h2>
          <p className="text-slate-500 mt-1">
            Crea plantillas con variables dinámicas y genera contratos al instante.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Input oculto para subir archivo */}
          <input
            type="file"
            accept=".txt,.md"
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
          />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Upload className="w-4 h-4 mr-2" />
            )}
            {isUploading ? "Importando..." : "Cargar desde .txt"}
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleOpenCreateDialog}>
            <Plus className="w-4 h-4 mr-2" />
            Nueva Plantilla
          </Button>
        </div>
      </div>

      {/* Ayuda rápida sobre variables */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-700 flex items-start gap-2">
        <FileCheck className="w-4 h-4 mt-0.5 shrink-0 text-blue-500" />
        <span>
          Usa <code className="font-mono bg-blue-100 px-1 rounded">{"{{variable}}"}</code> en el
          contenido de tus plantillas para crear campos dinámicos. Al generar el documento, se te
          pedirá rellenar cada variable.
        </span>
      </div>

      {/* Estado de carga */}
      {isLoading && (
        <div className="flex items-center justify-center py-16 text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          Cargando plantillas...
        </div>
      )}

      {/* Estado vacío */}
      {!isLoading && templates.length === 0 && (
        <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-xl">
          <FilePlus className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-600 mb-1">
            Aún no tienes plantillas
          </h3>
          <p className="text-slate-400 text-sm mb-6">
            Crea tu primera plantilla o importa un archivo .txt para comenzar.
          </p>
          <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleOpenCreateDialog}>
            <Plus className="w-4 h-4 mr-2" />
            Crear primera plantilla
          </Button>
        </div>
      )}

      {/* Grid de plantillas */}
      {!isLoading && templates.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => {
            const vars = extractVariables(template.content);
            return (
              <Card
                key={template.id}
                className="flex flex-col hover:shadow-md transition-shadow duration-200"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="p-2 bg-blue-50 rounded-lg shrink-0">
                        <FileText className="w-5 h-5 text-blue-500" />
                      </div>
                      <CardTitle className="text-base leading-tight truncate">
                        {template.name}
                      </CardTitle>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-slate-400 hover:text-blue-600"
                        title="Editar plantilla"
                        onClick={() => handleOpenEditDialog(template)}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-slate-400 hover:text-red-600"
                        title="Eliminar plantilla"
                        onClick={() => handleDeleteTemplate(template)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <CardDescription className="mt-2 text-xs text-slate-400">
                    Creada el {formatDate(template.createdAt)}
                    {template.updatedAt !== template.createdAt &&
                      ` · Editada el ${formatDate(template.updatedAt)}`}
                  </CardDescription>
                </CardHeader>

                <CardContent className="flex-1 pb-3">
                  {/* Preview del contenido */}
                  <p className="text-sm text-slate-500 line-clamp-3 whitespace-pre-line">
                    {template.content}
                  </p>

                  {/* Variables detectadas */}
                  {vars.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {vars.slice(0, 4).map((v) => (
                        <Badge
                          key={v}
                          variant="secondary"
                          className="text-xs font-mono bg-amber-50 text-amber-700 border border-amber-200"
                        >
                          {`{{${v}}}`}
                        </Badge>
                      ))}
                      {vars.length > 4 && (
                        <Badge variant="secondary" className="text-xs">
                          +{vars.length - 4} más
                        </Badge>
                      )}
                    </div>
                  )}
                </CardContent>

                <CardFooter className="pt-0">
                  <Button
                    className="w-full bg-blue-600 hover:bg-blue-700"
                    onClick={() => handleOpenGenerateDialog(template)}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    Generar Documento
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* ——— Modal: Crear / Editar Plantilla ——— */}
      <Dialog open={isTemplateDialogOpen} onOpenChange={setIsTemplateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? "Editar Plantilla" : "Nueva Plantilla"}
            </DialogTitle>
            <DialogDescription>
              Usa{" "}
              <code className="font-mono text-blue-600 text-xs bg-blue-50 px-1 rounded">
                {"{{nombre_variable}}"}
              </code>{" "}
              para crear campos que se rellenarán al generar el documento.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="template-name">Nombre de la plantilla *</Label>
              <Input
                id="template-name"
                placeholder="Ej: Contrato de Alquiler, Reserva Ad-Referendum..."
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="template-content">Contenido *</Label>
              <Textarea
                id="template-content"
                placeholder={`Ej:\nEste contrato se celebra entre {{nombre_arrendador}} y {{nombre_inquilino}}...\n\nFecha: {{fecha}}\nMonto: ${{monto}}`}
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                className="min-h-[280px] font-mono text-sm resize-y"
              />
              {/* Preview de variables detectadas en tiempo real */}
              {formContent && extractVariables(formContent).length > 0 && (
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <p className="text-xs font-medium text-amber-700 mb-2">
                    Variables detectadas ({extractVariables(formContent).length}):
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {extractVariables(formContent).map((v) => (
                      <Badge
                        key={v}
                        variant="secondary"
                        className="text-xs font-mono bg-amber-100 text-amber-800 border border-amber-200"
                      >
                        {`{{${v}}}`}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsTemplateDialogOpen(false)}
              disabled={isSaving}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveTemplate}
              disabled={isSaving || !formName.trim() || !formContent.trim()}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <FileCheck className="w-4 h-4 mr-2" />
                  {editingTemplate ? "Guardar Cambios" : "Crear Plantilla"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ——— Modal: Generar Documento ——— */}
      <Dialog open={isGenerateDialogOpen} onOpenChange={setIsGenerateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-500" />
              {isPreviewMode ? "Vista Previa del Documento" : `Generar: ${selectedTemplate?.name}`}
            </DialogTitle>
            <DialogDescription>
              {isPreviewMode
                ? "Revisa el documento generado. Puedes copiarlo o descargarlo."
                : detectedVars.length > 0
                ? "Completa los campos para personalizar el documento."
                : "Esta plantilla no tiene variables. Puedes generarla directamente."}
            </DialogDescription>
          </DialogHeader>

          {/* Paso 1: Rellenar variables */}
          {!isPreviewMode && (
            <div className="space-y-4 py-2">
              {detectedVars.length === 0 ? (
                <div className="text-center py-6 text-slate-500">
                  <FileText className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                  <p className="text-sm">Esta plantilla no tiene variables dinámicas.</p>
                  <p className="text-sm">El documento se generará con el contenido fijo.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {detectedVars.map((variable) => (
                    <div key={variable} className="space-y-1.5">
                      <Label htmlFor={`var-${variable}`} className="capitalize text-sm">
                        {variable.replace(/_/g, " ")}
                      </Label>
                      <Input
                        id={`var-${variable}`}
                        placeholder={`Valor para {{${variable}}}`}
                        value={variableValues[variable] || ""}
                        onChange={(e) =>
                          setVariableValues((prev) => ({
                            ...prev,
                            [variable]: e.target.value,
                          }))
                        }
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Paso 2: Vista previa del documento generado */}
          {isPreviewMode && (
            <div className="space-y-3 py-2">
              <pre className="whitespace-pre-wrap text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-lg p-4 max-h-[320px] overflow-y-auto font-sans leading-relaxed">
                {generatedDoc}
              </pre>
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {isPreviewMode ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => setIsPreviewMode(false)}
                  className="sm:mr-auto"
                >
                  ← Volver a editar
                </Button>
                <Button
                  variant="outline"
                  onClick={handleCopyToClipboard}
                  className={copied ? "border-green-500 text-green-600" : ""}
                >
                  {copied ? (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      ¡Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-2" />
                      Copiar texto
                    </>
                  )}
                </Button>
                <Button
                  className="bg-blue-600 hover:bg-blue-700"
                  onClick={handleDownload}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Descargar .txt
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => setIsGenerateDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  className="bg-blue-600 hover:bg-blue-700"
                  onClick={handleGenerateDocument}
                  disabled={detectedVars.length > 0 && !allVarsFilled}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  {detectedVars.length === 0
                    ? "Ver Documento"
                    : allVarsFilled
                    ? "Generar Documento"
                    : `Faltan ${detectedVars.filter((v) => !variableValues[v]?.trim()).length} campo(s)`}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
