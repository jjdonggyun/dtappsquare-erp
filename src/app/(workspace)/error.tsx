"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function WorkspaceError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error("Workspace render failed", error);
  }, [error]);

  return (
    <Card><CardContent className="flex flex-col items-center py-16 text-center">
      <AlertTriangle className="mb-3 text-destructive" size={26} />
      <h1 className="text-base font-semibold">화면을 불러오지 못했습니다.</h1>
      <p className="mt-2 text-xs text-muted-foreground">일시적인 오류일 수 있습니다. 다시 시도해 주세요.</p>
      {error.digest ? <p className="mt-2 font-mono text-[10px] text-muted-foreground">오류 ID: {error.digest}</p> : null}
      <Button className="mt-5" onClick={retry}>다시 시도</Button>
    </CardContent></Card>
  );
}
