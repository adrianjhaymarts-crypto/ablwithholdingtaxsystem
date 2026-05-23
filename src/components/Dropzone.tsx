import { UploadCloud } from "lucide-react";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

export function Dropzone({
  onFiles,
  accept = ".xlsx,.xls,.csv",
  hint,
}: {
  onFiles: (files: File[]) => void;
  accept?: string;
  hint?: string;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const files = Array.from(e.dataTransfer.files);
        if (files.length) onFiles(files);
      }}
      onClick={() => inputRef.current?.click()}
      className={cn(
        "cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition-all glass",
        dragging ? "border-primary bg-accent/30 scale-[1.01]" : "border-border hover:border-primary/60"
      )}
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={accept}
        multiple
        onChange={(e) => {
          const files = e.target.files ? Array.from(e.target.files) : [];
          if (files.length) onFiles(files);
          e.target.value = "";
        }}
      />
      <div className="w-12 h-12 mx-auto rounded-2xl gradient-primary grid place-items-center shadow-elegant mb-3">
        <UploadCloud className="w-6 h-6 text-primary-foreground" />
      </div>
      <p className="font-medium">Drop files here or click to upload</p>
      <p className="text-xs text-muted-foreground mt-1">{hint || "Excel files (.xlsx, .xls) or CSV"}</p>
    </div>
  );
}