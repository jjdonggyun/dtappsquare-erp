"use client";
import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
export type Field = {
  name: string;
  label: string;
  type?:
    "text" | "email" | "password" | "date" | "time" | "number" | "select" | "checkbox" | "multi" | "textarea";
  value?: string | number | boolean | string[];
  required?: boolean;
  options?: { value: string; label: string }[];
  minLength?: number;
  min?: number;
  max?: number;
  step?: number;
};
export function CommandForm({
  action,
  fields = [],
  constants = {},
  endpoint = "/api/management",
  submit = "저장",
  flat = false,
  columns = 2,
  sensitiveResultField,
  sensitiveResultLabel,
}: {
  action?: string;
  fields?: Field[];
  constants?: Record<string, unknown>;
  endpoint?: string;
  submit?: string;
  flat?: boolean;
  columns?: 1 | 2;
  sensitiveResultField?: string;
  sensitiveResultLabel?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [sensitiveResult, setSensitiveResult] = useState("");
  const router = useRouter();
  const formId = useId();
  const requestKey = useRef<string | null>(null);
  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy) return;
        setBusy(true);
        setMessage("");
        setSensitiveResult("");
        const form = new FormData(event.currentTarget);
        const payload: Record<string, unknown> = { ...constants };
        for (const field of fields) {
          if (field.type === "checkbox") payload[field.name] = form.has(field.name);
          else if (field.type === "multi") payload[field.name] = form.getAll(field.name);
          else if (field.type === "number") payload[field.name] = Number(form.get(field.name));
          else {
            const value = String(form.get(field.name) ?? "");
            if (field.type !== "date" || value) payload[field.name] = value;
          }
        }
        try {
          requestKey.current ??= crypto.randomUUID();
          const response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Idempotency-Key": requestKey.current },
            body: JSON.stringify(
              flat ? { ...payload, ...(action ? { action } : {}) } : { action, payload },
            ),
          });
          const result = await response.json();
          if (!response.ok) {
            setFailed(true);
            setMessage(
              `${result.error?.message ?? "처리하지 못했습니다."} (${result.error?.requestId ?? response.status})`,
            );
          } else {
            requestKey.current = null;
            setFailed(false);
            setMessage(result.data?.message ?? "저장했습니다.");
            if (sensitiveResultField && typeof result.data?.[sensitiveResultField] === "string")
              setSensitiveResult(result.data[sensitiveResultField]);
            if (result.data?.redirect) router.push(result.data.redirect);
            router.refresh();
          }
        } catch {
          setFailed(true);
          setMessage("연결을 확인하고 다시 시도해 주세요.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className={columns === 1 ? "grid gap-5" : "grid gap-4 sm:grid-cols-2"}>
        {fields.map((field) => (
          <div
            className={field.type === "multi" ? "sm:col-span-2 space-y-2" : "space-y-2"}
            key={field.name}
          >
            {field.type !== "multi" && (
              <Label htmlFor={`${formId}-${field.name}`}>
                {field.label}
                {field.required ? " *" : ""}
              </Label>
            )}
            {field.type === "select" ? (
              <select
                id={`${formId}-${field.name}`}
                name={field.name}
                defaultValue={String(field.value ?? "")}
                required={field.required}
              >
                <option value="">선택하세요</option>
                {field.options?.map((option) => (
                  <option value={option.value} key={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : field.type === "textarea" ? (
              <textarea id={`${formId}-${field.name}`} name={field.name} defaultValue={String(field.value ?? "")}
                required={field.required} minLength={field.minLength} rows={4}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            ) : field.type === "checkbox" ? (
              <input
                id={`${formId}-${field.name}`}
                name={field.name}
                type="checkbox"
                defaultChecked={Boolean(field.value)}
                className="ml-3 size-4 accent-primary"
              />
            ) : field.type === "multi" ? (
              <fieldset>
                <legend className="mb-3 text-sm font-medium">{field.label}</legend>
                <div className="grid max-h-60 gap-2 overflow-y-auto sm:grid-cols-2">
                  {field.options?.map((option) => (
                    <label
                      key={option.value}
                      className="flex items-center gap-2 text-sm text-muted-foreground"
                    >
                      <input
                        type="checkbox"
                        name={field.name}
                        value={option.value}
                        defaultChecked={
                          Array.isArray(field.value) && field.value.includes(option.value)
                        }
                        className="accent-primary"
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : (
              <Input
                id={`${formId}-${field.name}`}
                name={field.name}
                type={field.type ?? "text"}
                defaultValue={
                  typeof field.value === "string" || typeof field.value === "number"
                    ? field.value
                    : undefined
                }
                required={field.required}
                minLength={field.minLength}
                min={field.min}
                max={field.max}
                step={field.step}
                autoComplete={field.type === "password" ? "new-password" : undefined}
              />
            )}
          </div>
        ))}
      </div>
      {message && (
        <Alert variant={failed ? "destructive" : "default"}>
          <AlertDescription aria-live="polite">{message}</AlertDescription>
        </Alert>
      )}
      {sensitiveResult ? (
        <div role="status" className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs">
          <p className="font-semibold text-amber-900">
            {sensitiveResultLabel ?? "한 번만 표시되는 값"}
          </p>
          <code className="mt-2 block break-all rounded bg-white p-2 text-[11px] text-foreground">
            {sensitiveResult}
          </code>
        </div>
      ) : null}
      <Button type="submit" disabled={busy} className={columns === 1 ? "h-11 w-full" : undefined}>
        {busy ? "처리 중…" : submit}
      </Button>
    </form>
  );
}
