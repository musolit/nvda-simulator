import LoginButton from "./LoginButton";

const ERROR_MESSAGES: Record<string, string> = {
  not_allowed: "허용되지 않은 계정입니다. 지정된 Google 계정으로만 로그인할 수 있습니다.",
  auth_failed: "로그인에 실패했습니다. 다시 시도해주세요.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const message = error ? ERROR_MESSAGES[error] ?? "로그인에 실패했습니다." : null;

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-neutral-950 px-6">
      <div className="w-full max-w-xs">
        <div className="mb-10 text-center">
          <p className="text-sm font-medium tracking-wide text-emerald-400">NVIDIA · NVDA</p>
          <h1 className="mt-2 text-2xl font-semibold text-white">매도 시뮬레이터</h1>
          <p className="mt-2 text-sm text-neutral-400">개인용 대시보드입니다. 로그인이 필요합니다.</p>
        </div>
        {message && (
          <div className="mb-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-300 ring-1 ring-red-500/20">
            {message}
          </div>
        )}
        <LoginButton />
      </div>
    </div>
  );
}
