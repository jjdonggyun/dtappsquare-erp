"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div role="alert" className="mx-auto max-w-lg space-y-5 p-12">
      <h1 className="text-2xl font-semibold">화면을 불러오지 못했습니다.</h1>
      <p className="text-muted-foreground">
        로그인 상태와 접근 권한을 확인해 주세요. 문제가 계속되면 관리자에게 문의해 주세요.
      </p>
      <Button onClick={reset}>다시 시도</Button>
    </div>
  );
}
